import { useCallback } from 'react'
import { useDataList, useModal } from '@/hooks/common'
import { useAuth } from '@/hooks/auth/useAuth'
import { deviceService } from '@/services/deviceService'
import { Button, Card, PageHeader } from '@/components/ui'
import { ItemCard } from '@/components/business'
import { Radio, Plus } from 'lucide-react'
import DeviceForm from './components/DeviceForm'
import DeviceDetail from './components/DeviceDetail'
import './Devices.css'
import '../AdditionalStyles.css'

const Devices = () => {
  const { user } = useAuth()

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
              customInfo={(item) => (
                <>
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
    </div>
  )
}

export default Devices