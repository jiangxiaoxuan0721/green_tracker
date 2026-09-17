import { describe, it, expect, vi, afterEach } from 'vitest'
import type { LngLat } from './types'

const BEIJING: LngLat = [116.397428, 39.90923]
const TOKYO: LngLat = [139.7003, 35.6595]

const loadCrs = async (crs: 'wgs84' | 'gcj02') => {
  vi.resetModules()
  vi.stubEnv('VITE_FIELD_SOURCE_CRS', crs)
  return import('./crs')
}

/** 两点球面距离（米），用于断言偏移量级 */
const distanceM = (a: LngLat, b: LngLat): number => {
  const R = 6378137
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const lat = ((a[1] + b[1]) / 2) * rad
  return Math.hypot(dLng * Math.cos(lat), dLat) * R
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('wgs84ToGcj02', () => {
  it('round-trips wgs84 -> gcj02 -> wgs84 within 1e-6 deg', async () => {
    const { wgs84ToGcj02, gcj02ToWgs84 } = await loadCrs('wgs84')
    const back = gcj02ToWgs84(wgs84ToGcj02(BEIJING))
    expect(back[0]).toBeCloseTo(BEIJING[0], 6)
    expect(back[1]).toBeCloseTo(BEIJING[1], 6)
  })

  it('shifts a Beijing coordinate by 100m~1000m', async () => {
    const { wgs84ToGcj02 } = await loadCrs('wgs84')
    const d = distanceM(BEIJING, wgs84ToGcj02(BEIJING))
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(1000)
  })

  it('leaves coordinates outside China untouched', async () => {
    const { wgs84ToGcj02, gcj02ToWgs84 } = await loadCrs('wgs84')
    expect(gcj02ToWgs84(wgs84ToGcj02(TOKYO))).toEqual(TOKYO)
  })
})

describe('toDisplay / toStorage', () => {
  it('toDisplay applies the transform when source is wgs84', async () => {
    const { toDisplay } = await loadCrs('wgs84')
    expect(toDisplay(BEIJING)).not.toEqual(BEIJING)
  })

  it('toDisplay is identity when source is gcj02', async () => {
    const { toDisplay } = await loadCrs('gcj02')
    expect(toDisplay(BEIJING)).toEqual(BEIJING)
  })

  it('toStorage reverses toDisplay', async () => {
    const { toDisplay, toStorage } = await loadCrs('wgs84')
    const shown = toDisplay(BEIJING)
    expect(toStorage(shown)[0]).toBeCloseTo(BEIJING[0], 6)
    expect(toStorage(shown)[1]).toBeCloseTo(BEIJING[1], 6)
  })

  it('toDisplayRing / toStorageRing map over every vertex', async () => {
    const { toDisplayRing, toStorageRing } = await loadCrs('wgs84')
    const ring: LngLat[] = [BEIJING, [116.4, 39.91], [116.39, 39.9]]
    const shown = toDisplayRing(ring)
    expect(shown).toHaveLength(3)
    const back = toStorageRing(shown)
    back.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(ring[i][0], 6)
      expect(p[1]).toBeCloseTo(ring[i][1], 6)
    })
  })
})
