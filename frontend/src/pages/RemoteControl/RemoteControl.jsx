import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/auth/useAuth'
import { deviceService } from '@/services/deviceService'
import { Button } from '@/components/ui'
import { CommandConsole, StatusBadge } from '@/components/business'
import { AlertCircle, ArrowLeft, Loader2, Monitor, RefreshCw } from 'lucide-react'
import './RemoteControl.css'

// 直接访问 URL（无跳转来源）时的兜底返回目标
const FALLBACK_BACK_PATH = '/dashboard/devices'

/**
 * 独立全屏远程控制台页面
 *
 * 路由：/remote_control/:deviceId（与 /dashboard 同级，不套用控制面板侧边栏）
 * 入口：设备管理页卡片上的「进入控制台」按钮
 */
const RemoteControl = () => {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading: authLoading } = useAuth()

  // 返回目标：优先回到跳转来源，直接访问 URL 时兜底回设备管理页
  const backTo = location.state?.from || FALLBACK_BACK_PATH

  // 跳转来源会带上设备快照，用于首屏立即渲染标题；直接访问或刷新时为 null
  const cachedDevice = location.state?.device || null
  const [device, setDevice] = useState(cachedDevice)
  const [loading, setLoading] = useState(!cachedDevice)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const fetchDevice = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    setError(null)
    try {
      setDevice(await deviceService.getDeviceById(deviceId))
    } catch (err) {
      console.error('[远程控制] 加载设备信息失败:', err)
      setError(
        err?.response?.status === 404
          ? '设备不存在或已被删除'
          : (err?.response?.data?.detail || '设备信息加载失败')
      )
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    fetchDevice()
  }, [authLoading, isAuthenticated, fetchDevice])

  const title = device?.name || deviceId || '未知设备'
  const online = device?.online

  const renderContent = () => {
    if (authLoading) {
      return (
        <div className="rc-state">
          <Loader2 size={22} className="rc-spin" />
          <p>正在验证身份…</p>
        </div>
      )
    }

    if (!device && error) {
      return (
        <div className="rc-state rc-state-error">
          <AlertCircle size={26} />
          <h3>{error}</h3>
          <p>请确认设备是否存在，或返回设备管理页重新选择。</p>
          <div className="rc-state-actions">
            <Button variant="primary" onClick={fetchDevice}>重试</Button>
            <Button variant="outline" onClick={() => navigate(backTo)}>返回设备管理</Button>
          </div>
        </div>
      )
    }

    if (!device) {
      return (
        <div className="rc-state">
          <Loader2 size={22} className="rc-spin" />
          <p>正在加载设备信息…</p>
        </div>
      )
    }

    return (
      <div className="rc-main">
        {error && (
          <div className="rc-notice">
            <AlertCircle size={14} />
            <span>{error}，当前显示的可能不是最新状态</span>
            <Button variant="ghost" size="small" onClick={fetchDevice}>重试</Button>
          </div>
        )}
        <CommandConsole deviceId={deviceId} fill />
      </div>
    )
  }

  return (
    <div className="remote-control-page">
      <header className="rc-topbar">
        <Button variant="ghost" size="small" icon={ArrowLeft} onClick={() => navigate(backTo)}>
          返回
        </Button>

        <div className="rc-topbar-title">
          <span className="rc-topbar-icon"><Monitor size={18} /></span>
          <h1 title={title}>{title}</h1>
          {typeof online === 'boolean' && (
            <StatusBadge status={online ? 'online' : 'offline'} />
          )}
        </div>

        <div className="rc-topbar-meta">
          <span className="rc-topbar-device-id" title={deviceId}>{deviceId}</span>
          <Button variant="outline" size="small" icon={RefreshCw} onClick={fetchDevice} loading={loading}>
            刷新
          </Button>
        </div>
      </header>

      <div className="rc-body">{renderContent()}</div>
    </div>
  )
}

export default RemoteControl
