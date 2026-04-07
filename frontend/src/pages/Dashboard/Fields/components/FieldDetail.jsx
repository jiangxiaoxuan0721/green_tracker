import { useEffect } from 'react'
import { MapDisplay } from '@/components/map'
import './FieldDetail.css'

const FieldDetail = ({ field, onClose, onEdit }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h2>{field.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* 地图展示区域 */}
          {field.location_wkt && (
            <div className="detail-map-section">
              <label className="section-label">地块位置</label>
              <MapDisplay
                wkt={field.location_wkt}
                height={250}
                showControls={true}
              />
            </div>
          )}

          {/* 基本信息 */}
          <div className="detail-section">
            <label className="section-label">基本信息</label>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">描述</span>
                <span className="value">{field.description || '无'}</span>
              </div>
              <div className="detail-item">
                <span className="label">面积</span>
                <span className="value">{field.area_m2 ? `${field.area_m2.toFixed(2)} 平方米` : '未知'}</span>
              </div>
              <div className="detail-item">
                <span className="label">作物类型</span>
                <span className="value">{field.crop_type || '未设置'}</span>
              </div>
              <div className="detail-item">
                <span className="label">土壤类型</span>
                <span className="value">{field.soil_type || '未设置'}</span>
              </div>
              <div className="detail-item">
                <span className="label">灌溉方式</span>
                <span className="value">{field.irrigation_type || '未设置'}</span>
              </div>
            </div>
          </div>

          {/* WKT信息 */}
          {field.location_wkt && (
            <div className="detail-section">
              <label className="section-label">地理数据</label>
              <div className="wkt-display">
                <span className="wkt-type">
                  {field.location_wkt.toUpperCase().startsWith('POLYGON') ? '多边形区域' : '单点位置'}
                </span>
                <code className="wkt-text">{field.location_wkt}</code>
              </div>
            </div>
          )}

          {/* 元信息 */}
          <div className="detail-section">
            <label className="section-label">其他信息</label>
            <div className="detail-grid">
              {field.organization_id && (
                <div className="detail-item">
                  <span className="label">组织ID</span>
                  <span className="value">{field.organization_id}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="label">创建时间</span>
                <span className="value">{formatDate(field.created_at)}</span>
              </div>
              {field.updated_at && (
                <div className="detail-item">
                  <span className="label">更新时间</span>
                  <span className="value">{formatDate(field.updated_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="primary-btn" onClick={onEdit}>
            编辑地块
          </button>
          <button className="secondary-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default FieldDetail
