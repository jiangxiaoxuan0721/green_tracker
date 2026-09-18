/**
 * 几何缓存的 TTL 与容量上限。
 *
 * 这两条是本次「真缓存化」新增的全部约束，也是唯一可能在生产上静默出错的地方：
 * 淘汰过头 → 每次平移都重拉（退化成没缓存）；淘汰不到位 → 无界增长（老毛病）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LngLat } from '@/utils/geo'
import {
  GEOMETRY_MAX_ENTRIES,
  GEOMETRY_TTL_MS,
  pruneCache,
  useFieldGeometryStore,
  type RingCache,
} from './useFieldGeometryStore'

const SQUARE = 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'
const RING: LngLat[] = [
  [0, 0],
  [1, 0],
  [1, 1],
]

const entry = (at: number) => ({ ring: RING, at })

describe('pruneCache', () => {
  it('丢弃过期条目，保留未过期的', () => {
    const now = 1_000_000
    const cache: RingCache = new Map([
      ['old', entry(now - GEOMETRY_TTL_MS - 1)],
      ['fresh', entry(now)],
    ])
    const next = pruneCache(cache, now)
    expect(next.has('old')).toBe(false)
    expect(next.has('fresh')).toBe(true)
  })

  it('按写入时间淘汰超出上限的（FIFO）', () => {
    const now = 1_000_000
    const cache: RingCache = new Map([
      ['a', entry(now - 300)],
      ['b', entry(now - 200)],
      ['c', entry(now - 100)],
    ])
    const next = pruneCache(cache, now, GEOMETRY_TTL_MS, 2)
    expect([...next.keys()]).toEqual(['b', 'c'])
  })

  it('无变化时返回原引用，避免无意义重渲染', () => {
    const cache: RingCache = new Map([['a', entry(1_000_000)]])
    expect(pruneCache(cache, 1_000_000)).toBe(cache)
  })
})

describe('useFieldGeometryStore', () => {
  beforeEach(() => {
    useFieldGeometryStore.getState().reset()
  })

  it('写入后可同步读出', () => {
    useFieldGeometryStore.getState().put('a', SQUARE)
    expect(useFieldGeometryStore.getState().ringOf('a')).toHaveLength(4)
  })

  it('无 WKT 或解析失败时不写入', () => {
    useFieldGeometryStore.getState().put('a', null)
    useFieldGeometryStore.getState().put('b', 'NOT A POLYGON')
    expect(useFieldGeometryStore.getState().cache.size).toBe(0)
  })

  it('超过 TTL 视为未命中', () => {
    vi.useFakeTimers()
    try {
      useFieldGeometryStore.getState().put('a', SQUARE)
      expect(useFieldGeometryStore.getState().ringOf('a')).toBeDefined()
      vi.advanceTimersByTime(GEOMETRY_TTL_MS + 1)
      expect(useFieldGeometryStore.getState().ringOf('a')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('容量上限：超出后淘汰最旧的', () => {
    const total = GEOMETRY_MAX_ENTRIES + 5
    for (let i = 0; i < total; i += 1) {
      useFieldGeometryStore.getState().put(`id-${i}`, SQUARE)
    }
    const { cache } = useFieldGeometryStore.getState()
    expect(cache.size).toBe(GEOMETRY_MAX_ENTRIES)
    expect(cache.has('id-0')).toBe(false)
    expect(cache.has(`id-${total - 1}`)).toBe(true)
  })

  it('hasAll：ids 全部命中且未过期才为真', () => {
    const store = useFieldGeometryStore.getState()
    store.put('a', SQUARE)
    store.put('b', SQUARE)
    expect(useFieldGeometryStore.getState().hasAll(['a', 'b'])).toBe(true)
    // 少一条就要重新请求 —— 否则会命中短路、既不请求也不渲染（空白地图）
    expect(useFieldGeometryStore.getState().hasAll(['a', 'missing'])).toBe(false)
  })

  it('hasAll：过期的 id 算未命中', () => {
    vi.useFakeTimers()
    try {
      useFieldGeometryStore.getState().put('a', SQUARE)
      useFieldGeometryStore.getState().put('b', SQUARE)
      vi.advanceTimersByTime(GEOMETRY_TTL_MS + 1)
      expect(useFieldGeometryStore.getState().hasAll(['a', 'b'])).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('invalidate 传 id 只删单条，不传则清空', () => {
    const store = useFieldGeometryStore.getState()
    store.put('a', SQUARE)
    store.put('b', SQUARE)
    useFieldGeometryStore.getState().invalidate('a')
    expect(useFieldGeometryStore.getState().cache.has('a')).toBe(false)
    expect(useFieldGeometryStore.getState().cache.has('b')).toBe(true)

    useFieldGeometryStore.getState().invalidate()
    expect(useFieldGeometryStore.getState().cache.size).toBe(0)
  })

  it('putMany 批量写入且只自增一次 version', () => {
    const before = useFieldGeometryStore.getState().version
    useFieldGeometryStore
      .getState()
      .putMany([
        { id: 'a', location_wkt: SQUARE },
        { id: 'b', location_wkt: SQUARE },
      ])
    expect(useFieldGeometryStore.getState().version).toBe(before + 1)
    expect(useFieldGeometryStore.getState().hasAll(['a', 'b'])).toBe(true)
  })
})
