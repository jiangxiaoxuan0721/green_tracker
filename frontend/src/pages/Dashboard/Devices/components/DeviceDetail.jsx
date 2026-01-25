import { useEffect } from 'react'
import './DeviceDetail.css'

const DeviceDetail = ({ device, onClose, onEdit }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>设备详情</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-item">
            <span className="label">设备ID:</span>
            <span className="value">{device.id}</span>
          </div>
          <div className="detail-item">
            <span className="label">设备类型:</span>
            <span className="value">
              <div className={`status-badge status-completed`}>
                {getDeviceTypeText(device.device_type)}
              </div>
            </span>
          </div>
          <div className="detail-item">
            <span className="label">平台层级:</span>
            <span className="value">
              <div className={`status-badge status-running`}>
                {getPlatformLevelText(device.platform_level)}
              </div>
            </span>
          </div>
          <div className="detail-item">
            <span className="label">型号:</span>
            <span className="value">{device.model || '未设置'}</span>
          </div>
          <div className="detail-item">
            <span className="label">制造商:</span>
            <span className="value">{device.manufacturer || '未设置'}</span>
          </div>
          <div className="detail-item">
            <span className="label">状态:</span>
            <span className="value">
              <div className={`status-badge ${device.is_active ? 'status-completed' : 'status-failed'}`}>
                {device.is_active ? '活跃' : '非活跃'}
              </div>
            </span>
          </div>
          <div className="detail-item">
            <span className="label">描述:</span>
            <span className="value">{device.description || '无'}</span>
          </div>
          {device.sensors && Object.keys(device.sensors).length > 0 && (
            <div className="detail-item">
              <span className="label">传感器:</span>
              <span className="value">{Object.keys(device.sensors).join(', ')}</span>
            </div>
          )}
          {device.actuators && Object.keys(device.actuators).length > 0 && (
            <div className="detail-item">
              <span className="label">执行机构:</span>
              <span className="value">{Object.keys(device.actuators).join(', ')}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="label">创建时间:</span>
            <span className="value">{formatDate(device.created_at)}</span>
          </div>
          {device.updated_at && (
            <div className="detail-item">
              <span className="label">更新时间:</span>
              <span className="value">{formatDate(device.updated_at)}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="primary-btn" onClick={onEdit}>
            编辑设备
          </button>
          <button className="secondary-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeviceDetail