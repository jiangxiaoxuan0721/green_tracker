import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/auth/useAuth'
import { deviceService } from '../../../services/deviceService'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './Devices.css'
import DeviceForm from './components/DeviceForm'
import DeviceDetail from './components/DeviceDetail'

const Devices = () => {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [formMode, setFormMode] = useState('create')
  const [refreshKey, setRefreshKey] = useState(0)

  // 加载设备数据
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true)
        // 获取当前用户的设备
        const devicesData = await deviceService.getDevices({ owner_id: user?.id })
        setDevices(devicesData)
        setError(null)
      } catch (err) {
        setError(err.message || '获取设备数据失败')
        console.error('获取设备数据失败:', err)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchDevices()
    }
  }, [user, refreshKey])

  // 处理创建设备
  const handleCreateDevice = () => {
    setSelectedDevice(null)
    setFormMode('create')
    setShowForm(true)
  }

  // 处理编辑设备
  const handleEditDevice = (device) => {
    setSelectedDevice(device)
    setFormMode('edit')
    setShowForm(true)
  }

  // 处理查看详情
  const handleViewDetail = (device) => {
    setSelectedDevice(device)
    setShowDetail(true)
  }

  // 处理删除设备
  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm('确定要删除这个设备吗？')) {
      return
    }

    try {
      await deviceService.deleteDevice(deviceId)
      // 刷新列表
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      setError(err.message || '删除设备失败')
      console.error('删除设备失败:', err)
    }
  }

  // 处理表单关闭
  const handleFormClose = () => {
    setShowForm(false)
    setSelectedDevice(null)
  }

  // 处理表单提交成功
  const handleFormSuccess = () => {
    setShowForm(false)
    setSelectedDevice(null)
    // 刷新列表
    setRefreshKey(prev => prev + 1)
  }

  // 处理详情关闭
  const handleDetailClose = () => {
    setShowDetail(false)
    setSelectedDevice(null)
  }

  // 获取设备状态的CSS类
  const getStatusClass = (isActive) => {
    return isActive ? 'status-active' : 'status-inactive'
  }

  // 获取平台层级的显示名称
  const getPlatformLevelText = (platformLevel) => {
    const platformMap = {
      '天': '天基',
      '空': '空基',
      '地': '地基',
      '具身': '具身智能'
    }
    return platformMap[platformLevel] || platformLevel
  }

  // 获取设备类型的显示名称
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

  // 渲染加载状态
  if (loading) {
    return (
      <div className="dashboard-devices">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载设备数据...</p>
        </div>
      </div>
    )
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="dashboard-devices">
        <div className="error-container">
          <h3>加载失败</h3>
          <p>{error}</p>
          <button className="primary-btn" onClick={() => setRefreshKey(prev => prev + 1)}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-devices">
      <div className="dashboard-header">
        <h1>设备管理</h1>
        <button className="primary-btn" onClick={handleCreateDevice}>
          添加设备
        </button>
      </div>
      
      {devices.length === 0 ? (
        <div className="empty-state">
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
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map(device => (
            <div key={device.id} className="device-card">
              <div className="device-header">
                <div className="device-title">
                  <h3>{device.model || `${getDeviceTypeText(device.device_type)}设备`}</h3>
                  <span className="device-manufacturer">{device.manufacturer}</span>
                </div>
                <div className={`status-badge ${getStatusClass(device.is_active)}`}>
                  {device.is_active ? '活跃' : '非活跃'}
                </div>
              </div>
              
              <div className="device-info">
                <div className="info-item">
                  <span className="info-label">类型</span>
                  <span className="info-value">{getDeviceTypeText(device.device_type)}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">平台层级</span>
                  <span className="info-value">{getPlatformLevelText(device.platform_level)}</span>
                </div>
                
                {device.sensors && Object.keys(device.sensors).length > 0 && (
                  <div className="info-item">
                    <span className="info-label">传感器</span>
                    <span className="info-value">{Object.keys(device.sensors).join(', ')}</span>
                  </div>
                )}
                
                {device.actuators && Object.keys(device.actuators).length > 0 && (
                  <div className="info-item">
                    <span className="info-label">执行机构</span>
                    <span className="info-value">{Object.keys(device.actuators).join(', ')}</span>
                  </div>
                )}
                
                <div className="info-item">
                  <span className="info-label">创建时间</span>
                  <span className="info-value">{new Date(device.created_at).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="device-actions">
                <button className="secondary-btn" onClick={() => handleViewDetail(device)}>
                  详情
                </button>
                <button className="secondary-btn" onClick={() => handleEditDevice(device)}>
                  编辑
                </button>
                <button className="danger-btn" onClick={() => handleDeleteDevice(device.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 设备表单弹窗 */}
      {showForm && (
        <DeviceForm
          mode={formMode}
          device={selectedDevice}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 设备详情弹窗 */}
      {showDetail && selectedDevice && (
        <DeviceDetail
          device={selectedDevice}
          onClose={handleDetailClose}
          onEdit={() => {
            setShowDetail(false)
            handleEditDevice(selectedDevice)
          }}
        />
      )}
    </div>
  )
}

export default Devices