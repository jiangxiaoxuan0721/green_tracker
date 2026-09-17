import type { Bounds, LngLat } from './types'

export interface Bbox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export interface ClusterItem {
  id: string
  centroid: LngLat
}

export interface Cluster {
  /** 网格键，稳定且可用于 React key / 增量 diff */
  key: string
  lng: number
  lat: number
  count: number
  ids: string[]
}

/**
 * 屏幕空间网格聚合：按 cellPx 把投影后的点分桶。
 * 不依赖任何地图库，project 由调用方注入（高德的 map.lngLatToContainer）。
 */
export const clusterInScreenSpace = (
  items: ClusterItem[],
  project: (p: LngLat) => [number, number],
  cellPx: number
): Cluster[] => {
  const buckets = new Map<string, { sx: number; sy: number; count: number; ids: string[] }>()

  for (const item of items) {
    if (!item.centroid || item.centroid.length !== 2) continue
    const [px, py] = project(item.centroid)
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue
    const key = `${Math.floor(px / cellPx)}:${Math.floor(py / cellPx)}`
    const bucket = buckets.get(key) ?? { sx: 0, sy: 0, count: 0, ids: [] }
    bucket.sx += item.centroid[0]
    bucket.sy += item.centroid[1]
    bucket.count += 1
    bucket.ids.push(item.id)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries()).map(([key, b]) => ({
    key,
    lng: b.sx / b.count,
    lat: b.sy / b.count,
    count: b.count,
    ids: b.ids,
  }))
}

export const boundsToBbox = ([[minLng, minLat], [maxLng, maxLat]]: Bounds): Bbox => ({
  minLng,
  minLat,
  maxLng,
  maxLat,
})

/**
 * 按 ratio 外扩：结果尺寸 = 原尺寸 * (1 + ratio)，即每侧各 pad = 尺寸 * ratio / 2。
 * 纬度钳制在 [-90, 90]，经度钳制在 [-180, 180]。
 */
export const expandBbox = (b: Bbox, ratio: number): Bbox => {
  const padLng = ((b.maxLng - b.minLng) * ratio) / 2
  const padLat = ((b.maxLat - b.minLat) * ratio) / 2
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    minLng: clamp(b.minLng - padLng, -180, 180),
    minLat: clamp(b.minLat - padLat, -90, 90),
    maxLng: clamp(b.maxLng + padLng, -180, 180),
    maxLat: clamp(b.maxLat + padLat, -90, 90),
  }
}

export const isBboxValid = (b: Bbox): boolean =>
  [b.minLng, b.minLat, b.maxLng, b.maxLat].every((v) => Number.isFinite(v)) &&
  b.minLng < b.maxLng &&
  b.minLat < b.maxLat &&
  b.minLat >= -90 &&
  b.maxLat <= 90 &&
  b.minLng >= -180 &&
  b.maxLng <= 180
