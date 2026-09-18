/**
 * 远程控制台会话 store（zustand + localStorage 持久化）
 *
 * 关键设计：
 * - 以 deviceId 为单位保存控制台会话：执行记录、展开项、预设命令参数、命令行输入历史
 *   离开控制台去做别的事、再回来（乃至刷新浏览器）都保持同一段会话，而不是重新开始
 * - pending 条目保留后端 command_id，组件重新挂载时可据此续轮询，把中断的结果接回来
 * - entries 有 MAX_ENTRIES 上限、命令行历史有 MAX_INPUT_HISTORY 上限，避免撑爆 localStorage
 * - 右栏宽度（拖拽结果）也放在这里，跨页面/刷新保持
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type JournalStatus = 'pending' | 'acknowledged' | 'timeout' | 'error'

export interface JournalEntry {
  id: string
  command: string
  params?: Record<string, unknown>
  /** 后端 command_id；pending 条目据此续轮询（发送失败时可能缺失） */
  commandId?: string
  timestamp: string
  status: JournalStatus
  response?: unknown
  respondedAt?: string
  /** 'shell' = 命令行输入；'preset' = 预设命令按钮 */
  source?: 'preset' | 'shell'
  /** 命令行输入的原文，记录面板按原文回显 */
  display?: string
}

export interface RemoteControlSession {
  /** 最新在前 */
  entries: JournalEntry[]
  expandedIds: string[]
  /** { commandId: { fieldName: stringValue } } */
  paramValues: Record<string, Record<string, string>>
  /** 命令行输入历史，最新在前 */
  inputHistory: string[]
}

export const MAX_ENTRIES = 100
export const MAX_INPUT_HISTORY = 50
export const DEFAULT_PRESET_WIDTH = 320

interface RemoteControlState {
  sessions: Record<string, RemoteControlSession>
  /** 右侧「预设命令」面板宽度（px） */
  presetWidth: number

  appendEntry: (deviceId: string, entry: JournalEntry) => void
  updateEntry: (deviceId: string, entryId: string, patch: Partial<JournalEntry>) => void
  /** 终态更新（已回复 / 超时 / 失败）：更新条目并自动展开结果 */
  resolveEntry: (
    deviceId: string,
    entryId: string,
    patch: Pick<JournalEntry, 'status' | 'response' | 'respondedAt'>,
  ) => void
  clearEntries: (deviceId: string) => void
  toggleExpanded: (deviceId: string, entryId: string) => void
  setParamValue: (deviceId: string, commandId: string, field: string, value: string) => void
  pushInput: (deviceId: string, line: string) => void
  setPresetWidth: (width: number) => void
}

const emptySession = (): RemoteControlSession => ({
  entries: [],
  expandedIds: [],
  paramValues: {},
  inputHistory: [],
})

/** 保证 sessions[deviceId] 一定存在，返回新 map */
const withSession = (
  sessions: Record<string, RemoteControlSession>,
  deviceId: string,
  update: Partial<RemoteControlSession>,
): Record<string, RemoteControlSession> => ({
  ...sessions,
  [deviceId]: {
    ...emptySession(),
    ...(sessions[deviceId] || {}),
    ...update,
  },
})

const mapEntry = (
  sessions: Record<string, RemoteControlSession>,
  deviceId: string,
  entryId: string,
  mapper: (entry: JournalEntry) => JournalEntry,
): Record<string, RemoteControlSession> =>
  withSession(sessions, deviceId, {
    entries: (sessions[deviceId]?.entries || []).map((e) => (e.id === entryId ? mapper(e) : e)),
  })

export const useRemoteControlStore = create<RemoteControlState>()(
  persist(
    (set) => ({
      sessions: {},
      presetWidth: DEFAULT_PRESET_WIDTH,

      // 注意：withSession/mapEntry 返回的是「新 sessions 映射表」，
      // 必须包一层 { sessions } 再交给 set —— 否则 set 会把 deviceId
      // 当作顶层 state 键合并进去，sessions 永远不变（控制台不回显）。
      appendEntry: (deviceId, entry) =>
        set((state) => ({
          sessions: withSession(state.sessions, deviceId, {
            entries: [entry, ...(state.sessions[deviceId]?.entries || [])].slice(0, MAX_ENTRIES),
          }),
        })),

      updateEntry: (deviceId, entryId, patch) =>
        set((state) => ({
          sessions: mapEntry(state.sessions, deviceId, entryId, (e) => ({ ...e, ...patch })),
        })),

      resolveEntry: (deviceId, entryId, patch) =>
        set((state) => {
          const current = state.sessions[deviceId]?.entries || []
          const expanded = new Set(state.sessions[deviceId]?.expandedIds || [])
          expanded.add(entryId)
          return {
            sessions: withSession(state.sessions, deviceId, {
              entries: current.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
              expandedIds: Array.from(expanded),
            }),
          }
        }),

      clearEntries: (deviceId) =>
        set((state) => ({
          sessions: withSession(state.sessions, deviceId, { entries: [], expandedIds: [] }),
        })),

      toggleExpanded: (deviceId, entryId) =>
        set((state) => {
          const next = new Set(state.sessions[deviceId]?.expandedIds || [])
          if (next.has(entryId)) next.delete(entryId)
          else next.add(entryId)
          return {
            sessions: withSession(state.sessions, deviceId, { expandedIds: Array.from(next) }),
          }
        }),

      setParamValue: (deviceId, commandId, field, value) =>
        set((state) => ({
          sessions: withSession(state.sessions, deviceId, {
            paramValues: {
              ...(state.sessions[deviceId]?.paramValues || {}),
              [commandId]: {
                ...(state.sessions[deviceId]?.paramValues?.[commandId] || {}),
                [field]: value,
              },
            },
          }),
        })),

      pushInput: (deviceId, line) =>
        set((state) => ({
          sessions: withSession(state.sessions, deviceId, {
            inputHistory: [
              line,
              ...(state.sessions[deviceId]?.inputHistory || []).filter((h) => h !== line),
            ].slice(0, MAX_INPUT_HISTORY),
          }),
        })),

      setPresetWidth: (width) => set({ presetWidth: width }),
    }),
    {
      name: 'green-tracker-remote-control',
      version: 1,
    },
  ),
)

export default useRemoteControlStore
