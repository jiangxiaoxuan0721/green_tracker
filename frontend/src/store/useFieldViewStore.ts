/**
 * 地块页的视图记忆（zustand）：上次视角、上次选中的地块、以及「已取过哪些 bbox」。
 *
 * 由 Fields.jsx 的三个模块级变量（sessionView / sessionFetched / sessionOwner）搬来。
 * 搬的目的是让这份跨挂载的状态可被订阅、可被单测，并补上容量上限 ——
 * fetched 原先是一个只 push 不清的数组，看多久涨多久。
 *
 * 有意的不对称：
 * - view（视角 / 选中）**不设 TTL**。它是纯 UI 状态，不存在「过期」，切走一小时再回来
 *   也该还原 —— 这正是「切换页面保留状态」这条需求本身，加 TTL 等于把需求又改没了。
 * - fetched（已取 bbox）只设容量上限、不设 TTL，但它与几何缓存的存活并不一致：
 *   几何条目可能被 TTL / 淘汰清掉，而 bbox 记录还在。所以调用方短路前必须用
 *   useFieldGeometryStore.hasAll 复核（见 Fields.jsx loadViewport）。
 */
import { create } from 'zustand'
import { useFieldGeometryStore } from './useFieldGeometryStore'
import type { Bbox } from '@/utils/geo/cluster'

export interface FieldViewSnapshot {
  center?: [number, number]
  zoom?: number
  selectedPlotId: string | null
}

/** 一次成功取数的登记：该 bbox 命中过哪些地块 */
export interface FetchedRecord {
  bbox: Bbox
  ids: string[]
}

/** 已取 bbox 记录的上限，超出后丢弃最旧的（会导致那片区域重新请求一次，代价可接受） */
export const FETCHED_MAX_RECORDS = 50

export interface FieldViewState {
  /** 这批记忆属于哪个账号；null 表示尚未登记 */
  owner: string | null
  view: FieldViewSnapshot | null
  fetched: FetchedRecord[]
  /**
   * 换账号保护（裁决）：单页应用里登出再登入不会重载 bundle，记忆会原样留到下一个账号，
   * 于是新账号会看到上一个账号的图斑（几何是逐顶点缓存的，比列表泄露更实）。
   *
   * 只在「已登记过 owner 且对不上」时才真的清空 —— 首次进入（owner 为 null）什么都不做，
   * 因此本函数是纯读路径，可在 render 期间安全调用（写 store 会触发渲染期更新警告）。
   * 登记 owner 请用 commitOwner（放在 effect 里）。
   */
  syncOwner: (uid: string | null) => void
  /** 登记当前账号。只在 effect 里调用，避免 render 期间写 store */
  commitOwner: (uid: string | null) => void
  /** 局部更新视角 / 选中。view 为 null 时以 selectedPlotId=null 起底 */
  patchView: (patch: Partial<FieldViewSnapshot>) => void
  addFetched: (rec: FetchedRecord) => void
  clearFetched: () => void
}

export const useFieldViewStore = create<FieldViewState>((set, get) => ({
  owner: null,
  view: null,
  fetched: [],

  syncOwner: (uid) => {
    const { owner } = get()
    if (owner === null || owner === uid) return
    useFieldGeometryStore.getState().reset()
    set({ view: null, fetched: [] })
  },

  commitOwner: (uid) => {
    if (get().owner !== uid) set({ owner: uid })
  },

  patchView: (patch) =>
    set((s) => ({
      view: s.view ? { ...s.view, ...patch } : { selectedPlotId: null, ...patch },
    })),

  addFetched: (rec) =>
    set((s) => {
      const next = [...s.fetched, rec]
      if (next.length <= FETCHED_MAX_RECORDS) return { fetched: next }
      return { fetched: next.slice(next.length - FETCHED_MAX_RECORDS) }
    }),

  clearFetched: () => set({ fetched: [] }),
}))
