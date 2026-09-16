import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useAMap } from '@/hooks/fields/useAMap'
// R18：对外边界（ref API + props）一律 WGS84，组件内部负责 WGS84 <-> GCJ-02 转换
import { toDisplay, toDisplayRing, toStorageRing } from '@/utils/geo'
import './FieldMapCanvas.css'

/** 全国视野：未选中任何地块时的默认视角 */
const DEFAULT_CENTER = [104, 37.5]
const DEFAULT_ZOOM = 4

const FieldMapCanvas = forwardRef(function FieldMapCanvas(
  { onViewportChange, onBlankClick, onPolygonClick },
  ref
) {
  const { ready, error } = useAMap()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mouseToolRef = useRef(null)

  /** id -> AMap.Polygon */
  const polygonMapRef = useRef(new Map())
  /** key -> AMap.Marker（聚合点） */
  const clusterMapRef = useRef(new Map())
  const draftRef = useRef(null)
  const hoverIdRef = useRef(null)
  /** startDraw 的 pending resolve，cancelDraw 时必须 resolve(null) */
  const drawResolveRef = useRef(null)

  // 用 ref 承载回调，避免因父组件重渲染而反复解绑/重绑地图事件
  const handlersRef = useRef({ onViewportChange, onBlankClick, onPolygonClick })
  handlersRef.current = { onViewportChange, onBlankClick, onPolygonClick }

  const emitViewport = () => {
    const map = mapRef.current
    if (!map) return
    const b = map.getBounds()
    const sw = b.getSouthWest()
    const ne = b.getNorthEast()
    // AMap 的 getBounds() 是 GCJ-02；对外统一输出 WGS84，供 getFieldsGeometry(bbox) 直接使用
    const bounds = toStorageRing([
      [sw.getLng(), sw.getLat()],
      [ne.getLng(), ne.getLat()],
    ])
    handlersRef.current.onViewportChange?.(map.getZoom(), [bounds[0], bounds[1]])
  }

  // 初始化地图（只跑一次）
  useEffect(() => {
    if (!ready || mapRef.current || !containerRef.current) return
    const AMap = window.AMap

    const map = new AMap.Map(containerRef.current, {
      zoom: DEFAULT_ZOOM,
      center: DEFAULT_CENTER,
      viewMode: '2D',
      layers: [new AMap.TileLayer.Satellite(), new AMap.TileLayer.RoadNet()],
    })
    map.addControl(new AMap.Scale())
    map.addControl(new AMap.ToolBar({ position: { right: '16px', bottom: '48px' } }))
    mapRef.current = map

    map.on('moveend', emitViewport)
    map.on('zoomend', emitViewport)
    map.on('complete', emitViewport)
    map.on('click', () => {
      // 绘制中：点击属于绘制行为，不触发取消选中
      if (mouseToolRef.current) return
      handlersRef.current.onBlankClick?.()
    })
  }, [ready])

  useImperativeHandle(ref, () => ({
    getViewport: () => {
      const map = mapRef.current
      if (!map) return null
      const b = map.getBounds()
      const sw = b.getSouthWest()
      const ne = b.getNorthEast()
      // 同 emitViewport：AMap 返回 GCJ-02，转回 WGS84 后交给调用方
      const bounds = toStorageRing([
        [sw.getLng(), sw.getLat()],
        [ne.getLng(), ne.getLat()],
      ])
      return {
        zoom: map.getZoom(),
        bounds: [bounds[0], bounds[1]],
      }
    },

    fitBounds: (bounds, padding = 80) => {
      const map = mapRef.current
      if (!map || !bounds) return
      const AMap = window.AMap
      // 入参是 WGS84，先转 GCJ-02 再交给 AMap
      const [[minLng, minLat], [maxLng, maxLat]] = toDisplayRing([bounds[0], bounds[1]])
      map.setBounds(
        new AMap.Bounds(
          new AMap.LngLat(minLng, minLat),
          new AMap.LngLat(maxLng, maxLat)
        ),
        false,
        [padding, padding, padding, padding]
      )
    },

    /** 增量 diff：复用已存在 Polygon，只增删差异 */
    setPolygons: (list) => {
      const map = mapRef.current
      if (!map) return
      const AMap = window.AMap
      const next = new Set(list.map((p) => p.id))

      polygonMapRef.current.forEach((poly, id) => {
        if (!next.has(id)) {
          map.remove(poly)
          polygonMapRef.current.delete(id)
        }
      })

      list.forEach(({ id, ring }) => {
        if (!ring || ring.length < 3) return
        const path = toDisplayRing(ring)
        const existing = polygonMapRef.current.get(id)
        if (existing) {
          existing.setPath(path)
          return
        }
        const poly = new AMap.Polygon({
          path,
          strokeColor: '#22c55e',
          strokeWeight: 2,
          strokeOpacity: 0.9,
          fillColor: '#22c55e',
          fillOpacity: 0.18,
          bubble: false,
          cursor: 'pointer',
          extData: { id },
        })
        poly.on('click', () => handlersRef.current.onPolygonClick?.(id))
        poly.on('mouseover', () => {
          if (hoverIdRef.current === id) return
          hoverIdRef.current = id
          poly.setOptions({ strokeWeight: 4, fillOpacity: 0.35 })
        })
        poly.on('mouseout', () => {
          if (hoverIdRef.current !== id) return
          hoverIdRef.current = null
          poly.setOptions({ strokeWeight: 2, fillOpacity: 0.18 })
        })
        map.add(poly)
        polygonMapRef.current.set(id, poly)
      })
    },

    setClusters: (clusters) => {
      const map = mapRef.current
      if (!map) return
      const AMap = window.AMap
      const next = new Set(clusters.map((c) => c.key))

      clusterMapRef.current.forEach((marker, key) => {
        if (!next.has(key)) {
          map.remove(marker)
          clusterMapRef.current.delete(key)
        }
      })

      clusters.forEach((c) => {
        const content = `<div class="field-cluster" data-count="${c.count}">${c.count}</div>`
        // c.lng/c.lat 是 WGS84 均值，先转显示坐标再落点到地图
        const [lng, lat] = toDisplay([c.lng, c.lat])
        const existing = clusterMapRef.current.get(c.key)
        if (existing) {
          existing.setCenter(new AMap.LngLat(lng, lat))
          existing.setContent(content)
          return
        }
        const marker = new AMap.Marker({
          position: new AMap.LngLat(lng, lat),
          content,
          offset: new AMap.Pixel(-14, -14),
          bubble: false,
          cursor: 'pointer',
        })
        map.add(marker)
        clusterMapRef.current.set(c.key, marker)
      })
    },

    setHighlight: (id) => {
      polygonMapRef.current.forEach((poly, pid) => {
        const selected = pid === id
        poly.setOptions({
          strokeColor: selected ? '#f59e0b' : '#22c55e',
          strokeWeight: selected ? 4 : 2,
          fillColor: selected ? '#f59e0b' : '#22c55e',
          fillOpacity: selected ? 0.35 : 0.18,
        })
        if (selected) poly.setzIndex(200)
      })
    },

    /** 绘制中 / 重绘时的临时预览（虚线） */
    setDraftPolygon: (ring) => {
      const map = mapRef.current
      if (!map) return
      const AMap = window.AMap
      if (draftRef.current) {
        map.remove(draftRef.current)
        draftRef.current = null
      }
      if (!ring || ring.length < 3) return
      const poly = new AMap.Polygon({
        path: toDisplayRing(ring),
        strokeColor: '#f59e0b',
        strokeWeight: 3,
        strokeStyle: 'dashed',
        fillColor: '#f59e0b',
        fillOpacity: 0.2,
        bubble: true,
      })
      map.add(poly)
      draftRef.current = poly
    },

    /** 进入绘制模式；返回 WGS84 顶点（R18：组件内部已 toStorageRing，调用方可直接入库） */
    startDraw: () =>
      new Promise((resolve) => {
        const map = mapRef.current
        if (!map) {
          resolve(null)
          return
        }
        const AMap = window.AMap
        AMap.plugin(['AMap.MouseTool'], () => {
          const tool = new AMap.MouseTool(map)
          mouseToolRef.current = tool
          drawResolveRef.current = resolve
          tool.polygon({
            strokeColor: '#f59e0b',
            strokeWeight: 3,
            fillColor: '#f59e0b',
            fillOpacity: 0.2,
          })
          tool.on('draw', (e) => {
            const path = e.obj?.getPath?.() ?? []
            // MouseTool 画出的顶点是 GCJ-02，统一转成 WGS84 再交给调用方
            const ring = toStorageRing(path.map((p) => [p.getLng(), p.getLat()]))
            if (mouseToolRef.current) {
              mouseToolRef.current.close(true)
              mouseToolRef.current = null
            }
            drawResolveRef.current = null
            resolve(ring.length >= 3 ? ring : null)
          })
        })
      }),

    /**
     * 取消绘制。必须 resolve(null)，否则 await startDraw() 永远挂起，
     * 导致侧栏 create 态无法退出。
     */
    cancelDraw: () => {
      if (mouseToolRef.current) {
        mouseToolRef.current.close(true)
        mouseToolRef.current = null
      }
      if (drawResolveRef.current) {
        const resolve = drawResolveRef.current
        drawResolveRef.current = null
        resolve(null)
      }
    },

    resetView: () => {
      mapRef.current?.setZoomAndCenter(DEFAULT_ZOOM, DEFAULT_CENTER)
    },
  }))

  // 卸载时清理绘制态与地图，避免流程悬挂 / 内存泄漏
  useEffect(
    () => () => {
      if (mouseToolRef.current) {
        mouseToolRef.current.close(true)
        mouseToolRef.current = null
      }
      if (drawResolveRef.current) {
        const resolve = drawResolveRef.current
        drawResolveRef.current = null
        resolve(null)
      }
      mapRef.current?.destroy?.()
      mapRef.current = null
      polygonMapRef.current.clear()
      clusterMapRef.current.clear()
    },
    []
  )

  if (error) {
    return (
      <div className="field-map-canvas field-map-canvas--error">
        <span className="placeholder-icon">🗺️</span>
        <p className="placeholder-title">地图功能需要配置 API Key</p>
        <p className="placeholder-hint">
          请在 <code>.env</code> 文件中配置 <code>VITE_AMAP_KEY</code>（{error}）
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className="field-map-canvas" />
})

export default FieldMapCanvas
