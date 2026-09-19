import { useEffect } from 'react'
import { StatusBadge } from '@/components/business'
import './SessionDetail.css'

/** 平台层级：库里存单字（天/空/地/具身），展示用全称 */
const PLATFORM_LABELS = {
  '天': '天基',
  '空': '空基',
  '地': '地基',
  '具身': '具身智能'
}

const Field = ({ label, value, mono = false, tone }) => (
  <div className="sd-field">
    <span className="sd-field-label">{label}</span>
    <span className={`sd-field-value${mono ? ' is-mono' : ''}${tone ? ` is-${tone}` : ''}`}>
      {value || '未设置'}
    </span>
  </div>
)

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN')
}

const SessionDetail = ({ session, onClose, onEdit, onUpdateStatus }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const missionType = session.mission_type || '未分类'
  const platformText = session.platform_level
    ? PLATFORM_LABELS[session.platform_level] || session.platform_level
    : ''
  const weather = Object.entries(session.weather_snapshot || {})
  const createdAt = formatDateTime(session.created_at)
  const updatedAt = formatDateTime(session.updated_at)

  // 结束时间缺席有两种含义，混成「未设置」会让人误以为漏填
  const endText = session.end_time
    ? formatDateTime(session.end_time)
    : session.status === 'running'
      ? '进行中'
      : '未记录'

  /**
   * 状态流转走独立的 onUpdateStatus。
   * 原先这里调的是 onEdit(id, newStatus)，而 onEdit 只负责开编辑表单 —— 点「完成任务」
   * 状态纹丝不动，只弹了个编辑框。现在没传 onUpdateStatus 就不渲染这两个按钮，
   * 宁可没有，也不要出现点了没反应的按钮。
   */
  const handleStatusUpdate = async (newStatus) => {
    if (!onUpdateStatus) return
    await onUpdateStatus(session.id, newStatus)
    onClose()
  }

  return (
    <div className="sd-overlay">
      <div className="sd-modal" role="dialog" aria-modal="true" aria-label="任务详情">
        <header className="sd-header">
          <div className="sd-avatar">{missionType.slice(0, 1)}</div>
          <div className="sd-title-block">
            <h2 className="sd-title">{session.mission_name || '未命名任务'}</h2>
            <div className="sd-chips">
              <span className="sd-chip">{missionType}</span>
              {platformText && <span className="sd-chip">{platformText}</span>}
              {session.field_name && <span className="sd-chip">{session.field_name}</span>}
            </div>
          </div>
          <StatusBadge status={session.status} />
          <button className="sd-close" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="sd-body">
          <section className="sd-section">
            <h3 className="sd-section-title">任务信息</h3>
            <div className="sd-grid">
              <Field label="任务类型" value={missionType} />
              <Field label="平台层级" value={platformText} />
              <Field label="所属农田" value={session.field_name} />
              <Field label="执行设备" value={session.device_name || '所有设备'} />
            </div>
          </section>

          <section className="sd-section">
            <h3 className="sd-section-title">时间安排</h3>
            <div className="sd-grid">
              <Field label="开始时间" value={formatDateTime(session.start_time)} />
              <Field
                label="结束时间"
                value={endText}
                tone={session.end_time ? undefined : 'muted'}
              />
            </div>
          </section>

          {session.description && (
            <section className="sd-section">
              <h3 className="sd-section-title">描述</h3>
              <p className="sd-description">{session.description}</p>
            </section>
          )}

          {weather.length > 0 && (
            <section className="sd-section">
              <h3 className="sd-section-title">环境快照</h3>
              <div className="sd-tags">
                {weather.map(([key, value]) => (
                  <span key={key} className="sd-tag">
                    {`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="sd-footer">
          <div className="sd-meta">
            {createdAt && <span>创建 {createdAt}</span>}
            {updatedAt && <span>更新 {updatedAt}</span>}
          </div>
          <div className="sd-actions">
            <button className="sd-btn sd-btn-ghost" onClick={onClose}>关闭</button>
            {session.status === 'planned' && onUpdateStatus && (
              <button
                className="sd-btn sd-btn-success"
                onClick={() => handleStatusUpdate('running')}
              >
                开始任务
              </button>
            )}
            {session.status === 'running' && onUpdateStatus && (
              <button
                className="sd-btn sd-btn-warning"
                onClick={() => handleStatusUpdate('completed')}
              >
                完成任务
              </button>
            )}
            <button className="sd-btn sd-btn-primary" onClick={() => onEdit(session)}>
              编辑任务
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default SessionDetail
