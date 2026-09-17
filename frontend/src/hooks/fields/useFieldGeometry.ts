import { useCallback, useRef, useState } from 'react'
import { fieldService } from '@/services/fieldService'
import { boundsOf, parseWKT, type LngLat } from '@/utils/geo'
import type { Bbox } from '@/utils/geo/cluster'

export type RingCache = Map<string, LngLat[]>

/**
 * 求出尚未缓存的 id，供增量请求使用。
 * 注意：hook 内部走缓存直查，不调用本函数；它是按计划刻意导出的纯函数，
 * 作为几何缓存逻辑唯一的单测入口（useFieldGeometry.test.ts）。勿当作死代码删除。
 */
export const diffMissingIds = (ids: string[], cache: RingCache): string[] =>
  ids.filter((id) => !cache.has(id))

/**
 * 会话级几何缓存。
 *
 * 原先挂在 hook 实例的 useRef 上：切到其他页面时 Fields 卸载，缓存连同地图实例一起
 * 消失 —— 明明刚才刚看过的地块，回来还要重新拉一遍整屏 WKT。
 * 提到模块作用域后，只要不刷新浏览器就一直命中。
 *
 * 安全性：地块数据的写操作只发生在 Fields 页（全仓仅三处调用），且每次写完都调用 invalidate，
 * 会话期内因此不会读到过期几何。换账号由 resetSessionGeometry 兜底（见 Fields.jsx）。
 */
const SESSION_CACHE: RingCache = new Map()

/** 清空会话缓存：换账号时必须调用，否则新账号会看到上一个账号的图斑 */
export const resetSessionGeometry = (): void => {
  SESSION_CACHE.clear()
}

export interface FieldGeometryStore {
  /** 同步读取缓存；未命中返回 undefined */
  ringsOf: (id: string) => LngLat[] | undefined
  has: (id: string) => boolean
  /**
   * 按视野增量拉取几何；返回本次响应的全部 id（调用方需自行丢弃过期响应）。
   * 请求失败时返回 null —— 与「该区域确实没有地块」的空数组区分开，
   * 避免调用方把失败的 bbox 记成「已取过」而永久留白。
   */
  fetchVisible: (bbox: Bbox) => Promise<string[] | null>
  /** 选中单个地块时优先拉取，不被节流阻塞 */
  ensureGeometry: (id: string) => Promise<LngLat[] | null>
  /** 让缓存失效（新增/编辑/删除后调用） */
  invalidate: (id?: string) => void
  loading: boolean
  /** 缓存变更后自增，父组件据此重渲染 */
  version: number
}

export const useFieldGeometry = (): FieldGeometryStore => {
  const cacheRef = useRef<RingCache>(SESSION_CACHE)
  const seqRef = useRef(0)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)

  const put = useCallback((id: string, wkt?: string | null) => {
    if (!wkt) return
    const ring = parseWKT(wkt)
    if (!ring) return
    cacheRef.current.set(id, ring)
  }, [])

  const fetchVisible = useCallback(
    async (bbox: Bbox): Promise<string[] | null> => {
      const seq = (seqRef.current += 1)
      setLoading(true)
      try {
        const rows = await fieldService.getFieldsGeometry(bbox)
        // 即使视野已变也写入缓存：数据可复用，不浪费
        rows.forEach((r) => put(r.id, r.location_wkt))
        // 只有最新一次请求才触发重渲染；返回值仍给调用方，由其按 seq 决定是否采用
        if (seq === seqRef.current) setVersion((v) => v + 1)
        return rows.map((r) => r.id)
      } catch (e) {
        console.error('[useFieldGeometry] 获取视野内几何失败:', e)
        // 不抛错：调用方不期望 rejection；返回 null 以便其区分「失败」与「确实没有地块」
        return null
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [put]
  )

  const ensureGeometry = useCallback(
    async (id: string): Promise<LngLat[] | null> => {
      const cached = cacheRef.current.get(id)
      if (cached) return cached
      try {
        const field = await fieldService.getFieldById(id)
        put(id, field.location_wkt)
        setVersion((v) => v + 1)
        return cacheRef.current.get(id) ?? null
      } catch (e) {
        console.error('[useFieldGeometry] 获取地块几何失败:', e)
        return null
      }
    },
    [put]
  )

  const invalidate = useCallback((id?: string) => {
    if (id) cacheRef.current.delete(id)
    else cacheRef.current.clear()
    setVersion((v) => v + 1)
  }, [])

  const ringsOf = useCallback((id: string) => cacheRef.current.get(id), [])
  const has = useCallback((id: string) => cacheRef.current.has(id), [])

  return { ringsOf, has, fetchVisible, ensureGeometry, invalidate, loading, version }
}

/** 由顶点数组求包围盒，供 fitBounds 使用 */
export const ringBounds = (ring: LngLat[]) => boundsOf(ring)
