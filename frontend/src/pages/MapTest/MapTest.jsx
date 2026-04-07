import { useEffect, useRef, useState } from 'react'
import './map.css'

const AMapKey = import.meta.env.VITE_AMAP_KEY

/**
 * 独立地图测试页面
 */
const MapTest = () => {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const [status, setStatus] = useState('初始化中...')
  const [error, setError] = useState('')
  const [mapReady, setMapReady] = useState(false)

  const isKeyConfigured = AMapKey && !AMapKey.includes('your_') && AMapKey.length > 10

  useEffect(() => {
    if (!isKeyConfigured) {
      setError('请在 .env 中配置 VITE_AMAP_KEY')
      setStatus('配置缺失')
      return
    }

    setStatus('加载地图 SDK...')

    // 配置安全密钥（必须在加载 SDK 之前）
    const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE
    if (securityCode && !securityCode.includes('your_')) {
      window._AMapSecurityConfig = {
        securityJsCode: securityCode
      }
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMapKey}`
    script.async = true
    
    script.onload = () => {
      setStatus('SDK 加载成功，初始化地图...')
      
      // 延迟初始化
      setTimeout(() => {
        if (!mapContainerRef.current) {
          setError('地图容器不存在')
          return
        }

        try {
          const map = new window.AMap.Map(mapContainerRef.current, {
            zoom: 12,
            center: [116.397428, 39.90923],
            viewMode: '2D',
            mapStyle: 'amap://styles/normal'
          })

          map.on('complete', () => {
            setStatus('地图加载完成!')
            setMapReady(true)
          })

          map.on('error', (e) => {
            console.error('地图错误:', e)
            setError('地图加载出错')
          })

          mapRef.current = map
        } catch (e) {
          console.error('初始化地图失败:', e)
          setError(`初始化失败: ${e.message}`)
        }
      }, 500)
    }

    script.onerror = () => {
      setError('SDK 加载失败')
      setStatus('加载失败')
    }

    document.head.appendChild(script)

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy()
      }
    }
  }, [])

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <h1 style={{ marginBottom: '20px' }}>🗺️ 高德地图独立测试</h1>
      
      {/* 配置信息 */}
      <div style={{ 
        background: '#f5f5f5', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>配置信息</h3>
        <p><strong>API Key:</strong> {isKeyConfigured ? `✅ 已配置 (${AMapKey.substring(0, 10)}...)` : '❌ 未配置'}</p>
        <p><strong>环境变量:</strong> {import.meta.env.MODE}</p>
        <p><strong>当前域名:</strong> {window.location.host}</p>
      </div>

      {/* 状态信息 */}
      <div style={{ 
        background: mapReady ? '#d4edda' : '#fff3cd', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px',
        color: mapReady ? '#155724' : '#856404'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>状态</h3>
        <p style={{ margin: 0 }}>{status}</p>
        {error && <p style={{ color: '#dc3545', margin: '10px 0 0 0' }}>错误: {error}</p>}
      </div>

      {/* 地图容器 */}
      <div style={{ 
        border: '2px solid #007bff', 
        borderRadius: '8px', 
        overflow: 'hidden',
        background: '#e9ecef'
      }}>
        <div
          ref={mapContainerRef}
          className="map-container"
          style={{ 
            height: '500px',
            width: '100%'
          }}
        />
      </div>

      {/* 调试提示 */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        background: '#d1ecf1',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>调试提示</h3>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li>检查浏览器控制台是否有错误</li>
          <li>确保在高德开放平台配置了正确的域名白名单</li>
          <li>如果使用了安全密钥，需配置 VITE_AMAP_SECURITY_CODE</li>
          <li>尝试清除浏览器缓存后刷新</li>
        </ol>
      </div>
    </div>
  )
}

export default MapTest
