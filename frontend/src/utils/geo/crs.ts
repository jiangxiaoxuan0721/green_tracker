/**
 * WGS84 <-> GCJ-02 坐标变换。
 *
 * 背景：库内地块几何按 WGS84 存储（srid=4326），高德 JS API 使用 GCJ-02。
 * 不做变换会导致图斑与卫星底图偏移 300~500m。
 *
 * 所有渲染路径必须经 toDisplay()/toDisplayRing()；
 * 所有写库路径必须经 toStorage()/toStorageRing()。
 */
import { env } from '@/config/env'
import type { LngLat } from './types'

const PI = Math.PI
/** 克拉索夫斯基椭球长半轴 */
const A = 6378245.0
/** 偏心率平方 */
const EE = 0.006693421622965943

const outOfChina = (lng: number, lat: number): boolean =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271

const transformLat = (x: number, y: number): number => {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

const transformLng = (x: number, y: number): number => {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

/** 返回 GCJ-02 相对 WGS84 的偏移量 [dLng, dLat] */
const delta = (lng: number, lat: number): LngLat => {
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  return [dLng, dLat]
}

export const wgs84ToGcj02 = ([lng, lat]: LngLat): LngLat => {
  if (outOfChina(lng, lat)) return [lng, lat]
  const [dLng, dLat] = delta(lng, lat)
  return [lng + dLng, lat + dLat]
}

export const gcj02ToWgs84 = ([lng, lat]: LngLat): LngLat => {
  if (outOfChina(lng, lat)) return [lng, lat]
  // 偏差校正：直接减去 delta(lng, lat) 只是一阶近似，往返会残留 ~6e-7 deg（约 7cm）
  // 误差，超出 1e-6 deg 的往返精度要求。改为不动点迭代解 wgs = gcj - delta(wgs)，
  // 3 次即收敛到 ~1e-14 deg。
  let wgsLng = lng
  let wgsLat = lat
  for (let i = 0; i < 3; i += 1) {
    const [dLng, dLat] = delta(wgsLng, wgsLat)
    wgsLng = lng - dLng
    wgsLat = lat - dLat
  }
  return [wgsLng, wgsLat]
}

/** 库内地块几何的坐标系假设，由 VITE_FIELD_SOURCE_CRS 控制 */
export const SOURCE_CRS: 'wgs84' | 'gcj02' = env.FIELD_SOURCE_CRS

/** 库内坐标 -> 高德显示坐标 */
export const toDisplay = (p: LngLat): LngLat => (SOURCE_CRS === 'wgs84' ? wgs84ToGcj02(p) : p)

/** 高德显示坐标 -> 库内坐标 */
export const toStorage = (p: LngLat): LngLat => (SOURCE_CRS === 'wgs84' ? gcj02ToWgs84(p) : p)

export const toDisplayRing = (ring: LngLat[]): LngLat[] => ring.map(toDisplay)
export const toStorageRing = (ring: LngLat[]): LngLat[] => ring.map(toStorage)
