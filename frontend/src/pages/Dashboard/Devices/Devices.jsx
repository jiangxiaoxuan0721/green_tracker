import { useCallback, useState } from 'react'
import { useDataList, useModal } from '@/hooks/common'
import { useAuth } from '@/hooks/auth/useAuth'
import { deviceService } from '@/services/deviceService'
import { mqttService } from '@/services/mqttService'
import useToast from '@/hooks/useToast'
import { Button, Card, Modal, PageHeader } from '@/components/ui'
import { ItemCard } from '@/components/business'
import { Radio, Plus, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import DeviceForm from './components/DeviceForm'
import DeviceDetail from './components/DeviceDetail'
import './Devices.css'
import '../AdditionalStyles.css'

const Devices = () => {
  const { user } = useAuth()
  const { success: showSuccess, error: showError } = useToast()

  const fetchDevices = useCallback(async () => {
    if (!user?.id) return []
    return await deviceService.getDevices()
  }, [user?.id])

  const {
    data: devices,
    initialLoading,
    error,
    refresh
  } = useDataList(
    fetchDevices,
    {
      autoFetch: true,
      pageSize: 100
    }
  )

  const { isOpen: isFormOpen, modalData: formDevice, openModal: openForm, closeModal: closeForm } = useModal()
  const { isOpen: isDetailOpen, modalData: detailDevice, openModal: openDetail, closeModal: closeDetail } = useModal()
  const {
    isOpen: isCredentialOpen, modalData: credentialData,
    openModal: openCredential, closeModal: closeCredential
  } = useModal()
  const [credentialLoading, setCredentialLoading] = useState(false)
  const [showCredential, setShowCredential] = useState(false)
  const [currentCredentialDeviceId, setCurrentCredentialDeviceId] = useState(null)

  const getPlatformLevelText = (platformLevel) => {
    const platformMap = {
      '天': '天基',
      '空': '空基',
      '地': '地基',
      '具身': '具身智能'
    }
    return platformMap[platformLevel] || platformLevel
  }

  const getDeviceTypeText = (deviceType) => {
    const typeMap = {
      'satellite': '卫星',
      'uav': '无人机',
      'ugv': '地面车',
      'robot': '机器人',
      'sensor': '传感器'
    }
    return typeMap[deviceType] || deviceType
  }

  const handleCreate = () => {
    openForm(null)
  }

  const handleEdit = (device) => {
    openForm(device)
  }

  const handleView = (device) => {
    openDetail(device)
  }

  const handleDelete = async (device) => {
    if (!window.confirm('确定要删除这个设备吗？')) {
      return
    }
    try {
      await deviceService.deleteDevice(device.id)
      refresh()
    } catch (err) {
      console.error('删除设备失败:', err)
    }
  }

  const handleFormSuccess = () => {
    closeForm()
    refresh()
  }

  const handleDetailEdit = (device) => {
    closeDetail()
    openForm(device)
  }

  const handleProvision = async (deviceId) => {
    setCredentialLoading(true)
    setCurrentCredentialDeviceId(deviceId)
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
    setCurrentCredentialDeviceId(deviceId)
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

  const handleRegenerate = async () => {
    if (!currentCredentialDeviceId) return
    setCredentialLoading(true)
    try {
      const result = await mqttService.regenerateDeviceCredentials(currentCredentialDeviceId)
      openCredential(result)
      showSuccess('MQTT 凭证已重新生成')
    } catch (err) {
      showError(err?.response?.data?.detail || '重新生成凭证失败')
    } finally {
      setCredentialLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showSuccess('已复制到剪贴板')).catch(() => {
        showError('复制失败，请手动复制')
      })
    } else {
      // fallback: 使用 textarea + execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        showSuccess('已复制到剪贴板')
      } catch {
        showError('复制失败，请手动复制')
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }

  return (
    <div className="dashboard-devices">
      <PageHeader
        icon={Radio}
        title="设备管理"
        description="管理多种类型的监测设备（卫星、无人机、传感器等）"
        actions={
          <Button variant="primary" onClick={handleCreate} icon={Plus}>
            添加设备
          </Button>
        }
      />

      {initialLoading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-dots">
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
          </div>
          <div className="dashboard-loading-text">正在加载设备数据...</div>
        </div>
      )}

      {error && (
        <Card className="error-card">
          <p>{error}</p>
          <Button variant="outline" onClick={refresh}>重试</Button>
        </Card>
      )}

      {!initialLoading && !error && devices.length === 0 && (
        <Card className="empty-state">
          <div className="empty-icon">📡</div>
          <h3>还没有设备</h3>
          <p>点击右上角的"添加设备"按钮开始管理您的监测设备</p>
          <div className="empty-state-tips">
            <p>您可以：</p>
            <ul>
              <li>添加多种类型的监测设备（卫星、无人机、传感器等）</li>
              <li>配置设备的传感器和执行机构</li>
              <li>按平台层级（天/空/地/具身）组织设备</li>
            </ul>
          </div>
        </Card>
      )}

      {!initialLoading && !error && devices.length > 0 && (
        <div className="devices-grid">
          {devices.map(device => (
            <ItemCard
              key={device.id}
              item={device}
              type="device"
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              actions={(item) => (
                <div className="item-card-actions">
                  <Button size="small" variant="outline" onClick={() => handleView(item)}>
                    详情
                  </Button>
                  <Button size="small" variant="primary" onClick={() => handleEdit(item)}>
                    编辑
                  </Button>
                  <Button size="small" variant="outline" onClick={() => handleProvision(item.id)}>
                    凭证
                  </Button>
                  <Button size="small" variant="danger" onClick={() => handleDelete(item)}>
                    删除
                  </Button>
                </div>
              )}
              customInfo={(item) => (
                <>
                  <div className="item-info-row">
                    <span>在线</span>
                    <span className={`status-badge ${item.online ? 'status-completed' : 'status-failed'}`}
                          style={{ display: 'inline-flex', padding: '1px 6px', fontSize: '0.625rem' }}>
                      {item.online ? '在线' : '离线'}
                    </span>
                  </div>
                  <div className="item-info-row">
                    <span>类型</span>
                    <span>{getDeviceTypeText(item.device_type)}</span>
                  </div>
                  <div className="item-info-row">
                    <span>平台层级</span>
                    <span>{getPlatformLevelText(item.platform_level)}</span>
                  </div>
                  <div className="item-info-row">
                    <span>型号</span>
                    <span>{item.model || '-'}</span>
                  </div>
                  <div className="item-info-row">
                    <span>制造商</span>
                    <span>{item.manufacturer || '-'}</span>
                  </div>
                  {item.sensors && Object.keys(item.sensors).length > 0 && (
                    <div className="item-info-row">
                      <span>传感器</span>
                      <span>{Object.keys(item.sensors).join(', ')}</span>
                    </div>
                  )}
                  {item.actuators && Object.keys(item.actuators).length > 0 && (
                    <div className="item-info-row">
                      <span>执行机构</span>
                      <span>{Object.keys(item.actuators).join(', ')}</span>
                    </div>
                  )}
                </>
              )}
            />
          ))}
        </div>
      )}

      {isFormOpen && (
        <DeviceForm
          isOpen={isFormOpen}
          mode={formDevice ? 'edit' : 'create'}
          device={formDevice}
          onClose={closeForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {isDetailOpen && detailDevice && (
        <DeviceDetail
          device={detailDevice}
          onClose={closeDetail}
          onEdit={() => handleDetailEdit(detailDevice)}
        />
      )}

      {/* MQTT 凭证 Modal */}
      {isCredentialOpen && (
        <Modal
          isOpen={isCredentialOpen}
          onClose={() => { closeCredential(); setCredentialLoading(false); setShowCredential(false); setCurrentCredentialDeviceId(null) }}
          title="MQTT 连接凭证"
          size="medium"
        >
          {credentialLoading ? (
            <div className="dashboard-loading">
              <div className="dashboard-loading-dots">
                <div className="dashboard-loading-dot"></div>
                <div className="dashboard-loading-dot"></div>
                <div className="dashboard-loading-dot"></div>
              </div>
              <div className="dashboard-loading-text">正在获取凭证...</div>
            </div>
          ) : credentialData ? (
            <div className="mqtt-credential">
              <div className="credential-block">
                {showCredential ? (
                  <pre>{`MQTT_DEVICE_ID=${credentialData.mqtt_username}
MQTT_DEVICE_SECRET=${credentialData.mqtt_secret}
MQTT_BROKER_HOST=${credentialData.mqtt_broker_host || '-'}
MQTT_BROKER_PORT=${credentialData.mqtt_broker_port || '-'}`}</pre>
                ) : (
                  <div className="credential-masked">
                    <p>凭证内容已隐藏，点击"显示"按钮查看</p>
                  </div>
                )}
                <div className="credential-actions">
                  <Button
                    variant="outline"
                    size="small"
                    icon={showCredential ? EyeOff : Eye}
                    onClick={() => setShowCredential(!showCredential)}
                  >
                    {showCredential ? '隐藏' : '显示'}
                  </Button>
                  <Button variant="outline" size="small" icon={Copy} onClick={() => {
                    const text = `MQTT_DEVICE_ID=${credentialData.mqtt_username}
MQTT_DEVICE_SECRET=${credentialData.mqtt_secret}
MQTT_BROKER_HOST=${credentialData.mqtt_broker_host || '-'}
MQTT_BROKER_PORT=${credentialData.mqtt_broker_port || '-'}`
                    copyToClipboard(text)
                  }}>
                    复制
                  </Button>
                  <Button variant="outline" size="small" icon={RefreshCw} onClick={handleRegenerate}>
                    重新生成凭证
                  </Button>
                </div>
                <p className="credential-warning">重新生成后旧凭证将立即失效，已连接的设备需更新凭证后重新连接。</p>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  )
}

export default Devices