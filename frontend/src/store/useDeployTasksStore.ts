/**
 * 全局管理"算法部署任务"的 zustand store。
 *
 * 关键设计：
 * - submit() / upload() 立即返回 task；后台 fire-and-forget 订阅 NDJSON 流
 * - sessionStorage 持久化（页面刷新不丢失；不跨浏览器）
 * - transient 字段（AbortController / progress）不持久化
 * - logLines 写入时限制 200 行，避免撑爆 sessionStorage
 * - 任务行 id（taskId）与后端 task_id（backendTaskId）解耦：
 *   upload 阶段只有 taskId；upload 完成后才填入 backendTaskId，并用它订阅 build/stream
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import axios from 'axios'
import { parseNDJSON } from '@/utils/ndjsonStream'

export type DeployStatus =
  | 'uploading' | 'queued' | 'building' | 'starting' | 'running'
  | 'failed' | 'cancelled' | 'lost'

export interface DeployTask {
  /** 本地行 id（crypto.randomUUID），也是 store key */
  taskId: string
  algorithmId: number
  algorithmName: string
  status: DeployStatus
  logLines: string[]
  result?: { port: number; image: string; containerId: string }
  error?: string
  startedAt: number
  finishedAt?: number
  /** 上传进度 0-100；仅 uploading 阶段有意义；transient，不持久化 */
  progress?: number
  /** 后端真实 task_id；upload 完成前没有；用于拼 stream URL */
  backendTaskId?: string
  /** transient —— 不持久化；既给 axios.signal 也给 stream fetch.signal 复用 */
  controller?: AbortController
}

interface DeployTasksState {
  tasks: Record<string, DeployTask>
  collapsed: boolean
  submit: (
    algorithmId: number,
    algorithmName: string,
    headers: Record<string, string>,
  ) => Promise<DeployTask>
  /**
   * 上传算法包（multipart/form-data）。立刻返回本地 taskId，
   * 弹窗提交后可立即关闭。上传动作 fire-and-forget：
   *   - 进度写入 store（节流）
   *   - 成功后自动转 'building' 并订阅 stream
   *   - 失败 / 取消分别落到 failed / cancelled
   */
  upload: (
    formData: FormData,
    algorithmName: string,
    headers: Record<string, string>,
  ) => string
  /**
   * 复用后端已经创建好的 task（典型场景：上传接口自动触发了构建，
   * 此时直接订阅 /build/stream 不再 POST /build）。返回新创建的 task。
   */
  attachExisting: (
    taskId: string,
    algorithmId: number,
    algorithmName: string,
    headers: Record<string, string>,
  ) => DeployTask
  cancelStream: (taskId: string) => void
  removeTask: (taskId: string) => void
  /** 清掉所有已出终态的任务行（全部跑完后自动收起整条任务栏） */
  clearFinished: () => void
  toggleCollapsed: () => void
  _markFinished: (
    taskId: string,
    status: DeployStatus,
    result?: DeployTask['result'],
    error?: string,
  ) => void
  _appendLog: (taskId: string, line: string) => void
  _setProgress: (taskId: string, progress: number) => void
}

const STORAGE_KEY = 'deploy_tasks_v1'
const MAX_LOG_LINES_IN_MEMORY = 500
const MAX_LOG_LINES_PERSISTED = 200
const PROGRESS_THROTTLE_MS = 200

