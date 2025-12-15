import React from 'react'
import './ItemCard.css'

const ItemCard = ({ 
  item, 
  itemType, 
  onViewDetail, 
  onEdit, 
  onDelete, 
  getStatusText, 
  getSubtitle,
  getPrimaryInfo,
  getSecondaryInfo,
  isActive
}) => {
  // 获取卡片主标题
  const getTitle = () => {
    if (itemType === 'device') {
      return item.model || `${item.device_type}设备`
    } else if (itemType === 'field') {
      return item.name
    }
    return item.name || item.id
  }

  // 获取卡片副标题
  const getSubtitleText = () => {
    if (getSubtitle) return getSubtitle(item)
    
    if (itemType === 'device') {
      return item.manufacturer
    } else if (itemType === 'field') {
      return item.area_m2 ? `${item.area_m2.toFixed(2)} 平方米` : '未知面积'
    }
    return ''
  }

  // 获取主要信息行
  const getPrimaryInfoRows = () => {
    if (getPrimaryInfo) return getPrimaryInfo(item)
    
    if (itemType === 'device') {
      return [
        { label: '类型', value: getDeviceTypeText(item.device_type) },
        { label: '平台层级', value: getPlatformLevelText(item.platform_level) },
        ...(item.sensors && Object.keys(item.sensors).length > 0 
          ? [{ label: '传感器', value: Object.keys(item.sensors).join(', ') }] 
          : [])
      ]
    } else if (itemType === 'field') {
      return [
        { label: '作物', value: item.crop_type || '未设置' },
        { label: '土壤类型', value: item.soil_type || '未设置' }
      ]
    }
    return []
  }

  // 获取次要信息行
  const getSecondaryInfoRows = () => {
    if (getSecondaryInfo) return getSecondaryInfo(item)
    
    return [
      { label: '创建时间', value: new Date(item.created_at).toLocaleString() }
    ]
  }

  // 获取设备类型显示文本
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

  // 获取平台层级显示文本
  const getPlatformLevelText = (platformLevel) => {
    const platformMap = {
      '天': '天基',
      '空': '空基',
      '地': '地基',
      '具身': '具身智能'
    }
    return platformMap[platformLevel] || platformLevel
  }

  // 获取状态类名
  const getStatusClass = () => {
    if (getStatusText) return ''
    
    if (itemType === 'device') {
      return isActive ? 'status-active' : 'status-inactive'
    } else if (itemType === 'field') {
      return isActive ? 'status-good' : 'status-inactive'
    }
    return 'status-inactive'
  }

  // 获取状态文本
  const getStatusTextValue = () => {
    if (getStatusText) return getStatusText(item)
    
    return isActive ? '活跃' : '非活跃'
  }

  // 截断文本
  const truncateText = (text, maxLength = 20) => {
    if (!text) return ''
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }

  return (
    <div className={`item-card item-card-${itemType}`}>
      <div className="item-header">
        <div className="item-title">
          <h3>{truncateText(getTitle(), 25)}</h3>
          {getSubtitleText() && (
            <span className="item-subtitle">{truncateText(getSubtitleText(), 30)}</span>
          )}
        </div>
        <div className={`status-badge ${getStatusClass()}`}>
          {getStatusTextValue()}
        </div>
      </div>
      
      <div className="item-info">
        {getPrimaryInfoRows().map((row, index) => (
          <div key={index} className="info-item">
            <span className="info-label">{row.label}:</span>
            <span className="info-value" title={row.value}>
              {truncateText(row.value, 25)}
            </span>
          </div>
        ))}
        
        {getSecondaryInfoRows().map((row, index) => (
          <div key={`secondary-${index}`} className="info-item info-secondary">
            <span className="info-label">{row.label}:</span>
            <span className="info-value" title={row.value}>
              {truncateText(row.value, 25)}
            </span>
          </div>
        ))}
      </div>
      
      <div className="item-actions">
        <button className="secondary-btn" onClick={() => onViewDetail(item)}>
          详情
        </button>
        <button className="secondary-btn" onClick={() => onEdit(item)}>
          编辑
        </button>
        <button className="danger-btn" onClick={() => onDelete(item.id)}>
          删除
        </button>
      </div>
    </div>
  )
}

export default ItemCard