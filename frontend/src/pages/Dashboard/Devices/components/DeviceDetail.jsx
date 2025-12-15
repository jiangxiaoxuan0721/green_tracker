import { useState } from 'react'
import { Modal } from '../../components'

const DeviceDetail = ({ device, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState('basic')

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

  // 渲染传感器列表
  const renderSensors = () => {
    if (!device.sensors || Object.keys(device.sensors).length === 0) {
      return <p>无传感器配置</p>
    }

    return (
      <div className="sensor-list">
        {Object.entries(device.sensors).map(([sensor, enabled]) => (
          <div key={sensor} className="sensor-item">
            <span className="sensor-name">{sensor}</span>
            <span className={`sensor-status ${enabled ? 'enabled' : 'disabled'}`}>
              {enabled ? '已启用' : '未启用'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // 渲染执行机构列表
  const renderActuators = () => {
    if (!device.actuators || Object.keys(device.actuators).length === 0) {
      return <p>无执行机构配置</p>
    }

    return (
      <div className="actuator-list">
        {Object.entries(device.actuators).map(([actuator, enabled]) => (
          <div key={actuator} className="actuator-item">
            <span className="actuator-name">{actuator}</span>
            <span className={`actuator-status ${enabled ? 'enabled' : 'disabled'}`}>
              {enabled ? '已启用' : '未启用'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Modal
      title="设备详情"
      onClose={onClose}
      className="device-detail-modal"
    >
      <div className="device-detail-content">
        {/* 设备基本信息 */}
        <div className="device-overview">
          <h3 className="device-name">
            {device.model || `${getDeviceTypeText(device.device_type)}设备`}
          </h3>
          <div className="device-meta">
            <span className="device-type">{getDeviceTypeText(device.device_type)}</span>
            <span className="device-platform">{getPlatformLevelText(device.platform_level)}</span>
            <span className={`device-status ${device.is_active ? 'active' : 'inactive'}`}>
              {device.is_active ? '活跃' : '非活跃'}
            </span>
          </div>
          {device.description && (
            <p className="device-description">{device.description}</p>
          )}
        </div>

        {/* 标签页 */}
        <div className="tabs-container">
          <div className="tabs-header">
            <button 
              className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
              onClick={() => setActiveTab('basic')}
            >
              基本信息
            </button>
            <button 
              className={`tab-btn ${activeTab === 'sensors' ? 'active' : ''}`}
              onClick={() => setActiveTab('sensors')}
            >
              传感器
            </button>
            <button 
              className={`tab-btn ${activeTab === 'actuators' ? 'active' : ''}`}
              onClick={() => setActiveTab('actuators')}
            >
              执行机构
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'basic' && (
              <div className="basic-info-tab">
                <div className="detail-row">
                  <span className="detail-label">设备ID</span>
                  <span className="detail-value">{device.id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">设备类型</span>
                  <span className="detail-value">{getDeviceTypeText(device.device_type)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">平台层级</span>
                  <span className="detail-value">{getPlatformLevelText(device.platform_level)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">型号</span>
                  <span className="detail-value">{device.model || '未设置'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">制造商</span>
                  <span className="detail-value">{device.manufacturer || '未设置'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">状态</span>
                  <span className="detail-value">
                    <span className={`status-badge ${device.is_active ? 'active' : 'inactive'}`}>
                      {device.is_active ? '活跃' : '非活跃'}
                    </span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">创建时间</span>
                  <span className="detail-value">{new Date(device.created_at).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">更新时间</span>
                  <span className="detail-value">
                    {device.updated_at ? new Date(device.updated_at).toLocaleString() : '未更新'}
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'sensors' && (
              <div className="sensors-tab">
                <h4>传感器配置</h4>
                {renderSensors()}
              </div>
            )}

            {activeTab === 'actuators' && (
              <div className="actuators-tab">
                <h4>执行机构配置</h4>
                {renderActuators()}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="device-actions">
          <button className="primary-btn" onClick={onEdit}>
            编辑设备
          </button>
          <button className="secondary-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DeviceDetail