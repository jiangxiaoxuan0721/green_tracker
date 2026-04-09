import { useEffect, useRef, useState } from 'react'
import './map.css'

const AMapKey = import.meta.env.VITE_AMAP_KEY

/**
 * 地图展示组件 - 用于显示地块位置
 */
const MapDisplay = ({
  wkt = '',
  height = 300,
  center = [116.397428, 39.90923],
  zoom = 10,
  showControls = true,
  visible = true,
  initialMapType = 'satellite' // 'normal' | 'satellite'
}) => {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const markerRef = useRef(null)
  const satelliteLayerRef = useRef(null)
  const labelLayerRef = useRef(null)
  const initTimerRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapType, setMapType] = useState(initialMapType)

  const isKeyConfigured = AMapKey && !AMapKey.includes('your_') && AMapKey.length > 10

  // 加载高德地图JS API
  useEffect(() => {
    if (!isKeyConfigured) {
      setLoading(false)
      setError('请配置高德地图API Key')
      return
    }

    if (window.AMap) {
      setLoading(false)
      return
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMapKey}&plugin=AMap.ToolBar,AMap.Scale`
    script.async = true
    script.onload = () => setLoading(false)
    script.onerror = () => {
      setLoading(false)
      setError('地图加载失败')
    }
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [isKeyConfigured])

  // 解析WKT
  const parseWKT = (wktStr) => {
    if (!wktStr) return []

    try {
      const cleanWkt = wktStr.trim().toUpperCase()

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
      console.error('WKT解析失败:', e)
      return []
    }
  }

  // 切换底图类型
  const toggleMapType = () => {
    if (!mapRef.current) return

    const newType = mapType === 'satellite' ? 'normal' : 'satellite'

    // 先移除现有图层
    if (satelliteLayerRef.current) {
      mapRef.current.removeLayer(satelliteLayerRef.current)
      satelliteLayerRef.current = null
    }
    if (labelLayerRef.current) {
      mapRef.current.removeLayer(labelLayerRef.current)
      labelLayerRef.current = null
    }

    if (newType === 'satellite') {
      // 卫星模式：添加卫星图层 + 标注图层
      satelliteLayerRef.current = new window.AMap.TileLayer.Satellite()
      mapRef.current.addLayer(satelliteLayerRef.current)
      labelLayerRef.current = new window.AMap.TileLayer.RoadNet({ opacity: 0.8 })
      mapRef.current.addLayer(labelLayerRef.current)
      mapRef.current.setMapStyle('amap://styles/light')
    } else {
      // 普通模式：使用标准底图
      mapRef.current.setMapStyle('amap://styles/normal')
    }

    // 延迟更新状态
    setTimeout(() => setMapType(newType), 50)
  }

  // 初始化/更新地图
  useEffect(() => {
    if (!mapContainerRef.current || !window.AMap || !isKeyConfigured) return

    // 等待容器可见后再初始化
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return
      
      // 检查容器是否可见
      const rect = mapContainerRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        // 容器不可见，延迟重试
        initTimerRef.current = setTimeout(() => {
          // 销毁地图和清理图层引用
          if (mapRef.current) {
            mapRef.current.destroy()
            mapRef.current = null
          }
          satelliteLayerRef.current = null
          labelLayerRef.current = null
          // 触发重新渲染
          setLoading(true)
          setTimeout(() => setLoading(false), 100)
        }, 300)
        return
      }
      
      const coords = parseWKT(wkt)

      if (!mapRef.current) {
        const mapCenter = coords.length > 0 ? (coords.length === 1 ? coords[0] : getCenter(coords)) : center
        const map = new window.AMap.Map(mapContainerRef.current, {
          zoom: coords.length > 0 ? (coords.length === 1 ? 15 : 12) : zoom,
          center: mapCenter,
          viewMode: '2D',
          mapStyle: 'amap://styles/normal',
          resizeEnable: true,
          showLabel: true
        })

        // 添加底图图层
        if (mapType === 'satellite') {
          // 卫星图层
          satelliteLayerRef.current = new window.AMap.TileLayer.Satellite()
          map.addLayer(satelliteLayerRef.current)
          // 标注图层（显示地名、道路等）
          labelLayerRef.current = new window.AMap.TileLayer.RoadNet({
            opacity: 0.8
          })
          map.addLayer(labelLayerRef.current)
        }

        if (showControls) {
          // 加载控件插件
          window.AMap.plugin(['AMap.Scale', 'AMap.ToolBar'], () => {
            map.addControl(new window.AMap.Scale())
            map.addControl(new window.AMap.ToolBar({ position: 'RB' }))
          })
        }
        
        // 地图加载完成后触发 resize
        map.on('complete', () => {
          setTimeout(() => {
            map.resize()
          }, 100)
        })

        mapRef.current = map
      }

      // 清除旧覆盖物
      if (polygonRef.current) {
        mapRef.current.remove(polygonRef.current)
        polygonRef.current = null
      }
      if (markerRef.current) {
        mapRef.current.remove(markerRef.current)
        markerRef.current = null
      }

      // 添加新覆盖物
      if (coords.length > 0) {
        console.log('[MapDisplay] 添加覆盖物, 类型:', coords.length === 1 ? 'POINT' : 'POLYGON', '坐标:', coords)
        if (coords.length === 1) {
          // POINT
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
          mapRef.current.setZoom(15)
        } else {
          // POLYGON - 设置多边形并定位到区域
          polygonRef.current = new window.AMap.Polygon({
            path: coords,
            fillColor: '#00b4d8',
            fillOpacity: 0.4,
            strokeColor: '#ff0000',
            strokeWeight: 3,
            zIndex: 100
          })
          mapRef.current.add(polygonRef.current)
          // 延迟设置视野，确保地图已准备好
          setTimeout(() => {
            if (mapRef.current && polygonRef.current) {
              mapRef.current.setFitView([polygonRef.current])
            }
          }, 100)
        }
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      clearTimeout(initTimerRef.current)
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [isKeyConfigured, wkt, zoom, center, showControls, visible, mapType])

  // 计算中心点
  const getCenter = (coords) => {
    if (!coords || coords.length === 0) return center
    
    let sumLng = 0, sumLat = 0
    coords.forEach(coord => {
      sumLng += coord[0]
      sumLat += coord[1]
    })
    return [sumLng / coords.length, sumLat / coords.length]
  }

  if (!wkt) {
    return (
      <div className="map-display map-empty" style={{ height: `${height}px` }}>
        <span>暂无位置信息</span>
      </div>
    )
  }

  return (
    <div className="map-display">
      {loading ? (
        <div className="map-loading" style={{ height: `${height}px` }}>
          地图加载中...
        </div>
      ) : error ? (
        <div className="map-error-display" style={{ height: `${height}px` }}>
          {error}
        </div>
      ) : (
        <>
          <div
            ref={mapContainerRef}
            className="map-container"
            style={{ height: `${height}px` }}
          />
          {/* 图层切换按钮 */}
          <div className="map-type-toggle">
            <button
              onClick={toggleMapType}
              className="map-type-btn"
              title={mapType === 'satellite' ? '切换到普通地图' : '切换到卫星图'}
            >
              {mapType === 'satellite' ? '🗺️ 普通地图' : '🛰️ 卫星地图'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default MapDisplay
