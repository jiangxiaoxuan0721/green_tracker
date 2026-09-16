import { describe, it, expect } from 'vitest'
import { diffMissingIds, type RingCache } from './useFieldGeometry'
import type { LngLat } from '@/utils/geo'

describe('diffMissingIds', () => {
  it('returns only ids not already cached', () => {
    const cached: RingCache = new Map([['a', [[0, 0]] as LngLat[]]])
    expect(diffMissingIds(['a', 'b', 'c'], cached)).toEqual(['b', 'c'])
  })

  it('returns an empty array when everything is cached', () => {
    const cached: RingCache = new Map([['a', [[0, 0]] as LngLat[]]])
    expect(diffMissingIds(['a'], cached)).toEqual([])
  })

  it('treats a missing cache entry as needing a fetch', () => {
    const cached: RingCache = new Map<string, LngLat[]>()
    expect(diffMissingIds(['a'], cached)).toEqual(['a'])
  })
})
