import { describe, it, expect } from 'vitest'
import { parseWKT, toWKT, centroidOf, boundsOf, areaOf } from './wkt'
import type { LngLat } from './types'

const SQUARE_WKT =
  'POLYGON((116.0000 39.9000, 116.0010 39.9000, 116.0010 39.9010, 116.0000 39.9010, 116.0000 39.9000))'

describe('parseWKT', () => {
  it('parses an explicit POLYGON ring', () => {
    const ring = parseWKT(SQUARE_WKT)
    expect(ring).not.toBeNull()
    expect(ring![0]).toEqual([116.0, 39.9])
    expect(ring![2]).toEqual([116.001, 39.901])
  })

  it('drops the duplicated closing vertex', () => {
    expect(parseWKT(SQUARE_WKT)).toHaveLength(4)
  })

  it('is case-insensitive and tolerates extra whitespace', () => {
    expect(parseWKT('polygon( ( 116.0 39.9 , 116.1 39.9 , 116.1 40.0 ) )')).toHaveLength(3)
  })

  it('returns null for empty or malformed input', () => {
    expect(parseWKT('')).toBeNull()
    expect(parseWKT('POINT(116 39)')).toBeNull()
    expect(parseWKT('POLYGON((1 2))')).toBeNull()
  })
})

describe('toWKT', () => {
  it('round-trips through parseWKT', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
    ]
    expect(parseWKT(toWKT(ring))).toEqual(ring)
  })

  it('closes the ring by repeating the first vertex', () => {
    const wkt = toWKT([
      [116.0, 39.9],
      [116.1, 39.9],
      [116.1, 40.0],
    ])
    expect(wkt.endsWith('116 39.9))')).toBe(true)
  })
})

describe('centroidOf', () => {
  it('returns the center of a symmetric square', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
      [116.0, 39.901],
    ]
    const c = centroidOf(ring)
    expect(c[0]).toBeCloseTo(116.0005, 6)
    expect(c[1]).toBeCloseTo(39.9005, 6)
  })

  it('falls back to the vertex mean for a degenerate ring', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
    ]
    expect(centroidOf(ring)[0]).toBeCloseTo(116.0005, 6)
  })
})

describe('boundsOf', () => {
  it('returns [[minLng,minLat],[maxLng,maxLat]]', () => {
    const ring: LngLat[] = [
      [116.5, 40.2],
      [116.1, 39.9],
      [116.9, 40.0],
    ]
    expect(boundsOf(ring)).toEqual([
      [116.1, 39.9],
      [116.9, 40.2],
    ])
  })
})

describe('areaOf', () => {
  it('approximates a ~85m x ~111m square at lat 39.9 as ~9500 m2', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
      [116.0, 39.901],
    ]
    expect(areaOf(ring)).toBeGreaterThan(9300)
    expect(areaOf(ring)).toBeLessThan(9700)
  })

  it('is orientation independent', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
      [116.0, 39.901],
    ]
    expect(areaOf(ring)).toBeCloseTo(areaOf([...ring].reverse()), 3)
  })
})
