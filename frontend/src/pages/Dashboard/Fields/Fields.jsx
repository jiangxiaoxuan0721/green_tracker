import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FieldToolbar from '@/components/fields/FieldToolbar'
import FieldSidePanel from '@/components/fields/FieldSidePanel'
import FieldMapCanvas from '@/components/fields/FieldMapCanvas'
import FieldMapErrorBoundary from '@/components/fields/FieldMapErrorBoundary'
import { useFieldCatalog } from '@/hooks/fields/useFieldCatalog'
import { useFieldGeometry } from '@/hooks/fields/useFieldGeometry'
import { useFieldDraw } from '@/hooks/fields/useFieldDraw'
import { resetSessionGeometry } from '@/hooks/fields/useFieldGeometry'
import { fieldService } from '@/services/fieldService'
import {
  areaOf,
  boundsOf,
  boundsToBbox,
  clusterInScreenSpace,
  expandBbox,
  isBboxValid,
  toWKT,
} from '@/utils/geo'
import './Fields.css'

const GEOMETRY_ZOOM_IN = 13.0
const GEOMETRY_ZOOM_OUT = 12.8
const VIEWPORT_THROTTLE_MS = 300
const BBOX_EXPAND_RATIO = 0.2
const CLUSTER_CELL_PX = 44
const COLLAPSE_STORAGE_KEY = 'fields:sidepanel:collapsed'
const TILE_SIZE = 256
/** 退化包围盒的撑开幅度（度），避免 AMap 缩放到最大级别 */
const DEGENERATE_PAD = 0.002

/**
 * 会话级视图记忆：切到别的页面再回来时，还原上次的视角与选中地块。
 *
 * 刻意只用内存、不落 localStorage —— 要记住的是「这台机器上刚才在看哪」，
 * 刷新浏览器就该从头来。落盘反而要在下一次会话去偿还一堆过期债
 * （地块可能已被删、权限可能已变、继而 json 还要做失效修护）。
 *
 * 和 R20「已取过即短路」共用同一前提：地块数据的写操作只发生在本页
 * （已核过全仓，唯三处 fieldService 增删改调用都在 Fields.jsx），且每次写都调 invalidate，
 * 故会话期缓存不会读到过期几何。
 */
let sessionView = null
/** 「已取过的 bbox」记录同寿命保留：配合会话级几何缓存，回来时零请求还原图斑 */
const sessionFetched = []
/** 记住这批会话数据属于哪个账号，用于换账号时丢弃 */
let sessionOwner = null

/**
 * 换账号保护：单页应用里登出再登入不会重载 bundle，会话缓存会原样留到下一个账号，
 * 于是新账号在本页会看到上一个账号的图斑（几何是逐 vertex 缓存的，比列表泄露更实）。
 * 本页每次 render 核一次 user_id（读一次 localStorage，可忽略；幂等），
 * 变了就把全套会话记忆连同几何缓存一起丢掉。首次进入时 sessionOwner 为 null，什么都不做。
 */
const dropStaleSession = () => {
  const uid = localStorage.getItem('user_id')
  if (sessionOwner !== null && sessionOwner !== uid) {
    sessionView = null
    sessionFetched.length = 0
    resetSessionGeometry()
  }
  sessionOwner = uid
}

const EMPTY_FORM = {
  name: '',
  description: '',
  crop_type: '',
  soil_type: '',
  irrigation_type: '',
}

/** inner 是否完全落在 outer 内（用于「已取过的 bbox 覆盖了当前 bbox」判定） */
const containsBbox = (outer, inner) =>
  inner.minLng >= outer.minLng &&
  inner.maxLng <= outer.maxLng &&
  inner.minLat >= outer.minLat &&
  inner.maxLat <= outer.maxLat

/** 两个 bbox 是否相交（用于「旧 bbox 的缓存是否对当前视野有效」判定） */
const intersectsBbox = (a, b) =>
  a.minLng <= b.maxLng && a.maxLng >= b.minLng && a.minLat <= b.maxLat && a.maxLat >= b.minLat

/**
 * Web Mercator 像素投影（给定 zoom）。
 * 不依赖地图实例，聚合计算因此是纯函数、可测试。
 */
const makeProjector = (zoom) => ([lng, lat]) => {
  const scale = TILE_SIZE * Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * scale
  const s = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
  return [x, y]
}

