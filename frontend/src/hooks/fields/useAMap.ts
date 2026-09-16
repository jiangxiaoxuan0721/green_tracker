import { useEffect, useState } from 'react'
import { env } from '@/config/env'

declare global {
  interface Window {
    // 高德 SDK 无官方 .d.ts，按 any 暴露给调用方使用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AMap?: any
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

const AMapKey = env.AMAP_KEY
const AMapSecurityCode = env.AMAP_SECURITY_CODE

/**
 * 判定 Key 是否可用。
 * 除占位符判断外还要求长度 > 10，避免把明显无效的超短值拼进 SDK URL（会静默加载失败）。
 */
const isKeyConfigured = Boolean(AMapKey) && !AMapKey.includes('your_') && AMapKey.length > 10

/** 与高德 SDK 约定：必须在加载 maps 脚本之前挂上 */
const configureSecurity = () => {
  if (!window._AMapSecurityConfig && AMapSecurityCode && !AMapSecurityCode.includes('your_')) {
    window._AMapSecurityConfig = { securityJsCode: AMapSecurityCode }
  }
}

let loaderPromise: Promise<void> | null = null

const loadAMap = (): Promise<void> => {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<void>((resolve, reject) => {
    if (window.AMap) {
      resolve()
      return
    }
    if (!isKeyConfigured) {
      reject(new Error('未配置 VITE_AMAP_KEY'))
      return
    }
    configureSecurity()
    const script = document.createElement('script')
    // MouseTool 供地图绘制使用；ToolBar/Scale 为底图控件
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMapKey}&plugin=AMap.ToolBar,AMap.Scale,AMap.MouseTool`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('高德地图 SDK 加载失败'))
    document.head.appendChild(script)
  })

  // 加载失败时清缓存，下次挂载可重试（例如网络瞬时故障）
  loaderPromise.catch(() => {
    loaderPromise = null
  })

  return loaderPromise
}

/** 加载高德 SDK（单例）。ready 为 true 时 window.AMap 已可用。 */
export const useAMap = (): { ready: boolean; error: string | null } => {
  const [ready, setReady] = useState(() => Boolean(window.AMap))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAMap()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ready, error }
}

export default useAMap
