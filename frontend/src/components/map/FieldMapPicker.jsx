import { useEffect, useRef, useState, useCallback } from 'react'
import './map.css'

const AMapKey = import.meta.env.VITE_AMAP_KEY
const AMapServiceKey = import.meta.env.VITE_AMAP_SERVICE_KEY
const AMapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE

/**
 * 地块地图选择器组件
 * 支持：地点搜索、地图点击选点、多边形绘制、WKT导入/导出
 */
const FieldMapPicker = ({
  value = '',
  onChange,
  height = 400,
  center = [116.397428, 39.90923],
  zoom = 10
}) => {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const mouseToolRef = useRef(null)
  const polygonRef = useRef(null)
  const markerRef = useRef(null)
  const placeSearchRef = useRef(null)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState('')
  const [mode, setMode] = useState('view')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentWKT, setCurrentWKT] = useState(value)
  const [showWKTInput, setShowWKTInput] = useState(false)
  const [wktInput, setWktInput] = useState('')

  // 检查API Key配置
  const isKeyConfigured = AMapKey && !AMapKey.includes('your_') && AMapKey.length > 10

  // 加载高德地图JS API
  useEffect(() => {
    if (!isKeyConfigured) {
      setMapError('请先配置高德地图 API Key')
      return
    }

    if (window.AMap) {
      setMapLoaded(true)
      return
    }

    // 配置安全密钥（必须在加载 SDK 之前）
    if (!window._AMapSecurityConfig && AMapSecurityCode && !AMapSecurityCode.includes('your_')) {
      window._AMapSecurityConfig = {
        securityJsCode: AMapSecurityCode
      }
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMapKey}&plugin=AMap.ToolBar,AMap.Scale,AMap.MouseTool`
    script.async = true
    script.onload = () => {
      setMapLoaded(true)
    }
    script.onerror = () => {
      setMapError('地图加载失败，请检查API Key配置')
    }
    document.head.appendChild(script)

    return () => {
      // 不清除script，让地图保持加载状态
    }
  }, [isKeyConfigured])

  // 初始化地图 - 延迟初始化确保容器可见
  useEffect(() => {
    if (!isKeyConfigured) return
    if (!mapContainerRef.current || !window.AMap || mapRef.current) return

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return

      const map = new window.AMap.Map(mapContainerRef.current, {
        zoom: zoom,
        center: center,
        viewMode: '2D',
        mapStyle: 'amap://styles/normal',
        resizeEnable: true,
        showLabel: false
      })

      map.addControl(new window.AMap.Scale())
      map.addControl(new window.AMap.ToolBar({ position: 'RB' }))
      
      // 地图加载完成后触发 resize，确保正确渲染
      map.on('complete', () => {
        setTimeout(() => map.resize(), 200)
      })

      // 动态加载 MouseTool 插件
      window.AMap.plugin('AMap.MouseTool', () => {
        mouseToolRef.current = new window.AMap.MouseTool(map)
      })

      // 动态加载 PlaceSearch 插件
      if (AMapServiceKey && !AMapServiceKey.includes('your_')) {
        window.AMap.plugin(['AMap.PlaceSearch'], () => {
          placeSearchRef.current = new window.AMap.PlaceSearch({
            city: '全国',
            citylimit: false,
            pageSize: 10,
            pageIndex: 1,
            extensions: 'base'
          })
        })
      }

      mapRef.current = map

      if (value) {
        loadWKTToMap(value)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [isKeyConfigured, mapLoaded, value])

  // 解析WKT为坐标数组
  const parseWKT = useCallback((wkt) => {
    if (!wkt) return []
    try {
      const cleanWkt = wkt.trim().toUpperCase()
      
      if (cleanWkt.startsWith('POLYGON')) {
        const match = cleanWkt.match(/POLYGON\s*\(\s*\((.+?)\)\s*\)/)
        if (match) {
          return match[1].split(',').map(coord => {
            const [lng, lat] = coord.trim().split(/\s+/)
            return [parseFloat(lng), parseFloat(lat)]
          })
        }
      }
      
      if (cleanWkt.startsWith('POINT')) {
        const match = cleanWkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/)
        if (match) {
          return [[parseFloat(match[1]), parseFloat(match[2])]]
        }
      }
      
      return []
    } catch (e) {
      return []
    }
  }, [])

  const wktToCoords = useCallback((wkt) => {
    const coords = parseWKT(wkt)
    if (coords.length === 0) {
      setMapError('无效的WKT格式')
      return null
    }
    setMapError('')
    return coords
  }, [parseWKT])

  const loadWKTToMap = useCallback((wkt) => {
    if (!mapRef.current || !wkt) return

    const coords = parseWKT(wkt)
    if (coords.length === 0) return

    if (polygonRef.current) {
      mapRef.current.remove(polygonRef.current)
      polygonRef.current = null
    }
    if (markerRef.current) {
      mapRef.current.remove(markerRef.current)
      markerRef.current = null
    }

    if (coords.length === 1) {
      markerRef.current = new window.AMap.Marker({
        position: coords[0],
        icon: new window.AMap.Icon({
          size: new window.AMap.Size(32, 32),
          image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
          imageSize: new window.AMap.Size(32, 32)
        })
      })
      mapRef.current.add(markerRef.current)
      mapRef.current.setCenter(coords[0])
    } else {
      polygonRef.current = new window.AMap.Polygon({
        path: coords,
        fillColor: '#00b4d8',
        fillOpacity: 0.3,
        strokeColor: '#0077b6',
        strokeWeight: 2,
        extData: wkt
      })
      mapRef.current.add(polygonRef.current)
      mapRef.current.setFitView([polygonRef.current])
    }
  }, [parseWKT])

  const startDraw = useCallback(() => {
    if (!mapRef.current || !mouseToolRef.current) {
      setMapError('地图工具加载中，请稍后再试')
      return
    }

    setMode('draw')
    setMapError('')

    if (polygonRef.current) {
      mapRef.current.remove(polygonRef.current)
      polygonRef.current = null
    }
    if (markerRef.current) {
      mapRef.current.remove(markerRef.current)
      markerRef.current = null
    }

    // 使用 MouseTool 绘制多边形
    mouseToolRef.current.polygon({
      fillColor: '#00b4d8',
      fillOpacity: 0.3,
      strokeColor: '#0077b6',
      strokeWeight: 2
    })

    // 监听绘制完成事件
    mouseToolRef.current.on('draw', (e) => {
      const path = e.obj.getPath()
      polygonRef.current = e.obj
      const wkt = `POLYGON((${path.map(p => `${p.lng} ${p.lat}`).join(',')}))`
      setCurrentWKT(wkt)
      onChange?.(wkt)
      setMode('view')
    })
  }, [onChange])

  const addMarker = useCallback(() => {
    if (!mapRef.current) return

    setMode('point')
    setMapError('')

    const clickHandler = (e) => {
      const position = [e.lnglat.getLng(), e.lnglat.getLat()]
      
      if (markerRef.current) {
        mapRef.current.remove(markerRef.current)
      }
      if (polygonRef.current) {
        mapRef.current.remove(polygonRef.current)
        polygonRef.current = null
      }

      markerRef.current = new window.AMap.Marker({
        position: position,
        icon: new window.AMap.Icon({
          size: new window.AMap.Size(32, 32),
          image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
          imageSize: new window.AMap.Size(32, 32)
        })
      })
      mapRef.current.add(markerRef.current)
      mapRef.current.setCenter(position)

      const wkt = `POINT(${position[0]} ${position[1]})`
      setCurrentWKT(wkt)
      onChange?.(wkt)

      mapRef.current.off('click', clickHandler)
      setMode('view')
    }

    mapRef.current.on('click', clickHandler)
  }, [onChange])

  const searchPlace = useCallback(() => {
    if (!searchKeyword.trim() || !placeSearchRef.current || !mapRef.current) return

    setLoading(true)

    placeSearchRef.current.search(searchKeyword, (status, result) => {
      setLoading(false)
      if (status === 'complete' && result.info === 'OK') {
        setSearchResults(result.poiList.pois || [])
      } else {
        setSearchResults([])
        setMapError('未找到相关地点')
      }
    })
  }, [searchKeyword])

  const selectSearchResult = useCallback((poi) => {
    if (!mapRef.current) return

    const position = [poi.location.lng, poi.location.lat]
    mapRef.current.setCenter(position)
    mapRef.current.setZoom(15)

    if (markerRef.current) {
      mapRef.current.remove(markerRef.current)
    }
    if (polygonRef.current) {
      mapRef.current.remove(polygonRef.current)
      polygonRef.current = null
    }

    markerRef.current = new window.AMap.Marker({
      position: position,
      title: poi.name
    })
    mapRef.current.add(markerRef.current)

    setSearchResults([])
    setSearchKeyword('')
    setMode('view')
  }, [])

  const importWKT = useCallback(() => {
    const coords = wktToCoords(wktInput)
    if (coords) {
      loadWKTToMap(wktInput)
      setCurrentWKT(wktInput)
      onChange?.(wktInput)
      setShowWKTInput(false)
      setWktInput('')
    }
  }, [wktInput, wktToCoords, loadWKTToMap, onChange])

  const clearOverlay = useCallback(() => {
    if (!mapRef.current) return

    if (polygonRef.current) {
      mapRef.current.remove(polygonRef.current)
      polygonRef.current = null
    }
    if (markerRef.current) {
      mapRef.current.remove(markerRef.current)
      markerRef.current = null
    }

    setCurrentWKT('')
    onChange?.('')
    setMapError('')
  }, [onChange])

  useEffect(() => {
    if (value && value !== currentWKT) {
      setCurrentWKT(value)
      loadWKTToMap(value)
    }
  }, [value, currentWKT, loadWKTToMap])

  // mode 切换时关闭 MouseTool
  useEffect(() => {
    if (mode === 'view' && mouseToolRef.current) {
      mouseToolRef.current.close()
    }
  }, [mode])

  // API Key未配置提示
  if (!isKeyConfigured) {
    return (
      <div className="field-map-picker">
        <div className="map-container map-placeholder" style={{ height: `${height}px` }}>
          <div className="map-placeholder-content">
            <span className="placeholder-icon">🗺️</span>
            <p className="placeholder-title">地图功能需要配置 API Key</p>
            <p className="placeholder-hint">
              请在 <code>.env</code> 文件中配置 <code>VITE_AMAP_KEY</code>
            </p>
            <a 
              href="https://console.amap.com/dev/key/app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="placeholder-link"
            >
              申请高德地图 API Key →
            </a>
          </div>
        </div>
        <div className="wkt-input-panel" style={{ margin: '12px' }}>
          <TextareaWithLabel
            label="或直接输入WKT格式"
            value={wktInput}
            onChange={(e) => setWktInput(e.target.value)}
            placeholder="POLYGON((经度1 纬度1, 经度2 纬度2, ...))"
            rows={3}
          />
          <button 
            className="btn-import" 
            onClick={importWKT}
            disabled={!wktInput.trim()}
          >
            导入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="field-map-picker">
      <div className="map-toolbar">
        <div className="toolbar-left">
          <button
            type="button"
            className={`tool-btn ${mode === 'draw' ? 'active' : ''}`}
            onClick={startDraw}
            disabled={mode === 'draw'}
          >
            绘制区域
          </button>
          <button
            type="button"
            className={`tool-btn ${mode === 'point' ? 'active' : ''}`}
            onClick={addMarker}
            disabled={mode === 'point'}
          >
            选择位置
          </button>
          <button
            type="button"
            className={`tool-btn ${showWKTInput ? 'active' : ''}`}
            onClick={() => setShowWKTInput(!showWKTInput)}
          >
            导入WKT
          </button>
        </div>
        <div className="toolbar-right">
          {currentWKT && (
            <button type="button" className="tool-btn danger" onClick={clearOverlay}>
              清除
            </button>
          )}
        </div>
      </div>

      {showWKTInput && (
        <div className="wkt-input-panel">
          <textarea
            value={wktInput}
            onChange={(e) => setWktInput(e.target.value)}
            placeholder="输入WKT格式，如: POLYGON((经度1 纬度1, 经度2 纬度2, ...))"
            rows={3}
          />
          <button type="button" className="btn-import" onClick={importWKT}>
            导入
          </button>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="map-container"
        style={{ height: `${height}px` }}
      />

      {mapError && <div className="map-error">{mapError}</div>}

      {currentWKT && (
        <div className="wkt-output">
          <label>当前WKT:</label>
          <div className="wkt-text">{currentWKT}</div>
        </div>
      )}

      {mode !== 'view' && (
        <div className="mode-hint">
          {mode === 'draw' && '点击地图开始绘制多边形区域'}
          {mode === 'point' && '点击地图选择位置'}
        </div>
      )}
    </div>
  )
}

// 内联Textarea组件
const TextareaWithLabel = ({ label, value, onChange, placeholder, rows }) => (
  <div className="textarea-with-label">
    <label>{label}</label>
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
  </div>
)

export default FieldMapPicker
