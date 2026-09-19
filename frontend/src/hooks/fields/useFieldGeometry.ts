import { useCallback, useRef, useState } from 'react'
import { fieldService } from '@/services/fieldService'
import { boundsOf, type LngLat } from '@/utils/geo'
import type { Bbox } from '@/utils/geo/cluster'
import { useFieldGeometryStore, type RingCache } from '@/store/useFieldGeometryStore'

export type { RingCache }

/**
 * 求出尚未缓存的 id，供增量请求使用。
 * 注意：hook 内部走缓存直查，不调用本函数；它是按计划刻意导出的纯函数，
 * 作为几何缓存逻辑唯一的单测入口（useFieldGeometry.test.ts）。勿当作死代码删除。
 */
export const diffMissingIds = (ids: string[], cache: RingCache): string[] =>
  ids.filter((id) => !cache.has(id))

export interface FieldGeometryStore {
  /** 同步读取缓存；未命中或已过期返回 undefined */
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

/**
 * 地块几何的请求层。
 *
 * 缓存本身已搬到 @/store/useFieldGeometryStore（TTL + 容量上限 + 换账号 reset），
 * 这里只负责「什么时候发请求、loading 怎么走」，并把缓存操作转发给 store。
 *
 * version 直接订阅 store 的 version（写入即自增）：原先只在「最新一次请求」时自增，
 * 慢响应带来的多余渲染确实省了，但也埋着漏渲染的坑 —— 一次非最新的写入若不自增，
 * 新几何就静静地躺在缓存里不上屏。渲染幂等，多渲一次远比漏渲一次好修。
 */
export const useFieldGeometry = (): FieldGeometryStore => {
  const version = useFieldGeometryStore((s) => s.version)
  const seqRef = useRef(0)
  const [loading, setLoading] = useState(false)

  const fetchVisible = useCallback(async (bbox: Bbox): Promise<string[] | null> => {
    const seq = (seqRef.current += 1)
    setLoading(true)
    try {
      const rows = await fieldService.getFieldsGeometry(bbox)
      // 即使视野已变也写入缓存：数据可复用，不浪费
      useFieldGeometryStore.getState().putMany(rows)
      // 返回值仍给调用方，由其按 seq 决定是否采用
      return rows.map((r) => r.id)
    } catch (e) {
      console.error('[useFieldGeometry] 获取视野内几何失败:', e)
      // 不抛错：调用方不期望 rejection；返回 null 以便其区分「失败」与「确实没有地块」
      return null
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [])

  const ensureGeometry = useCallback(async (id: string): Promise<LngLat[] | null> => {
    const cached = useFieldGeometryStore.getState().ringOf(id)
    if (cached) return cached
    try {
      const field = await fieldService.getFieldById(id)
      useFieldGeometryStore.getState().put(id, field.location_wkt)
      return useFieldGeometryStore.getState().ringOf(id) ?? null
    } catch (e) {
      console.error('[useFieldGeometry] 获取地块几何失败:', e)
      return null
    }
  }, [])

  const invalidate = useCallback((id?: string) => {
    useFieldGeometryStore.getState().invalidate(id)
  }, [])

  const ringsOf = useCallback(
    (id: string) => useFieldGeometryStore.getState().ringOf(id),
    []
  )
  const has = useCallback(
    (id: string) => useFieldGeometryStore.getState().ringOf(id) !== undefined,
    []
  )

  return { ringsOf, has, fetchVisible, ensureGeometry, invalidate, loading, version }
}

/** 由顶点数组求包围盒，供 fitBounds 使用 */
export const ringBounds = (ring: LngLat[]) => boundsOf(ring)
