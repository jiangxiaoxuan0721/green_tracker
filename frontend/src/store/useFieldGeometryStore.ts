/**
 * 地块几何缓存（zustand）。
 *
 * 由 useFieldGeometry.ts 的模块级 SESSION_CACHE 搬来。原先那是一个「永不失效、无上限」
 * 的 Map —— 严格说不是缓存，是记忆：它赌「地块只在本页被改、且不刷新浏览器」，
 * 于是一直在地图上平移缩放，条目就一直涨，也从不过期。这里补上真缓存该有的两件事：
 *
 * 1. TTL：超过 GEOMETRY_TTL_MS 的条目视为未命中，调用方会重新拉取。
 * 2. 容量上限：超过 GEOMETRY_MAX_ENTRIES 时按写入时间淘汰最旧的。
 *
 * 为什么按写入时间（FIFO）而不是严格 LRU：ringOf 是读路径，若每次读都回写
 * 「最近使用时间」，一次只读的 render 也会 set store —— 既多余，又可能在 render
 * 期间触发 setState 警告。故以写入时间近似「最久未更新」，足够兜住无界增长。
 *
 * 关键连带影响：TTL / 淘汰会让「bbox 登记在案、但其中部分 id 已不在缓存里」成为常态。
 * 调用方（Fields.jsx）在按 bbox 短路免请求前必须用 hasAll 复核，否则会命中短路、
 * 不发起请求，而 ringsOf 又全部落空 —— 地图一片空白，请求数却是 0，极难排查。
 */
import { create } from 'zustand'
import { parseWKT, type LngLat } from '@/utils/geo'

export interface RingEntry {
  ring: LngLat[]
  /** 写入时间戳（ms）。TTL 与容量淘汰都只认它，读取不更新 */
  at: number
}

export type RingCache = Map<string, RingEntry>

/** 超过这个时长的条目视为过期。10 分钟：够覆盖一轮巡查，又不至于长期抱着陈旧几何 */
export const GEOMETRY_TTL_MS = 10 * 60 * 1000
/** 缓存条目上限，超出后淘汰最旧的 */
export const GEOMETRY_MAX_ENTRIES = 500

/**
 * 纯函数：丢弃过期条目，再按写入时间淘汰超出上限的部分。
 * 无任何变化时返回原引用（避免无意义的重渲染）。
 * 参数 ttl / max 仅用于测试注入，生产走默认常量。
 */
export const pruneCache = (
  cache: RingCache,
  now: number,
  ttl: number = GEOMETRY_TTL_MS,
  max: number = GEOMETRY_MAX_ENTRIES
): RingCache => {
  let changed = false
  const next: RingCache = new Map()
  cache.forEach((entry, id) => {
    if (now - entry.at > ttl) {
      changed = true
      return
    }
    next.set(id, entry)
  })

  if (next.size > max) {
    const overflow = [...next.entries()]
      .sort((a, b) => a[1].at - b[1].at)
      .slice(0, next.size - max)
    overflow.forEach(([id]) => next.delete(id))
    changed = true
  }

  return changed ? next : cache
}

export interface FieldGeometryState {
  cache: RingCache
  /** 每次写操作自增。ringOf / hasAll 是读路径、走 getState()，不订阅本字段 */
  version: number
  put: (id: string, wkt?: string | null) => void
  /** 批量写入（视野请求一次回来几十条），只自增一次 version */
  putMany: (rows: Array<{ id: string; location_wkt?: string | null }>) => void
  /** 读取；不存在或已过期返回 undefined（过期条目不在此删除，交给写路径的 prune） */
  ringOf: (id: string) => LngLat[] | undefined
  /** ids 是否全部命中且未过期。短路免请求前必须用它复核 */
  hasAll: (ids: string[]) => boolean
  /** 失效：传 id 删单条，不传则清空 */
  invalidate: (id?: string) => void
  /** 换账号时清空，避免新账号看到上一个账号的图斑 */
  reset: () => void
}

export const useFieldGeometryStore = create<FieldGeometryState>((set, get) => {
  /**
   * 统一的写入口：复制一份 -> 应用变更 -> prune -> 提交并自增 version。
   * 复制而非就地改，是为了让 zustand 的引用比较能感知到变化。
   */
  const commit = (mutate: (next: RingCache) => void) => {
    const next = new Map(get().cache)
    mutate(next)
    set({ cache: pruneCache(next, Date.now()), version: get().version + 1 })
  }

  const parseRing = (wkt?: string | null): LngLat[] | null => {
    if (!wkt) return null
    return parseWKT(wkt)
  }

  return {
    cache: new Map(),
    version: 0,

    put: (id, wkt) => {
      const ring = parseRing(wkt)
      if (!ring) return
      commit((next) => {
        next.set(id, { ring, at: Date.now() })
      })
    },

    putMany: (rows) => {
      const now = Date.now()
      const parsed = rows
        .map((r) => ({ id: r.id, ring: parseRing(r.location_wkt) }))
        .filter((r): r is { id: string; ring: LngLat[] } => Boolean(r.ring))
      if (!parsed.length) return
      commit((next) => {
        parsed.forEach(({ id, ring }) => next.set(id, { ring, at: now }))
      })
    },

    ringOf: (id) => {
      const entry = get().cache.get(id)
      if (!entry) return undefined
      if (Date.now() - entry.at > GEOMETRY_TTL_MS) return undefined
      return entry.ring
    },

    hasAll: (ids) => {
      const { cache } = get()
      const now = Date.now()
      return ids.every((id) => {
        const entry = cache.get(id)
        return Boolean(entry) && now - (entry as RingEntry).at <= GEOMETRY_TTL_MS
      })
    },

    invalidate: (id) => {
      commit((next) => {
        if (id) next.delete(id)
        else next.clear()
      })
    },

    reset: () => {
      commit((next) => {
        next.clear()
      })
    },
  }
})