/**
 * 地块管理页（地图中心视图）
 *
 * 坐标约定（R18）：FieldMapCanvas 的对外边界双向均为 WGS84，组件内部已完成
 * toDisplay / toStorage，因此 draw.start()、onViewportChange 的 bounds、
 * ringsOf() 拿到的都是 WGS84 —— 本文件一律不再套 toStorageRing / toStorage，
 * 也不对 canvas 输出做二次转换（否则偏移翻倍，图上会整体偏 300~500m）。
 */
const Fields = () => {
  // 先裁决会话记忆是否还可用（幂等，双调用无害），再让下面的 useState 去读 sessionView
  dropStaleSession()
  const canvasRef = useRef(null)
  const catalog = useFieldCatalog()
  const geometry = useFieldGeometry()
  const draw = useFieldDraw(canvasRef)

  const [selectedPlotId, setSelectedPlotId] = useState(
    () => sessionView?.selectedPlotId ?? null
  )
  // 还原时只恢复到 view 态：绝不能恢复 confirmDelete —— 那等于跨页面重新给用户
  // 弹出一个待确认的删除框；create/edit 的未提交草稿同理，不跨会话追逐。
  const [panelMode, setPanelMode] = useState(() =>
    sessionView?.selectedPlotId ? 'view' : 'empty'
  )
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  )
  const [layer, setLayer] = useState('cluster')
  // 会话还原时若仍从 4 起步，首帧会拿 zoom=4 去算聚合粒度（R19），出现一次多余闪跳，
  // 出现一次多余的闪跳，等地图 'complete' 回调把真实 zoom 灌回来才修正。
  const [zoom, setZoom] = useState(() => sessionView?.zoom ?? 4)
  const [visibleIds, setVisibleIds] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [geometryLoading, setGeometryLoading] = useState(false)

  const viewportRef = useRef({ zoom: 4, bounds: null })
  const throttleRef = useRef(null)
  /**
   * 卸载时的 cleanup 要写盘，但那个 effect 的依赖必须为空 —— 否则每次相关 state
   * 变化都会重建清理逻辑。用它读最新值，语义上等价于「闭包穿透」。
   */
  const uiStateRef = useRef(null)
  uiStateRef.current = { selectedPlotId, panelMode }
  /**
   * 只有用户主动选中时才 fitBounds 缩放过去。
   * 会话还原的选中是从记忆里恢复的，再 fit 一次会顶掉用户上次的视角 ——
   * 那恰恰是本次需求要保住的东西。
   */
  const fitOnSelectRef = useRef(false)
  /** 首次渲染快照，供 FieldMapCanvas 建图用；此后不再变化，避免重复传值导致重建地图 */
  const initialViewRef = useRef(sessionView)
  /**
   * 已成功取过的 bbox 记录：{ bbox, ids }。
   * 缓存是永久的（Task 9 约定），所以「已取过的 bbox 覆盖了当前 bbox」⇒ 数据必在缓存中，
   * 可零请求短路（R20）。ids 只作为「该 bbox 命中过哪些地块」的索引，
   * 不作为「当前视野有哪些地块」的判定依据 —— 后者每次都重新算（见 syncVisible）。
   */
  const fetchedRef = useRef(sessionFetched)
  // 供依赖 [selectedPlotId] 的 effect 读取最新值，避免把整个 hook 放进依赖数组
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry
  const catalogRef = useRef(catalog)
  catalogRef.current = catalog
  /** handleViewportChange 需要判断当前层，但不应因此重建回调（避免地图反复解绑事件） */
  const layerRef = useRef(layer)
  layerRef.current = layer

  /** 模式切换的唯一入口，强制 panelMode / selectedPlotId 的合法组合 */
  const enterMode = useCallback(
    (next) => {
      if (next === 'view' || next === 'edit' || next === 'confirmDelete') {
        if (!selectedPlotId) {
          setPanelMode('empty')
          return
        }
      }
      setPanelMode(next)
    },
    [selectedPlotId]
  )

  /** 三个选中入口（下拉 / 点击图斑 / 点击聚合点）统一走这里 */
  const selectPlot = useCallback((id) => {
    // 用户主动选中 → 允许缩放到地块；会话还原走的是 useState 初始值，不经过这里
    fitOnSelectRef.current = Boolean(id)
    setSelectedPlotId(id || null)
    setPanelMode(id ? 'view' : 'empty')
    setErrors({})
  }, [])

  /** 当前视野（WGS84，R18）外扩后的 bbox；视野未知时返回 null */
  const readViewportBbox = useCallback(() => {
    const b = viewportRef.current.bounds
    if (!b) return null
    const bbox = expandBbox(boundsToBbox(b), BBOX_EXPAND_RATIO)
    return isBboxValid(bbox) ? bbox : null
  }, [])

  /**
   * 重算「当前视野应该渲染哪些图斑」。
   *
   * 关键点：不使用 fetchVisible 的返回值判定当前视野 —— 返回值只代表「那一次响应」，
   * 没有序号可比对，先发后到的慢响应会把旧视野的 id 灌进 state。
   * 这里改为：按「已取 bbox 与当前视野相交」筛出候选 id，再逐个重新问 ringsOf，
   * 未命中（location_wkt 为空、或已被 invalidate）的自然被剔掉。
   */
  const syncVisible = useCallback(() => {
    const bbox = readViewportBbox()
    if (!bbox) return
    const seen = new Set()
    fetchedRef.current.forEach((rec) => {
      if (!intersectsBbox(rec.bbox, bbox)) return
      rec.ids.forEach((id) => {
        if (seen.has(id)) return
        if (!geometryRef.current.ringsOf(id)) return
        seen.add(id)
      })
    })
    // 覆盖而非累加：累加会让视野外的图斑无限堆积在渲染列表里
    setVisibleIds(Array.from(seen))
  }, [readViewportBbox])

  /** 视野取数：bbox 包含判定短路（R20），实现「同一区域不重复请求」 */
  const loadViewport = useCallback(async () => {
    const bbox = readViewportBbox()
    if (!bbox) return
    if (fetchedRef.current.some((rec) => containsBbox(rec.bbox, bbox))) {
      // 缓存已覆盖：省掉请求，但仍要用这份缓存把当前视野的图斑算出来。
      // 会话还原后走的正是这条路 —— 漏掉 syncVisible，visibleIds 会一直是空数组，
      // 于是「图斑一个都不显示」，而请求数却是 0，看不出哪里出错。
      syncVisible()
      return
    }
    // 返回值不参与新鲜度判定，仅登记到该 bbox 名下
    const ids = await geometryRef.current.fetchVisible(bbox)
    // R25：null = 请求失败，绝不登记该 bbox。
    // 否则一次网络抖动就会让这片区域被判为「已取过」而永久留白，直到刷新页面。
    // 注意：tsc 抓不到这里 —— 本页是 .jsx，不在 tsconfig 编译程序内，只能靠这个判断守住。
    if (ids === null) return
    fetchedRef.current.push({ bbox, ids })
    syncVisible()
  }, [readViewportBbox, syncVisible])

  /** 缓存失效：必须一并清空已取 bbox 记录，否则覆盖过的区域永远不再重新取数（R20） */
  const invalidateGeometry = useCallback((id) => {
    fetchedRef.current = []
    geometryRef.current.invalidate(id)
  }, [])

  const handleViewportChange = useCallback(
    (z, bounds) => {
      viewportRef.current = { zoom: z, bounds }
      setZoom(z)
      if (throttleRef.current) clearTimeout(throttleRef.current)
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null
        // R20a：聚合层只用到 catalog.light 的 centroid，不必拉整个视野的 WKT
        if (layerRef.current !== 'polygon') return
        loadViewport()
      }, VIEWPORT_THROTTLE_MS)
    },
    [loadViewport]
  )

  // 滞后带：13.0 进多边形，12.8 退回聚合点，避免阈值边界抖动
  useEffect(() => {
    setLayer((prev) => {
      if (prev === 'cluster' && zoom >= GEOMETRY_ZOOM_IN) return 'polygon'
      if (prev === 'polygon' && zoom < GEOMETRY_ZOOM_OUT) return 'cluster'
      return prev
    })
  }, [zoom])

  // 进入多边形层时立即补一次视野请求（聚合层期间的取数已被 R20a 门控掉）
  useEffect(() => {
    if (layer !== 'polygon') return
    loadViewport()
  }, [layer, loadViewport])

  // 渲染：cluster 层用聚合点，polygon 层用已缓存几何
  // 依赖里的 geometry.version 是关键：ringsOf / has 是稳定引用、读的是 ref，
  // 缓存变化唯一的通知信号就是 version（漏了它只会静默渲染旧几何，编译器不会报错）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (layer === 'cluster') {
      // makeProjector 是世界像素投影，分桶只随 zoom 变化，故 zoom 必须在依赖里（R19）
      const project = makeProjector(zoom)
      const items = catalog.light
        .filter((f) => f.centroid && f.centroid.length === 2)
        .map((f) => ({ id: f.id, centroid: f.centroid }))
      canvas.setPolygons([])
      canvas.setClusters(clusterInScreenSpace(items, project, CLUSTER_CELL_PX))
      return
    }

    const list = visibleIds
      .map((id) => ({ id, ring: geometry.ringsOf(id) }))
      .filter((p) => p.ring && p.ring.length >= 3)
    canvas.setClusters([])
    canvas.setPolygons(list)
  // 依赖说明：zoom 决定聚合粒度（R19）；geometry.version 是缓存更新的唯一信号，
  // ringsOf / has 是读 ref 的稳定引用，漏带它只会静默渲染旧几何。
  // 这里依赖的是成员而非整个 geometry 对象 —— 后者每次渲染都是新对象，
  // 直接依赖会导致每次渲染（含表单逐字输入）都重跑一次 setPolygons。
  }, [layer, zoom, visibleIds, geometry.ringsOf, geometry.version, catalog.light]) // eslint-disable-line react-hooks/exhaustive-deps

  // 多边形重建后高亮会丢失（setPolygons 增量的部分会新建 Polygon），这里补一次
  useEffect(() => {
    canvasRef.current?.setHighlight(selectedPlotId)
  }, [selectedPlotId, visibleIds, geometry.version])

  // 选中副作用：优先拉几何 -> fitBounds -> 补详情
  useEffect(() => {
    const canvas = canvasRef.current
    if (!selectedPlotId) {
      canvas?.setHighlight(null)
      setGeometryLoading(false)
      return undefined
    }
    let cancelled = false
    const run = async () => {
      canvas?.setHighlight(selectedPlotId)
      if (!geometryRef.current.has(selectedPlotId)) {
        setGeometryLoading(true)
        await geometryRef.current.ensureGeometry(selectedPlotId)
        if (cancelled) return
      }
      // 必须放在 if 外：命中缓存时若只在 if 内清，改选已缓存地块会让
      // geometryLoading 永久停在 true，侧栏骨架屏再也不消失。
      setGeometryLoading(false)
      // ringsOf 已是 WGS84（R18），fitBounds 内部再转 GCJ-02。
      // 只在用户主动选中时缩放：会话还原的场景必须保住上次 camera，否则等于没记住。
      if (fitOnSelectRef.current) {
        fitOnSelectRef.current = false
        const ring = geometryRef.current.ringsOf(selectedPlotId)
        if (ring && ring.length >= 3) canvas?.fitBounds(boundsOf(ring))
      }

      const entry = catalogRef.current.byId.get(selectedPlotId)
      if (!entry?.detail) {
        try {
          const field = await fieldService.getFieldById(selectedPlotId)
          if (!cancelled) catalogRef.current.upsertDetail(field)
        } catch (e) {
          console.error('[Fields] 获取地块详情失败:', e)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedPlotId])

  // 折叠状态持久化；create/edit/confirmDelete 时强制展开
  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (collapsed && (panelMode === 'create' || panelMode === 'edit' || panelMode === 'confirmDelete')) {
      setCollapsed(false)
    }
  }, [panelMode, collapsed])

  // R23：AMap 不会在容器尺寸变化时自动重算画布，侧栏折叠/展开与模式切换后显式 resize
  useEffect(() => {
    canvasRef.current?.resize()
  }, [panelMode, collapsed])

  useEffect(
    () => () => {
      if (throttleRef.current) clearTimeout(throttleRef.current)
      // 离开本页前记下视角与选中态，下次回来据此还原（会话级）。
      // 地图还没就绪时 getViewport 返回 null，此时绝不覆盖旧值：
      // 拿到的会是 DEFAULT 全国视角，写进去等于把上次记住的位置抹掉。
      const vp = canvasRef.current?.getViewport()
      if (!vp) return
      sessionView = { center: vp.center, zoom: vp.zoom, ...uiStateRef.current }
    },
    []
  )

  // 还原出来的选中地块可能已在本会话内被删除 / 不再存在于列表里。
  // 必须等列表加载完再裁决：过早判定时 byId 还是空的，会把刚还原的选中误清掉。
  useEffect(() => {
    if (catalog.loading || !selectedPlotId) return
    if (catalog.byId.has(selectedPlotId)) return
    selectPlot(null)
  }, [catalog.loading, catalog.byId, selectedPlotId, selectPlot])

  const draft = draw.draftRing
  const draftAreaM2 = draft ? areaOf(draft) : null
  const draftVertexCount = draft ? draft.length : null

  /** 点击图斑选中：与空白点击同一套守卫，避免绘制/填表过程中被清掉 */
  const handlePolygonClick = useCallback(
    (id) => {
      if (draw.drawing) return
      if (panelMode !== 'view' && panelMode !== 'empty') return
      selectPlot(id)
    },
    [draw.drawing, panelMode, selectPlot]
  )

  /** R24：绘制中、或面板处于 create / edit / confirmDelete 时，空白点击一律不取消 */
  const handleBlankClick = useCallback(() => {
    if (draw.drawing || panelMode !== 'view') return
    selectPlot(null)
  }, [draw.drawing, panelMode, selectPlot])

  /**
   * R21：点击聚合点。收到的是整个 Cluster 对象（含 ids），
   * key 是屏幕空间网格键、跨平移不稳定，不能当作地块身份使用。
   */
  const handleClusterClick = useCallback(
    (c) => {
      if (!c?.ids?.length) return
      if (draw.drawing) return
      if (c.ids.length === 1) {
        handlePolygonClick(c.ids[0])
        return
      }
      // 多成员：放大拆分（业界通用行为），不随便挑 ids[0] —— 那等价于随机选中
      const pts = c.ids
        .map((id) => catalogRef.current.byId.get(id)?.centroid)
        .filter((p) => Array.isArray(p) && p.length === 2)
      if (!pts.length) return
      const b = boundsOf(pts)
      // 退化包围盒（成员质心重合）：AMap 会缩放到最大级别，必须先撑开
      if (b[0][0] === b[1][0] || b[0][1] === b[1][1]) {
        b[0][0] -= DEGENERATE_PAD
        b[1][0] += DEGENERATE_PAD
        b[0][1] -= DEGENERATE_PAD
        b[1][1] += DEGENERATE_PAD
      }
      canvasRef.current?.fitBounds(b)
    },
    [draw.drawing, handlePolygonClick]
  )

  const handleCreate = useCallback(async () => {
    // R22：绘制中禁用所有绘制入口，cancel() 与 start() 因此必然被用户操作分隔到不同 tick
    if (draw.drawing) return
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelMode('create')
    let ring = null
    try {
      ring = await draw.start() // WGS84（R18），可直接 toWKT 入库
    } catch (e) {
      // 当前 startDraw 只 resolve 不 reject，这里仅为防止将来改为 reject 时的未处理拒绝
      console.error('[Fields] 绘制失败:', e)
    }
    if (!ring) {
      // 用户取消绘制
      draw.clear()
      setPanelMode(selectedPlotId ? 'view' : 'empty')
    }
  }, [draw, selectedPlotId])

  const handleStartEdit = useCallback(() => {
    const entry = catalogRef.current.byId.get(selectedPlotId)
    const d = entry?.detail
    setForm({
      name: d?.name ?? entry?.name ?? '',
      description: d?.description ?? '',
      crop_type: d?.crop_type ?? '',
      soil_type: d?.soil_type ?? '',
      irrigation_type: d?.irrigation_type ?? '',
    })
    enterMode('edit')
  }, [selectedPlotId, enterMode])

  const handleStartRedraw = useCallback(async () => {
    if (draw.drawing) return
    let ring = null
    try {
      ring = await draw.start()
    } catch (e) {
      console.error('[Fields] 重绘失败:', e)
    }
    if (ring) draw.setDraftRing(ring)
  }, [draw])

  const handleCancel = useCallback(() => {
    // 编辑态下的「重绘」同样要能中断，故按 drawing 判断而非只看 panelMode
    if (draw.drawing) draw.cancel()
    draw.clear()
    setErrors({})
    setPanelMode(selectedPlotId ? 'view' : 'empty')
  }, [draw, selectedPlotId])

  const handleSubmit = useCallback(async () => {
    if (!form.name?.trim()) {
      setErrors({ name: '请输入地块名称' })
      return
    }
    setSubmitting(true)
    try {
      if (panelMode === 'create') {
        const ring = draw.draftRing
        if (!ring) {
          setErrors({ name: '请先在地图上绘制地块边界' })
          setSubmitting(false)
          return
        }
        const payload = {
          name: form.name.trim(),
          description: form.description,
          crop_type: form.crop_type || undefined,
          soil_type: form.soil_type || undefined,
          irrigation_type: form.irrigation_type || undefined,
          // 面积后端权威：不提交 area_m2
          // R18：ring 已是 WGS84，直接 toWKT，不得再套 toStorageRing
          location_wkt: toWKT(ring),
        }
        const created = await fieldService.createField(payload)
        invalidateGeometry(created.id)
        catalogRef.current.upsertDetail(created)
        draw.clear()
        await geometryRef.current.ensureGeometry(created.id)
        selectPlot(created.id)
        const r = geometryRef.current.ringsOf(created.id)
        if (r) canvasRef.current?.fitBounds(boundsOf(r))
      } else {
        const ring = draw.draftRing
        const payload = {
          name: form.name.trim(),
          description: form.description,
          crop_type: form.crop_type || undefined,
          soil_type: form.soil_type || undefined,
          irrigation_type: form.irrigation_type || undefined,
          ...(ring ? { location_wkt: toWKT(ring) } : {}),
        }
        const updated = await fieldService.updateField(selectedPlotId, payload)
        invalidateGeometry(selectedPlotId)
        catalogRef.current.upsertDetail(updated)
        draw.clear()
        // 几何已失效，重新拉一次，否则刚编辑的图斑会从地图上消失
        await geometryRef.current.ensureGeometry(selectedPlotId)
        setPanelMode('view')
      }
      catalogRef.current.reload()
    } catch (e) {
      setErrors({ name: e?.response?.data?.detail ?? '保存失败，请重试' })
    } finally {
      setSubmitting(false)
    }
  }, [form, panelMode, draw, selectedPlotId, selectPlot, invalidateGeometry])

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedPlotId) return
    setSubmitting(true)
    try {
      await fieldService.deleteField(selectedPlotId)
      invalidateGeometry(selectedPlotId)
      catalogRef.current.remove(selectedPlotId)
      selectPlot(null)
      canvasRef.current?.resetView()
    } catch (e) {
      setErrors({ name: e?.response?.data?.detail ?? '删除失败，请重试' })
    } finally {
      setSubmitting(false)
    }
  }, [selectedPlotId, selectPlot, invalidateGeometry])

  const options = useMemo(
    () => catalog.light.map((f) => ({ value: f.id, label: f.name })),
    [catalog.light]
  )

  return (
    <div className="fields-page">
      <FieldToolbar
        options={options}
        value={selectedPlotId ?? ''}
        onSelect={selectPlot}
        onCreate={handleCreate}
        disabled={draw.drawing}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="fields-body">
        <div className="fields-map">
          <FieldMapErrorBoundary>
            <FieldMapCanvas
              ref={canvasRef}
              initialView={initialViewRef.current}
              onViewportChange={handleViewportChange}
              onBlankClick={handleBlankClick}
              onPolygonClick={handlePolygonClick}
              onClusterClick={handleClusterClick}
            />
          </FieldMapErrorBoundary>
        </div>

        {!collapsed && (
          <FieldSidePanel
            mode={panelMode}
            field={selectedPlotId ? catalog.byId.get(selectedPlotId) ?? null : null}
            geometryLoading={geometryLoading}
            draftAreaM2={draftAreaM2}
            draftVertexCount={draftVertexCount}
            form={form}
            errors={errors}
            submitting={submitting}
            drawing={draw.drawing}
            onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onStartEdit={handleStartEdit}
            onStartDelete={() => enterMode('confirmDelete')}
            onConfirmDelete={handleConfirmDelete}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
            onStartRedraw={handleStartRedraw}
            onCollapse={() => setCollapsed(true)}
          />
        )}
      </div>
    </div>
  )
}

export default Fields
