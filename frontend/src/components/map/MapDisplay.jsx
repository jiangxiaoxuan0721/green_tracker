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
  visible = true
}) => {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const markerRef = useRef(null)
  const initTimerRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          if (mapRef.current) {
            mapRef.current.destroy()
            mapRef.current = null
          }
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
          showLabel: false
        })

        if (showControls) {
          map.addControl(new window.AMap.Scale())
          map.addControl(new window.AMap.ToolBar({ position: 'RB' }))
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
        } else {
          // POLYGON
          polygonRef.current = new window.AMap.Polygon({
            path: coords,
            fillColor: '#00b4d8',
            fillOpacity: 0.3,
            strokeColor: '#0077b6',
            strokeWeight: 2
          })
          mapRef.current.add(polygonRef.current)
          mapRef.current.setFitView([polygonRef.current])
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
  }, [isKeyConfigured, wkt, zoom, center, showControls, visible])

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
        <div
          ref={mapContainerRef}
          className="map-container"
          style={{ height: `${height}px` }}
        />
      )}
    </div>
  )
}

export default MapDisplay
