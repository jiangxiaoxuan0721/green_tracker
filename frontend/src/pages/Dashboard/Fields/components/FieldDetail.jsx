import { useState } from 'react'
import { Modal } from '../../components'

const FieldDetail = ({ field, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState('info')

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const renderInfoTab = () => (
    <div className="field-detail-info">
      <div className="detail-row">
        <span className="detail-label">地块ID:</span>
        <span className="detail-value">{field.id}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">地块名称:</span>
        <span className="detail-value">{field.name}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">描述:</span>
        <span className="detail-value">{field.description || '无'}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">面积:</span>
        <span className="detail-value">{field.area_m2 ? `${field.area_m2.toFixed(2)} 平方米` : '未知'}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">作物类型:</span>
        <span className="detail-value">{field.crop_type || '未设置'}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">土壤类型:</span>
        <span className="detail-value">{field.soil_type || '未设置'}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">灌溉方式:</span>
        <span className="detail-value">{field.irrigation_type || '未设置'}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">状态:</span>
        <span className={`status-badge ${field.is_active ? 'active' : 'inactive'}`}>
          {field.is_active ? '活跃' : '非活跃'}
        </span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">所有者ID:</span>
        <span className="detail-value">{field.owner_id}</span>
      </div>
      
      {field.organization_id && (
        <div className="detail-row">
          <span className="detail-label">组织ID:</span>
          <span className="detail-value">{field.organization_id}</span>
        </div>
      )}
      
      <div className="detail-row">
        <span className="detail-label">创建时间:</span>
        <span className="detail-value">{formatDate(field.created_at)}</span>
      </div>
      
      {field.updated_at && (
        <div className="detail-row">
          <span className="detail-label">更新时间:</span>
          <span className="detail-value">{formatDate(field.updated_at)}</span>
        </div>
      )}
    </div>
  )

  const renderLocationTab = () => (
    <div className="field-detail-location">
      <div className="detail-row">
        <span className="detail-label">位置数据(WKT格式):</span>
      </div>
      
      <div className="wkt-container">
        <pre className="wkt-text">{field.location_wkt}</pre>
      </div>
      
      <div className="map-placeholder">
        <p>地图组件将在此显示</p>
        <small>将来可以集成地图库（如 Leaflet 或 Mapbox）来可视化地块位置</small>
      </div>
    </div>
  )

  const renderActionsTab = () => (
    <div className="field-detail-actions">
      <div className="action-description">
        <p>在这里可以对地块执行各种操作</p>
      </div>
      
      <div className="action-buttons">
        <button className="secondary-btn">
          导出数据
        </button>
        
        <button className="secondary-btn">
          查看历史记录
        </button>
        
        <button className="secondary-btn">
          查看关联设备
        </button>
        
        <button className="secondary-btn">
          查看采集数据
        </button>
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="地块详情"
      size="large"
      footer={
        <button className="primary-btn" onClick={onEdit}>
          编辑地块
        </button>
      }
    >
      <div className="tabs-container">
        <div className="tabs-header">
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            基本信息
          </button>
          <button 
            className={`tab-btn ${activeTab === 'location' ? 'active' : ''}`}
            onClick={() => setActiveTab('location')}
          >
            位置信息
          </button>
          <button 
            className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            操作
          </button>
        </div>
        
        <div className="tab-content">
          {activeTab === 'info' && renderInfoTab()}
          {activeTab === 'location' && renderLocationTab()}
          {activeTab === 'actions' && renderActionsTab()}
        </div>
      </div>
    </Modal>
  )
}

export default FieldDetail