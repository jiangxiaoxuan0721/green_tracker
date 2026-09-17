import { useEffect, useState } from 'react'
import { mqttService } from '@/services/mqttService'
import './DeviceDetail.css'

const PLATFORM_LABELS = {
  '天': '天基',
  '空': '空基',
  '地': '地基',
  '具身': '具身智能'
}

const TYPE_LABELS = {
  satellite: '卫星',
  uav: '无人机',
  ugv: '地面车',
  robot: '机器人',
  sensor: '传感器'
}

// 头像用类型首字，避免引入额外图标依赖
const TYPE_AVATAR = {
  satellite: '卫',
  uav: '翼',
  ugv: '车',
  robot: '器',
  sensor: '传'
}

const Field = ({ label, value, mono = false, tone }) => (
  <div className="dd-field">
    <span className="dd-field-label">{label}</span>
    <span
      className={`dd-field-value${mono ? ' is-mono' : ''}${tone ? ` is-${tone}` : ''}`}
    >
      {value || '未设置'}
    </span>
  </div>
)

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

const DeviceDetail = ({ device, onClose, onEdit }) => {
  // MQTT 连接信息：设备未接入或 Broker 不可达时只保留基础连接字段，不显示空占位
  const [mqttInfo, setMqttInfo] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    let alive = true
    setMqttInfo(null)
    setHistoryOpen(false)
    if (!device?.id) return
    mqttService
      .getDevice(device.id)
      .then((info) => { if (alive) setMqttInfo(info) })
      .catch(() => { if (alive) setMqttInfo(null) })
    return () => { alive = false }
  }, [device?.id])

  const typeText = TYPE_LABELS[device.device_type] || device.device_type || '未知'
  const platformText = PLATFORM_LABELS[device.platform_level] || device.platform_level || '未知'
  const isOnline = !!device.online
  const sensors = Object.keys(device.sensors || {})
  const actuators = Object.keys(device.actuators || {})
  const hasCapability = sensors.length > 0 || actuators.length > 0
  const connectHistory = mqttInfo?.connect_history || []
  const createdAt = formatDate(device.created_at)
  const updatedAt = formatDate(device.updated_at)

  return (
    <div className="dd-overlay">
      <div className="dd-modal" role="dialog" aria-modal="true" aria-label="设备详情">
        <header className="dd-header">
          <div className="dd-avatar">{TYPE_AVATAR[device.device_type] || '设'}</div>
          <div className="dd-title-block">
            <h2 className="dd-title">{device.name || '未命名设备'}</h2>
            <div className="dd-chips">
              <span className="dd-chip">{typeText}</span>
              <span className="dd-chip">{platformText}</span>
            </div>
          </div>
          <span className={`dd-status ${isOnline ? 'is-online' : 'is-offline'}`}>
            <i className="dd-dot" />
            {isOnline ? '在线' : '离线'}
          </span>
          <button className="dd-close" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="dd-body">
          <section className="dd-section">
            <h3 className="dd-section-title">基本信息</h3>
            <div className="dd-grid">
              <Field label="型号" value={device.model} />
              <Field label="制造商" value={device.manufacturer} />
              <Field label="设备类型" value={typeText} />
              <Field label="平台层级" value={platformText} />
            </div>
          </section>

          <section className="dd-section">
            <h3 className="dd-section-title">连接状态</h3>
            <div className="dd-grid">
              <Field label="最近在线" value={device.last_seen_at ? formatDate(device.last_seen_at) : '从未上线'} />
              <Field
                label="已注册"
                value={mqttInfo ? (mqttInfo.registered ? '是' : '否') : ''}
                tone={mqttInfo?.registered ? 'success' : 'muted'}
              />
              {mqttInfo && (
                <>
                  <Field label="IP 地址" value={mqttInfo.ip_address} />
                  <Field label="Client ID" value={mqttInfo.client_id} mono />
                  <Field label="最后心跳" value={mqttInfo.last_seen ? formatDate(mqttInfo.last_seen) : '从未上报'} />
                </>
              )}
            </div>
          </section>

          {hasCapability && (
            <section className="dd-section">
              <h3 className="dd-section-title">能力</h3>
              {sensors.length > 0 && (
                <div className="dd-cap-group">
                  <span className="dd-cap-label">传感器</span>
                  <div className="dd-tags">
                    {sensors.map((name) => (
                      <span key={name} className="dd-tag">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {actuators.length > 0 && (
                <div className="dd-cap-group">
                  <span className="dd-cap-label">执行机构</span>
                  <div className="dd-tags">
                    {actuators.map((name) => (
                      <span key={name} className="dd-tag dd-tag-accent">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {device.description && (
            <section className="dd-section">
              <h3 className="dd-section-title">描述</h3>
              <p className="dd-description">{device.description}</p>
            </section>
          )}

          {connectHistory.length > 0 && (
            <section className="dd-section">
              <button
                className="dd-history-toggle"
                onClick={() => setHistoryOpen(!historyOpen)}
                aria-expanded={historyOpen}
              >
                <span className={`dd-caret${historyOpen ? ' is-open' : ''}`}>▸</span>
                连接历史
                <span className="dd-count">{connectHistory.length}</span>
              </button>
              {historyOpen && (
                <ul className="dd-history-list">
                  {[...connectHistory].reverse().slice(0, 15).map((item, index) => (
                    <li key={index} className="dd-history-item">
                      <span className="dd-history-time">{formatDate(item.time)}</span>
                      <span
                        className={`dd-history-event ${item.event === 'connected' ? 'is-connect' : 'is-disconnect'}`}
                      >
                        {item.event === 'connected' ? '连接' : '断开'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <footer className="dd-footer">
          <div className="dd-meta">
            {createdAt && <span>创建 {createdAt}</span>}
            {updatedAt && <span>更新 {updatedAt}</span>}
          </div>
          <div className="dd-actions">
            <button className="dd-btn dd-btn-ghost" onClick={onClose}>关闭</button>
            <button className="dd-btn dd-btn-primary" onClick={onEdit}>编辑设备</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default DeviceDetail
