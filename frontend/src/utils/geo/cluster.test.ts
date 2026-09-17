import { describe, it, expect } from 'vitest'
import { clusterInScreenSpace, boundsToBbox, expandBbox, isBboxValid, type Bbox } from './cluster'
import type { LngLat } from './types'

/** 恒等投影：把经纬度当作像素坐标使用，便于断言 */
const identity = (p: LngLat): [number, number] => [p[0], p[1]]

describe('clusterInScreenSpace', () => {
  it('merges items falling in the same grid cell', () => {
    const items = [
      { id: 'a', centroid: [0, 0] as LngLat },
      { id: 'b', centroid: [2, 2] as LngLat },
      { id: 'c', centroid: [100, 100] as LngLat },
    ]
    const clusters = clusterInScreenSpace(items, identity, 44)
    expect(clusters).toHaveLength(2)
    expect(clusters[0]).toMatchObject({ count: 2 })
    expect(clusters[0].ids.sort()).toEqual(['a', 'b'])
    expect(clusters[1]).toMatchObject({ count: 1 })
  })

  it('places the cluster at the mean of its members', () => {
    const items = [
      { id: 'a', centroid: [0, 0] as LngLat },
      { id: 'b', centroid: [10, 10] as LngLat },
    ]
    const [c] = clusterInScreenSpace(items, identity, 44)
    expect(c.lng).toBeCloseTo(5, 6)
    expect(c.lat).toBeCloseTo(5, 6)
  })

  it('returns an empty array for no items', () => {
    expect(clusterInScreenSpace([], identity, 44)).toEqual([])
  })
})

describe('boundsToBbox', () => {
  it('converts [[minLng,minLat],[maxLng,maxLat]] to a Bbox', () => {
    expect(boundsToBbox([[1, 2], [3, 4]])).toEqual({ minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 })
  })
})

describe('expandBbox', () => {
  it('grows the box by the ratio, split across both sides', () => {
    const b: Bbox = { minLng: 0, minLat: 0, maxLng: 10, maxLat: 10 }
    expect(expandBbox(b, 0.2)).toEqual({ minLng: -1, minLat: -1, maxLng: 11, maxLat: 11 })
  })

  it('clamps latitude to [-90, 90]', () => {
    const b: Bbox = { minLng: 0, minLat: 85, maxLng: 10, maxLat: 90 }
    expect(expandBbox(b, 0.2).maxLat).toBe(90)
  })

  it('is a no-op when ratio is 0', () => {
    const b: Bbox = { minLng: 0, minLat: 0, maxLng: 10, maxLat: 10 }
    expect(expandBbox(b, 0)).toEqual(b)
  })
})

describe('isBboxValid', () => {
  it('accepts a well-formed box', () => {
    expect(isBboxValid({ minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 })).toBe(true)
  })

  it('rejects inverted or out-of-range boxes', () => {
    expect(isBboxValid({ minLng: 5, minLat: 2, maxLng: 3, maxLat: 4 })).toBe(false)
    expect(isBboxValid({ minLng: 1, minLat: 4, maxLng: 3, maxLat: 2 })).toBe(false)
    expect(isBboxValid({ minLng: 1, minLat: 91, maxLng: 3, maxLat: 92 })).toBe(false)
  })
})
