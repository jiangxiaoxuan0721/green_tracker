import { describe, it, expect } from 'vitest'
import { diffMissingIds, type RingCache } from './useFieldGeometry'
import type { LngLat } from '@/utils/geo'

/** 构造一条缓存条目。RingCache 的值现在是带写入时间的 RingEntry（供 TTL / 容量淘汰用） */
const entry = (ring: LngLat[]) => ({ ring, at: Date.now() })

describe('diffMissingIds', () => {
  it('returns only ids not already cached', () => {
    const cached: RingCache = new Map([['a', entry([[0, 0]] as LngLat[])]])
    expect(diffMissingIds(['a', 'b', 'c'], cached)).toEqual(['b', 'c'])
  })

  it('returns an empty array when everything is cached', () => {
    const cached: RingCache = new Map([['a', entry([[0, 0]] as LngLat[])]])
    expect(diffMissingIds(['a'], cached)).toEqual([])
  })

  it('treats a missing cache entry as needing a fetch', () => {
    const cached: RingCache = new Map()
    expect(diffMissingIds(['a'], cached)).toEqual(['a'])
  })
})
