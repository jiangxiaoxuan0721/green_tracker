
import DetailModal, { renderDetailRow, renderStatusBadge, renderListItem } from '../../../../components/common/DetailModal'

const DeviceDetail = ({ device, onClose, onEdit }) => {
  console.log('DeviceDetail组件接收到的设备数据:', device)

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

  // 获取传感器显示名称
  const getSensorDisplayName = (key) => {
    const sensorMap = {
      'RGB': 'RGB相机',
      'multispectral': '多光谱',
      'thermal': '热成像',
      'nir': '近红外',
      'lidar': '激光雷达',
      'soil_moisture': '土壤湿度',
      'soil_temp': '土壤温度',
      'air_temp': '空气温度',
      'humidity': '空气湿度'
    }
    return sensorMap[key] || key
  }

  // 获取执行机构显示名称
  const getActuatorDisplayName = (key) => {
    const actuatorMap = {
      'flight': '飞行控制',
      'wheels': '轮式移动',
      'tracks': '履带移动',
      'arm': '机械臂',
      'spray': '喷洒系统',
      'irrigation': '灌溉控制'
    }
    return actuatorMap[key] || key
  }

  // 准备标签页
  const tabs = [
    { id: 'basic', label: '基本信息' },
    { id: 'sensors', label: '传感器' },
    { id: 'actuators', label: '执行机构' }
  ]

  // 准备内容区块
  const sections = []

  // 设备概览区块
  const overviewSection = {
    title: '设备概览',
    content: (
      <div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ margin: '0 0 var(--spacing-sm) 0' }}>
            {device.model || `${getDeviceTypeText(device.device_type)}设备`}
          </h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
            {renderStatusBadge(getDeviceTypeText(device.device_type), 'active')}
            {renderStatusBadge(getPlatformLevelText(device.platform_level), 'active')}
            {renderStatusBadge(device.is_active ? '活跃' : '非活跃', device.is_active ? 'valid' : 'invalid')}
          </div>
          {device.description && <p>{device.description}</p>}
        </div>
      </div>
    )
  }

  // 基本信息区块
  const basicInfoSection = {
    tab: 'basic',
    title: '基本信息',
    content: (
      <div className="detail-grid">
        {renderDetailRow('设备ID', device.id)}
        {renderDetailRow('设备类型', getDeviceTypeText(device.device_type))}
        {renderDetailRow('平台层级', getPlatformLevelText(device.platform_level))}
        {renderDetailRow('型号', device.model || '未设置')}
        {renderDetailRow('制造商', device.manufacturer || '未设置')}
        {renderDetailRow('状态', '', false, renderStatusBadge(device.is_active ? '活跃' : '非活跃', device.is_active ? 'valid' : 'invalid'))}
        {renderDetailRow('创建时间', new Date(device.created_at).toLocaleString())}
        {renderDetailRow('更新时间', device.updated_at ? new Date(device.updated_at).toLocaleString() : '未更新')}
      </div>
    )
  }

  // 传感器配置区块
  const sensorsSection = {
    tab: 'sensors',
    title: '传感器配置',
    content: (
      <div className="detail-list">
        {!device.sensors || Object.keys(device.sensors).length === 0 ? (
          <div>无传感器配置</div>
        ) : (
          Object.entries(device.sensors).map(([sensor, enabled]) => (
            renderListItem(
              getSensorDisplayName(sensor),
              enabled ? '已启用' : '未启用',
              enabled ? 'enabled' : 'disabled'
            )
          ))
        )}
      </div>
    )
  }

  // 执行机构配置区块
  const actuatorsSection = {
    tab: 'actuators',
    title: '执行机构配置',
    content: (
      <div className="detail-list">
        {!device.actuators || Object.keys(device.actuators).length === 0 ? (
          <div>无执行机构配置</div>
        ) : (
          Object.entries(device.actuators).map(([actuator, enabled]) => (
            renderListItem(
              getActuatorDisplayName(actuator),
              enabled ? '已启用' : '未启用',
              enabled ? 'enabled' : 'disabled'
            )
          ))
        )}
      </div>
    )
  }

  // 添加所有区块
  sections.push(overviewSection)
  sections.push(basicInfoSection)
  sections.push(sensorsSection)
  sections.push(actuatorsSection)

  return (
    <DetailModal
      isOpen={true}
      onClose={onClose}
      title="设备详情"
      tabs={tabs}
      sections={sections}
      footer={
        <>
          <button className="primary-btn" onClick={onEdit}>
            编辑设备
          </button>
          <button className="secondary-btn" onClick={onClose}>
            关闭
          </button>
        </>
      }
    />
  )
}

export default DeviceDetail