import { useCallback, useEffect, useRef, useState } from 'react'
import type { LngLat } from '@/utils/geo'

interface MapCanvasLike {
  startDraw: () => Promise<LngLat[] | null>
  cancelDraw: () => void
  setDraftPolygon: (ring: LngLat[] | null) => void
}

export interface FieldDraw {
  drawing: boolean
  /** 已绘制但尚未保存的顶点（WGS84，可直接入库） */
  draftRing: LngLat[] | null
  /** 进入绘制模式；返回 WGS84 顶点（R18），取消绘制返回 null */
  start: () => Promise<LngLat[] | null>
  cancel: () => void
  clear: () => void
  setDraftRing: (ring: LngLat[] | null) => void
}

/**
 * 地块绘制编排：把 FieldMapCanvas 的命令式绘制 API 收敛为 React 状态。
 *
 * 坐标约定（R18）：FieldMapCanvas 的公共边界双向均为 WGS84，
 * startDraw() 内部已完成 toStorageRing，因此本 hook 的 start() / draftRing
 * 一律是 WGS84 存储坐标系，可直接 toWKT() 入库，调用方不得再做二次转换。
 *
 * canvasRef 只按结构约束，避免 useRef(null) 推导出的 MutableRefObject<null>
 * 与 MutableRefObject<MapCanvasLike | null> 不兼容导致的类型错误。
 */
export const useFieldDraw = (canvasRef: { current: MapCanvasLike | null }): FieldDraw => {
  const [drawing, setDrawing] = useState(false)
  const [draftRing, setDraftRing] = useState<LngLat[] | null>(null)
  const activeRef = useRef(false)

  const start = useCallback(async (): Promise<LngLat[] | null> => {
    const canvas = canvasRef.current
    if (!canvas) return null
    activeRef.current = true
    setDrawing(true)
    try {
      const ring = await canvas.startDraw()
      setDraftRing(ring)
      canvas.setDraftPolygon(ring)
      return ring
    } finally {
      activeRef.current = false
      setDrawing(false)
    }
  }, [canvasRef])

  const cancel = useCallback(() => {
    canvasRef.current?.cancelDraw()
    activeRef.current = false
    setDrawing(false)
    setDraftRing(null)
    canvasRef.current?.setDraftPolygon(null)
  }, [canvasRef])

  const clear = useCallback(() => {
    setDraftRing(null)
    canvasRef.current?.setDraftPolygon(null)
  }, [canvasRef])

  // 卸载时强制结束绘制，避免 MouseTool 悬挂
  useEffect(
    () => () => {
      if (activeRef.current) canvasRef.current?.cancelDraw()
    },
    [canvasRef]
  )

  return { drawing, draftRing, start, cancel, clear, setDraftRing }
}
