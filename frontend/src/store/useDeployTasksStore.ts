/**
 * 全局管理"算法部署任务"的 zustand store。
 *
 * 关键设计：
 * - submit() 立即返回 task；后台 fire-and-forget 订阅 NDJSON 流
 * - sessionStorage 持久化（页面刷新不丢失；不跨浏览器）
 * - transient 字段（AbortController）不持久化
 * - logLines 写入时限制 200 行，避免撑爆 sessionStorage
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { parseNDJSON } from '@/utils/ndjsonStream'

export type DeployStatus =
  | 'queued' | 'building' | 'starting' | 'running'
  | 'failed' | 'cancelled' | 'lost'

export interface DeployTask {
  taskId: string
  algorithmId: number
  algorithmName: string
  status: DeployStatus
  logLines: string[]
  result?: { port: number; image: string; containerId: string }
  error?: string
  startedAt: number
  finishedAt?: number
  /** transient —— 不持久化；用于中断 stream fetch */
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
  cancelStream: (taskId: string) => void
  removeTask: (taskId: string) => void
  toggleCollapsed: () => void
  _markFinished: (
    taskId: string,
    status: DeployStatus,
    result?: DeployTask['result'],
    error?: string,
  ) => void
  _appendLog: (taskId: string, line: string) => void
}

const STORAGE_KEY = 'deploy_tasks_v1'
const MAX_LOG_LINES_IN_MEMORY = 500
const MAX_LOG_LINES_PERSISTED = 200

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
          algorithmId,
          algorithmName,
          status: 'queued',
          logLines: [],
          startedAt: Date.now(),
          controller: new AbortController(),
        }
        set((s) => ({ tasks: { ...s.tasks, [task_id]: task } }))
        // 后台订阅流（fire-and-forget）
        subscribeStream(task_id, headers, get).catch((e) =>
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
              logLines: t.logLines.slice(-MAX_LOG_LINES_PERSISTED),
            },
          ]),
        ),
      }),
    },
  ),
)

async function subscribeStream(
  taskId: string,
  headers: Record<string, string>,
  get: () => DeployTasksState,
): Promise<void> {
  const state = get()
  const task = state.tasks[taskId]
  if (!task) return
  const url = `/api/algorithms/${task.algorithmId}/build/stream?task_id=${taskId}`
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
  try {
    for await (const evt of parseNDJSON<any>(resp, task.controller?.signal)) {
      if (evt.type === 'log' && typeof evt.line === 'string') {
        state._appendLog(taskId, evt.line)
      } else if (evt.type === 'status') {
        state._markFinished(taskId, evt.status, evt.result, evt.error)
      }
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    state._markFinished(taskId, 'failed', undefined, '流解析异常')
  }
}