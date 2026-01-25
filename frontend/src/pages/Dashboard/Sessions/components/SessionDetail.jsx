import { useEffect } from 'react'
import { StatusBadge } from '@/components/business'
import './SessionDetail.css'

const SessionDetail = ({ session, onClose, onEdit }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '-'
    return new Date(dateTimeString).toLocaleString('zh-CN')
  }

  const getStatusText = (status) => {
    const statusMap = {
      'planned': '计划中',
      'running': '运行中',
      'completed': '已完成',
      'failed': '失败'
    }
    return statusMap[status] || status
  }

  const getPlatformLevelText = (platformLevel) => {
    const platformMap = {
      '天': '天基',
      '空': '空基',
      '地': '地基',
      '具身': '具身智能'
    }
    return platformMap[platformLevel] || platformLevel
  }

  const handleStatusUpdate = async (newStatus) => {
    if (onEdit) {
      await onEdit(session.id, newStatus)
    }
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>任务详情</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-item">
            <span className="label">任务ID:</span>
            <span className="value">{session.id}</span>
          </div>
          <div className="detail-item">
            <span className="label">任务名称:</span>
            <span className="value">{session.mission_name || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">状态:</span>
            <span className="value">
              <StatusBadge status={session.status} />
            </span>
          </div>
          <div className="detail-item">
            <span className="label">农田:</span>
            <span className="value">{session.field_name || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">任务类型:</span>
            <span className="value">
              <div className={`status-badge status-completed`}>
                {session.mission_type || '-'}
              </div>
            </span>
          </div>
          <div className="detail-item">
            <span className="label">开始时间:</span>
            <span className="value">{formatDateTime(session.start_time)}</span>
          </div>
          <div className="detail-item">
            <span className="label">结束时间:</span>
            <span className="value">{formatDateTime(session.end_time)}</span>
          </div>
          {session.platform_level && (
            <div className="detail-item">
              <span className="label">平台层级:</span>
              <span className="value">
                <div className={`status-badge status-running`}>
                  {getPlatformLevelText(session.platform_level)}
                </div>
              </span>
            </div>
          )}
          {session.device_name && (
            <div className="detail-item">
              <span className="label">设备:</span>
              <span className="value">{session.device_name}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="label">描述:</span>
            <span className="value">{session.description || '无'}</span>
          </div>
          <div className="detail-item">
            <span className="label">所有者ID:</span>
            <span className="value">{session.owner_id}</span>
          </div>
          {session.organization_id && (
            <div className="detail-item">
              <span className="label">组织ID:</span>
              <span className="value">{session.organization_id}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="label">创建时间:</span>
            <span className="value">{formatDateTime(session.created_at)}</span>
          </div>
          {session.updated_at && (
            <div className="detail-item">
              <span className="label">更新时间:</span>
              <span className="value">{formatDateTime(session.updated_at)}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {session.status === 'planned' && (
            <button className="success-btn" onClick={() => handleStatusUpdate('running')}>
              开始任务
            </button>
          )}
          {session.status === 'running' && (
            <button className="warning-btn" onClick={() => handleStatusUpdate('completed')}>
              完成任务
            </button>
          )}
          <button className="primary-btn" onClick={() => onEdit(session.id)}>
            编辑
          </button>
          <button className="secondary-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
