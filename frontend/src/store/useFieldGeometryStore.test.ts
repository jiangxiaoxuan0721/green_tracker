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

  it('先清过期、再判容量 —— 过期腾出的名额留给新条目', () => {
    const now = 1_000_000
    // a 已过期；b / c / d 都还新鲜，但 3 条 > max 2，于是再淘汰其中最旧的 b
    const cache: RingCache = new Map([
      ['a', entry(now - GEOMETRY_TTL_MS - 1)],
      ['b', entry(now - 300)],
      ['c', entry(now - 200)],
      ['d', entry(now - 100)],
    ])
    const next = pruneCache(cache, now, GEOMETRY_TTL_MS, 2)
    expect([...next.keys()]).toEqual(['c', 'd'])
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

  it('刚好到 TTL 仍算命中，越过一毫秒才失效（判定是 > 而非 >=）', () => {
    vi.useFakeTimers()
    try {
      useFieldGeometryStore.getState().put('a', SQUARE)
      vi.advanceTimersByTime(GEOMETRY_TTL_MS)
      expect(useFieldGeometryStore.getState().ringOf('a')).toBeDefined()
      vi.advanceTimersByTime(1)
      expect(useFieldGeometryStore.getState().ringOf('a')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('过期条目只在写路径清理：读不删，下次写入才 prune', () => {
    vi.useFakeTimers()
    try {
      useFieldGeometryStore.getState().put('a', SQUARE)
      useFieldGeometryStore.getState().put('b', SQUARE)
      vi.advanceTimersByTime(GEOMETRY_TTL_MS + 1)
      // 读路径只判定、不清理（ringOf 走 getState，不写 store）
      expect(useFieldGeometryStore.getState().ringOf('a')).toBeUndefined()
      expect(useFieldGeometryStore.getState().cache.size).toBe(2)

      useFieldGeometryStore.getState().put('c', SQUARE)
      expect(useFieldGeometryStore.getState().cache.size).toBe(1)
      expect(useFieldGeometryStore.getState().cache.has('c')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('FIFO：读取不续命，反复读也不能让旧条目免于淘汰', () => {
    // 读路径刻意不回写 at（否则一次只读的 render 就会写 store，还会在 render 期间
    // 触发 setState 警告）。把「读不续命」锁住：哪天真改成 LRU，这条会红。
    useFieldGeometryStore.getState().put('old', SQUARE)
    for (let i = 0; i < GEOMETRY_MAX_ENTRIES; i += 1) {
      expect(useFieldGeometryStore.getState().ringOf('old')).toBeDefined()
      useFieldGeometryStore.getState().put(`id-${i}`, SQUARE)
    }
    expect(useFieldGeometryStore.getState().cache.has('old')).toBe(false)
  })

  it('未达上限时一条都不淘汰', () => {
    const total = GEOMETRY_MAX_ENTRIES - 1
    for (let i = 0; i < total; i += 1) {
      useFieldGeometryStore.getState().put(`id-${i}`, SQUARE)
    }
    const { cache } = useFieldGeometryStore.getState()
    expect(cache.size).toBe(total)
    expect(cache.has('id-0')).toBe(true)
  })

  it('reset 清空全部几何（换账号时调用）', () => {
    useFieldGeometryStore.getState().putMany([
      { id: 'a', location_wkt: SQUARE },
      { id: 'b', location_wkt: SQUARE },
    ])
    expect(useFieldGeometryStore.getState().cache.size).toBe(2)

    useFieldGeometryStore.getState().reset()

    expect(useFieldGeometryStore.getState().cache.size).toBe(0)
    expect(useFieldGeometryStore.getState().ringOf('a')).toBeUndefined()
    // 清空后 hasAll 仍须报未命中，而不是对空集合返回 true 让调用方短路
    expect(useFieldGeometryStore.getState().hasAll(['a'])).toBe(false)
  })

  it('putMany 全是空 WKT 时不写入、也不自增 version', () => {
    const before = useFieldGeometryStore.getState().version
    useFieldGeometryStore.getState().putMany([{ id: 'a' }, { id: 'b', location_wkt: null }])
    expect(useFieldGeometryStore.getState().cache.size).toBe(0)
    expect(useFieldGeometryStore.getState().version).toBe(before)
  })

  it('hasAll 对空 id 列表为真（没有需要复核的，即视为全部命中）', () => {
    expect(useFieldGeometryStore.getState().hasAll([])).toBe(true)
  })
})
