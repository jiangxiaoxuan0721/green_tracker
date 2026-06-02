import { useCallback, useState, useEffect } from 'react'
import { useDataList, useModal } from '@/hooks/common'
import useToast from '@/hooks/useToast'
import { mqttService } from '@/services/mqttService'
import { Button, Card, Modal, PageHeader } from '@/components/ui'
import { ItemCard, StatusBadge } from '@/components/business'
import { Wifi, WifiOff, Server, RefreshCw, Copy } from 'lucide-react'
import CommandConsole from './components/CommandConsole'
import './MQTT.css'
import '../AdditionalStyles.css'

const MQTT = () => {
  const { success: showSuccess, error: showError } = useToast()

  const fetchDevices = useCallback(async () => {
    const result = await mqttService.getDevices()
    return result.devices || []
  }, [])

  const {
    data: devices,
    initialLoading,
    error,
    refresh
  } = useDataList(fetchDevices, { autoFetch: true, pageSize: 100 })

  const [stats, setStats] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const {
    isOpen: isDetailOpen, modalData: detailDevice,
    openModal: openDetail, closeModal: closeDetail
  } = useModal()
  const {
    isOpen: isCredentialOpen, modalData: credentialData,
    openModal: openCredential, closeModal: closeCredential
  } = useModal()
  const [credentialLoading, setCredentialLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const s = await mqttService.getStats()
      setStats(s)
    } catch {
      // stats fetch is optional
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => { fetchStats(); refresh() }, 10000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchStats, refresh])

  const handleViewDetail = (device) => openDetail(device)

  const handleProvision = async (deviceId) => {
    setCredentialLoading(true)
    try {
      const result = await mqttService.provisionDevice(deviceId)
      openCredential(result)
      showSuccess('MQTT 凭证配置成功')
    } catch (err) {
      showError(err?.response?.data?.detail || '凭证配置失败')
    } finally {
      setCredentialLoading(false)
    }
  }

  const handleGetCredentials = async (deviceId) => {
    setCredentialLoading(true)
    try {
      const result = await mqttService.getDeviceCredentials(deviceId)
      openCredential(result)
      showSuccess('已获取 MQTT 凭证')
    } catch (err) {
      showError(err?.response?.data?.detail || '获取凭证失败')
    } finally {
      setCredentialLoading(false)
    }
  }

  const handleRegenerate = async (deviceId) => {
    setCredentialLoading(true)
    try {
      const result = await mqttService.regenerateDeviceCredentials(deviceId)
      openCredential(result)
      showSuccess('MQTT 凭证已重新生成')
    } catch (err) {
      showError(err?.response?.data?.detail || '重新生成凭证失败')
    } finally {
      setCredentialLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showSuccess('已复制到剪贴板'))
  }

  const formatTime = (t) => {
    if (!t) return '-'
    try { return new Date(t).toLocaleString() } catch { return t }
  }

  return (
    <div className="dashboard-mqtt">
      <PageHeader
        icon={Wifi}
        title="MQTT 设备管理"
        description="监控物理设备在线状态，管理 MQTT 连接凭证与下发控制指令"
        actions={
          <div className="mqtt-header-actions">
            <label className="mqtt-auto-refresh">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              <span>自动刷新</span>
            </label>
            <Button variant="outline" size="small" icon={RefreshCw} onClick={() => { fetchStats(); refresh() }}>
              刷新
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="mqtt-stats-grid">
          <Card className="mqtt-stat-card">
            <div className="mqtt-stat-icon broker">
              <Server size={22} />
            </div>
            <div className="mqtt-stat-info">
              <span className={`mqtt-stat-value ${stats.mqtt_connected ? 'text-success' : 'text-error'}`}>
                {stats.mqtt_connected ? '已连接' : '未连接'}
              </span>
              <span className="mqtt-stat-label">Broker 状态</span>
            </div>
          </Card>

          <Card className="mqtt-stat-card">
            <div className="mqtt-stat-icon online">
              <Wifi size={22} />
            </div>
            <div className="mqtt-stat-info">
              <span className="mqtt-stat-value">{stats.online_devices}</span>
              <span className="mqtt-stat-label">在线设备</span>
            </div>
          </Card>

          <Card className="mqtt-stat-card">
            <div className="mqtt-stat-icon offline">
              <WifiOff size={22} />
            </div>
            <div className="mqtt-stat-info">
              <span className="mqtt-stat-value">{stats.offline_devices}</span>
              <span className="mqtt-stat-label">离线设备</span>
            </div>
          </Card>

          <Card className="mqtt-stat-card">
            <div className="mqtt-stat-icon pending">
              <RefreshCw size={22} />
            </div>
            <div className="mqtt-stat-info">
              <span className="mqtt-stat-value">{stats.pending_commands}</span>
              <span className="mqtt-stat-label">待响应命令</span>
            </div>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {initialLoading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-dots">
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
          </div>
          <div className="dashboard-loading-text">正在连接 MQTT 服务...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="error-card">
          <p>{error}</p>
          <Button variant="outline" onClick={() => { fetchStats(); refresh() }}>重试</Button>
        </Card>
      )}

      {/* Empty State */}
      {!initialLoading && !error && devices.length === 0 && (
        <Card className="empty-state">
          <div className="empty-icon">📡</div>
          <h3>暂无在线设备连接</h3>
          <p>等待物理设备通过 MQTT 连接到 Broker 后，将自动显示在此处</p>
          <div className="empty-state-tips">
            <p>设备连接方法：</p>
            <ul>
              <li>在 <strong>设备管理</strong> 页面创建逻辑设备</li>
              <li>点击设备操作中的"MQTT凭证"获取连接信息</li>
              <li>在物理设备上配置 MQTT 连接参数（Broker 地址、设备 ID、密钥）</li>
              <li>物理设备上线后将自动显示在此处</li>
            </ul>
          </div>
        </Card>
      )}

      {/* Device List */}
      {!initialLoading && !error && devices.length > 0 && (
        <div className="devices-grid">
          {devices.map((device) => (
            <ItemCard
              key={device.device_id}
              item={device}
              type="mqtt"
              onView={handleViewDetail}
              customInfo={(item) => (
                <>
                  <div className="item-info-row">
                    <span>在线状态</span>
                    <StatusBadge status={item.status === 'online' ? 'online' : 'offline'} />
                  </div>
                  <div className="item-info-row">
                    <span>IP 地址</span>
                    <span>{item.ip_address || '-'}</span>
                  </div>
                  <div className="item-info-row">
                    <span>最后心跳</span>
                    <span>{formatTime(item.last_seen)}</span>
                  </div>
                  <div className="item-info-row">
                    <span>已注册</span>
                    <span style={{ color: item.registered ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {item.registered ? '已注册' : '未注册'}
                    </span>
                  </div>
                </>
              )}
              actions={(item) => (
                <div className="item-card-actions">
                  <Button size="small" variant="outline" onClick={() => handleViewDetail(item)}>
                    详情
                  </Button>
                  <Button size="small" variant="outline" onClick={() => handleGetCredentials(item.device_id)}>
                    凭证
                  </Button>
                </div>
              )}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {isDetailOpen && detailDevice && (
        <Modal
          isOpen={isDetailOpen}
          onClose={closeDetail}
          title="设备详情"
          size="large"
        >
          <div className="mqtt-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">设备名称</span>
                <span className="detail-value">{detailDevice.name || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">设备 ID</span>
                <span className="detail-value mono">{detailDevice.device_id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">在线状态</span>
                <StatusBadge status={detailDevice.status === 'online' ? 'online' : 'offline'} />
              </div>
              <div className="detail-item">
                <span className="detail-label">IP 地址</span>
                <span className="detail-value">{detailDevice.ip_address || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Client ID</span>
                <span className="detail-value mono">{detailDevice.client_id || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">最后在线</span>
                <span className="detail-value">{formatTime(detailDevice.last_seen)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">已注册</span>
                <span className="detail-value" style={{ color: detailDevice.registered ? 'var(--success-color)' : 'var(--text-muted)' }}>
                  {detailDevice.registered ? '是' : '否'}
                </span>
              </div>
            </div>

            {detailDevice.status === 'online' && (
              <div className="mqtt-command-section">
                <CommandConsole deviceId={detailDevice.device_id} />
              </div>
            )}

            {detailDevice.connect_history && detailDevice.connect_history.length > 0 && (
              <div className="mqtt-history">
                <h4>连接历史</h4>
                <div className="history-list">
                  {[...detailDevice.connect_history].reverse().slice(0, 15).map((h, i) => (
                    <div key={i} className={`history-item ${h.event}`}>
                      <span className="history-time">{formatTime(h.time)}</span>
                      <StatusBadge status={h.event === 'connected' ? 'online' : 'offline'} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Credential Modal */}
      {isCredentialOpen && credentialData && (
        <Modal
          isOpen={isCredentialOpen}
          onClose={() => { closeCredential(); setCredentialLoading(false) }}
          title="MQTT 连接凭证"
          size="medium"
        >
          <div className="mqtt-credential">
            {credentialLoading ? (
              <div className="dashboard-loading">
                <div className="dashboard-loading-dots">
                  <div className="dashboard-loading-dot"></div>
                  <div className="dashboard-loading-dot"></div>
                  <div className="dashboard-loading-dot"></div>
                </div>
                <div className="dashboard-loading-text">正在获取凭证...</div>
              </div>
            ) : (
              <>
                <div className="credential-block">
                  <pre>{`MQTT_DEVICE_ID=${credentialData.mqtt_username}
MQTT_DEVICE_SECRET=${credentialData.mqtt_secret}
MQTT_BROKER_HOST=${credentialData.mqtt_broker_host || '-'}
MQTT_BROKER_PORT=${credentialData.mqtt_broker_port || '-'}`}</pre>
                  <div className="credential-actions">
                    <Button variant="outline" size="small" icon={Copy} onClick={() => {
                      const text = `MQTT_DEVICE_ID=${credentialData.mqtt_username}
MQTT_DEVICE_SECRET=${credentialData.mqtt_secret}
MQTT_BROKER_HOST=${credentialData.mqtt_broker_host || '-'}
MQTT_BROKER_PORT=${credentialData.mqtt_broker_port || '-'}`
                      copyToClipboard(text)
                    }}>
                      复制
                    </Button>
                    <Button variant="outline" size="small" icon={RefreshCw} onClick={() => handleRegenerate(credentialData.mqtt_username)}>
                      重新生成凭证
                    </Button>
                  </div>
                  <p className="credential-warning">重新生成后旧凭证将立即失效，已连接的设备需更新凭证后重新连接。</p>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default MQTT