export const useDeployTasksStore = create<DeployTasksState>()(
  persist(
    (set, get) => ({
      tasks: {},
      collapsed: false,

      submit: async (algorithmId, algorithmName, headers) => {
        const r = await fetch(`/api/algorithms/${algorithmId}/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
        })
        if (r.status === 409) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.detail || '该算法正在构建中')
        }
        if (!r.ok) {
          throw new Error(`提交失败 HTTP ${r.status}`)
        }
        const { task_id } = await r.json() as { task_id: string; stream_url: string }

        const task: DeployTask = {
          taskId: task_id,
          backendTaskId: task_id,
          algorithmId,
          algorithmName,
          status: 'queued',
          logLines: [],
          startedAt: Date.now(),
          controller: new AbortController(),
        }
        set((s) => ({ tasks: { ...s.tasks, [task_id]: task } }))
        // 后台订阅流（fire-and-forget）
        subscribeStream(task_id, task_id, headers, get).catch((e) =>
          console.error('[deploy] stream error', e),
        )
        return task
      },

      upload: (formData, algorithmName, headers) => {
        const taskId = crypto.randomUUID()
        const controller = new AbortController()
        const task: DeployTask = {
          taskId,
          algorithmId: 0,
          algorithmName,
          status: 'uploading',
          progress: 0,
          logLines: [],
          startedAt: Date.now(),
          controller,
        }
        set((s) => ({ tasks: { ...s.tasks, [taskId]: task } }))

        // 进度节流：onUploadProgress 每个 chunk 都触发，
        // 1% 变化 且 ≥200ms 才写一次（避免 FAB 重渲染 + sessionStorage 高频序列化）
        let lastPct = -1
        let lastTs = 0

        axios
          .post<{ task_id: string; algorithm?: { id: number | string; name?: string } }>(
            '/api/algorithms/upload',
            formData,
            {
              // axios 看到 FormData 会自动设 Content-Type + boundary；这里不要手动覆盖
              headers,
              signal: controller.signal,
              onUploadProgress: (evt) => {
                if (!evt.total) return
                const pct = Math.round((evt.loaded * 100) / evt.total)
                const now = Date.now()
                if (pct !== 100 && now - lastTs < PROGRESS_THROTTLE_MS) return
                if (pct === lastPct) return
                lastPct = pct
                lastTs = now
                useDeployTasksStore.getState()._setProgress(taskId, pct)
              },
            },
          )
          .then((resp) => {
            const backendTaskId = resp.data?.task_id
            const algoId = Number(resp.data?.algorithm?.id) || 0
            const algoName = resp.data?.algorithm?.name || algorithmName
            if (!backendTaskId) {
              useDeployTasksStore.getState()._markFinished(
                taskId,
                'failed',
                undefined,
                '后端未返回 task_id',
              )
              return
            }
            // 写 backendTaskId + algorithmId，状态切到 building，清掉 progress
            set((s) => {
              const t = s.tasks[taskId]
              if (!t) return s
              return {
                tasks: {
                  ...s.tasks,
                  [taskId]: {
                    ...t,
                    algorithmId: algoId,
                    algorithmName: algoName,
                    backendTaskId,
                    status: 'building',
                    progress: undefined,
                  },
                },
              }
            })
            subscribeStream(taskId, backendTaskId, headers, get).catch((e) =>
              console.error('[deploy] stream error', e),
            )
          })
          .catch((err) => {
            // axios 取消有两种命名：CanceledError（新） / ERR_CANCELED（旧）
            if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
              useDeployTasksStore.getState()._markFinished(
                taskId,
                'cancelled',
                undefined,
                '上传已取消',
              )
            } else {
              const msg =
                err?.response?.data?.detail || err?.message || '上传失败'
              useDeployTasksStore.getState()._markFinished(taskId, 'failed', undefined, msg)
            }
          })

        return taskId
      },

      attachExisting: (taskId, algorithmId, algorithmName, headers) => {
        const task: DeployTask = {
          taskId,
          backendTaskId: taskId,
          algorithmId,
          algorithmName,
          status: 'building',
          logLines: [],
          startedAt: Date.now(),
          controller: new AbortController(),
        }
        set((s) => ({ tasks: { ...s.tasks, [taskId]: task } }))
        // 订阅现有任务流（fire-and-forget）
        subscribeStream(taskId, taskId, headers, get).catch((e) =>
          console.error('[deploy] stream error', e),
        )
        return task
      },

      cancelStream: (taskId) => {
        const t = get().tasks[taskId]
        if (t?.controller) t.controller.abort()
      },

      removeTask: (taskId) => {
        get().cancelStream(taskId)
        set((s) => {
          const next = { ...s.tasks }
          delete next[taskId]
          return { tasks: next }
        })
      },

      clearFinished: () =>
        set((s) => ({
          tasks: Object.fromEntries(
            Object.entries(s.tasks).filter(([, t]) => !t.finishedAt),
          ),
        })),

      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

      _markFinished: (taskId, status, result, error) => {
        set((s) => {
          const t = s.tasks[taskId]
          if (!t) return s
          return {
            tasks: {
              ...s.tasks,
              [taskId]: {
                ...t,
                status,
                result: result ?? t.result,
                error: error ?? t.error,
                progress: undefined,
                finishedAt: ['running', 'failed', 'cancelled', 'lost'].includes(status)
                  ? Date.now()
                  : t.finishedAt,
              },
            },
          }
        })
      },

      _appendLog: (taskId, line) => {
        set((s) => {
          const t = s.tasks[taskId]
          if (!t) return s
          const next = [...t.logLines, line]
          if (next.length > MAX_LOG_LINES_IN_MEMORY) {
            next.splice(0, next.length - MAX_LOG_LINES_IN_MEMORY)
          }
          return { tasks: { ...s.tasks, [taskId]: { ...t, logLines: next } } }
        })
      },

      _setProgress: (taskId, progress) => {
        set((s) => {
          const t = s.tasks[taskId]
          if (!t) return s
          return {
            tasks: {
              ...s.tasks,
              [taskId]: { ...t, progress },
            },
          }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        tasks: Object.fromEntries(
          Object.entries(state.tasks).map(([k, t]) => [
            k,
            {
              ...t,
              controller: undefined,
              // 进度是 transient，不持久化；上传是 fire-and-forget，刷新即降级为 lost
              progress: undefined,
              logLines: t.logLines.slice(-MAX_LOG_LINES_PERSISTED),
            },
          ]),
        ),
      }),
      onRehydrateStorage: () => () => {
        // 方案 A 的诚实边界：页面刷新会销毁 XHR，
        // sessionStorage 残留的 'uploading' 任务永远到不了 building。
        // 降级为 lost，让用户知道需要重新上传。
        const { tasks } = useDeployTasksStore.getState()
        const next: Record<string, DeployTask> = {}
        let mutated = false
        for (const [k, t] of Object.entries(tasks)) {
          if (t.status === 'uploading') {
            next[k] = {
              ...t,
              status: 'lost',
              error: '页面刷新导致上传中断，请重新上传',
              finishedAt: Date.now(),
            }
            mutated = true
          } else {
            next[k] = t
          }
        }
        if (mutated) useDeployTasksStore.setState({ tasks: next })
      },
    },
  ),
)

/** 会写 finishedAt 的终态；其余状态只更新显示 */
const TERMINAL_STATUSES: DeployStatus[] = ['running', 'failed', 'cancelled', 'lost']

async function subscribeStream(
  taskId: string,
  backendTaskId: string,
  headers: Record<string, string>,
  get: () => DeployTasksState,
): Promise<void> {
  const state = get()
  const task = state.tasks[taskId]
  if (!task) return
  const url = `/api/algorithms/${task.algorithmId}/build/stream?task_id=${backendTaskId}`
  let resp: Response
  try {
    resp = await fetch(url, { headers, signal: task.controller?.signal })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    state._markFinished(taskId, 'lost', undefined, '流订阅失败')
    return
  }
  if (resp.status === 404) {
    state._markFinished(taskId, 'lost', undefined, '后端已丢失此任务')
    return
  }
  if (!resp.ok || !resp.body) {
    state._markFinished(taskId, 'failed', undefined, `HTTP ${resp.status}`)
    return
  }
  let settled = false
  try {
    for await (const evt of parseNDJSON<any>(resp, task.controller?.signal)) {
      if (evt.type === 'log' && typeof evt.line === 'string') {
        state._appendLog(taskId, evt.line)
      } else if (evt.type === 'status' && typeof evt.status === 'string') {
        const s = evt.status as DeployStatus
        if (TERMINAL_STATUSES.includes(s)) settled = true
        state._markFinished(taskId, s, evt.result, evt.error)
      }
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    state._markFinished(taskId, 'failed', undefined, '流解析异常')
    return
  }
  // 流读完了却没等到终态帧（连接被掐断 / 后端进程被回收 / 网关超时）：
  // 回查一次真实终态，不让任务永远卡在"进行中"
  if (!settled) await settleFromBackend(taskId, backendTaskId, headers, state)
}

/** 用一次性查询接口补齐终态（GET /{algorithmId}/build?task_id=） */
async function settleFromBackend(
  taskId: string,
  backendTaskId: string,
  headers: Record<string, string>,
  state: DeployTasksState,
): Promise<void> {
  const t = state.tasks[taskId]
  if (!t || t.finishedAt) return
  if (!t.algorithmId) {
    state._markFinished(taskId, 'lost', undefined, '流已断开，且缺少算法 ID 无法回查')
    return
  }
  try {
    const r = await fetch(
      `/api/algorithms/${t.algorithmId}/build?task_id=${encodeURIComponent(backendTaskId)}`,
      { headers, signal: t.controller?.signal },
    )
    if (!r.ok) {
      state._markFinished(
        taskId,
        r.status === 404 ? 'lost' : 'failed',
        undefined,
        r.status === 404 ? '后端已丢失此任务' : `回查失败 HTTP ${r.status}`,
      )
      return
    }
    const d = (await r.json()) as { status?: string; result?: DeployTask['result']; error?: string }
    if (d.status && TERMINAL_STATUSES.includes(d.status as DeployStatus)) {
      state._markFinished(taskId, d.status as DeployStatus, d.result, d.error)
    } else {
      state._markFinished(taskId, 'lost', undefined, '任务被中断，未拿到终态')
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    state._markFinished(taskId, 'lost', undefined, '流已断开且回查失败')
  }
}