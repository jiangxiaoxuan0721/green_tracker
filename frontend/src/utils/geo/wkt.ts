// LngLat / Bounds 定义于 types.ts（Task 2），此处只导入、不再重复声明，
// 避免 index.ts 的 `export *` 产生同名重复导出。
import type { Bounds, LngLat } from './types'

const RAD = Math.PI / 180
/** WGS84 长半轴，用于面积近似 */
const EARTH_R = 6378137

/**
 * 解析 'POLYGON((lng lat, ...))'，只取外环。
 * 自动去掉与首点重复的闭合点；非法输入返回 null。
 */
export const parseWKT = (wkt: string): LngLat[] | null => {
  if (!wkt) return null
  const match = /POLYGON\s*\(\s*\(([^)]*)\)/i.exec(wkt)
  if (!match) return null

  const ring = match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [lng, lat] = s.split(/\s+/).map(Number)
      return [lng, lat] as LngLat
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))

  if (ring.length < 3) return null

  const [firstLng, firstLat] = ring[0]
  const [lastLng, lastLat] = ring[ring.length - 1]
  if (firstLng === lastLng && firstLat === lastLat) ring.pop()

  return ring.length >= 3 ? ring : null
}

/** 序列化为闭合的 POLYGON WKT（自动补回首点） */
export const toWKT = (ring: LngLat[]): string => {
  if (ring.length === 0) return ''
  const pts = [...ring]
  const [fl, fa] = pts[0]
  const [ll, la] = pts[pts.length - 1]
  if (fl !== ll || fa !== la) pts.push([fl, fa])
  return `POLYGON((${pts.map(([lng, lat]) => `${lng} ${lat}`).join(', ')}))`
}

/** 面积加权多边形质心；退化（面积为 0）时退化为顶点均值 */
export const centroidOf = (ring: LngLat[]): LngLat => {
  if (ring.length === 0) return [0, 0]
  if (ring.length < 3) {
    const [sl, sa] = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sl / ring.length, sa / ring.length]
  }

  // 先平移到以首点为原点的局部坐标再算鞋带公式：经纬度绝对值（~1e2）比地块跨度
  // （~1e-3）大 5 个数量级，直接用原坐标会让 x0*y1、x1*y0 两个大数相减产生灾难性
  // 抵消，twiceArea 只剩 2 位有效数字，实测质心偏差 2.2e-5 deg（约 2.4m）。
  // 平移后所有乘积都是小量，质心精确到 ~1e-14 deg，最后再平移回去。
  const [ox, oy] = ring[0]

  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i += 1) {
    const x0 = ring[i][0] - ox
    const y0 = ring[i][1] - oy
    const x1 = ring[(i + 1) % ring.length][0] - ox
    const y1 = ring[(i + 1) % ring.length][1] - oy
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }

  if (Math.abs(twiceArea) < 1e-12) {
    const [sl, sa] = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sl / ring.length, sa / ring.length]
  }

  const f = twiceArea * 3
  return [ox + cx / f, oy + cy / f]
}

export const boundsOf = (ring: LngLat[]): Bounds => {
  if (ring.length === 0)
    return [
      [0, 0],
      [0, 0],
    ]
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

/**
 * 球面近似面积（平方米）。仅用于侧栏绘制后的**预览**展示，
 * 权威面积由后端 calculate_and_update_area 计算，前端不提交该值。
 */
export const areaOf = (ring: LngLat[]): number => {
  if (ring.length < 3) return 0
  let total = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [lng1, lat1] = ring[i]
    const [lng2, lat2] = ring[(i + 1) % ring.length]
    total += (lng2 - lng1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD))
  }
  return Math.abs((total * EARTH_R * EARTH_R) / 2)
}
