
import './FieldDetail.css'

const FieldDetail = ({ field, onClose, onEdit }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>地块详情</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-item">
            <span className="label">地块ID:</span>
            <span className="value">{field.id}</span>
          </div>
          <div className="detail-item">
            <span className="label">地块名称:</span>
            <span className="value">{field.name}</span>
          </div>
          <div className="detail-item">
            <span className="label">描述:</span>
            <span className="value">{field.description || '无'}</span>
          </div>
          <div className="detail-item">
            <span className="label">面积:</span>
            <span className="value">{field.area_m2 ? `${field.area_m2.toFixed(2)} 平方米` : '未知'}</span>
          </div>
          <div className="detail-item">
            <span className="label">作物类型:</span>
            <span className="value">{field.crop_type || '未设置'}</span>
          </div>
          <div className="detail-item">
            <span className="label">土壤类型:</span>
            <span className="value">{field.soil_type || '未设置'}</span>
          </div>
          <div className="detail-item">
            <span className="label">灌溉方式:</span>
            <span className="value">{field.irrigation_type || '未设置'}</span>
          </div>
          <div className="detail-item">
            <span className="label">状态:</span>
            <span className="value">
              <div className={`status-badge ${field.is_active ? 'status-completed' : 'status-failed'}`}>
                {field.is_active ? '活跃' : '非活跃'}
              </div>
            </span>
          </div>
          <div className="detail-item">
            <span className="label">所有者ID:</span>
            <span className="value">{field.owner_id}</span>
          </div>
          {field.organization_id && (
            <div className="detail-item">
              <span className="label">组织ID:</span>
              <span className="value">{field.organization_id}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="label">创建时间:</span>
            <span className="value">{formatDate(field.created_at)}</span>
          </div>
          {field.updated_at && (
            <div className="detail-item">
              <span className="label">更新时间:</span>
              <span className="value">{formatDate(field.updated_at)}</span>
            </div>
          )}
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