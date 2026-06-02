import { useState } from 'react'
import './ProvisionModal.css'

const ProvisionModal = ({ provision, onClose, isOpen }) => {
  const [copiedField, setCopiedField] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const copyAllConfig = () => {
    const configText = `# ${provision.device_name} MQTT 连接配置
MQTT_BROKER_HOST=${provision.mqtt_broker_host}
MQTT_BROKER_PORT=${provision.mqtt_broker_port}
MQTT_USERNAME=${provision.mqtt_username}
MQTT_PASSWORD=${provision.mqtt_password}
MQTT_HEARTBEAT_TOPIC=${provision.heartbeat_topic}
MQTT_CMD_TOPIC=${provision.cmd_topic}
MQTT_STATUS_TOPIC=${provision.status_topic}`
    copyToClipboard(configText, 'all')
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content provision-modal">
        <div className="modal-header">
          <h2>设备绑定凭证</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="provision-warning">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <strong>请妥善保存以下凭证</strong>
              <p>MQTT 密钥仅在本次显示，关闭后将无法再次查看。如需新密钥，请重新生成凭证。</p>
            </div>
          </div>

          <div className="provision-section">
            <h4>Broker 连接信息</h4>
            <div className="provision-field">
              <span className="field-label">Broker 地址</span>
              <div className="field-value-row">
                <code className="field-value">{provision.mqtt_broker_host}</code>
                <button
                  className={`copy-btn ${copiedField === 'host' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(provision.mqtt_broker_host, 'host')}
                >
                  {copiedField === 'host' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <div className="provision-field">
              <span className="field-label">Broker 端口</span>
              <div className="field-value-row">
                <code className="field-value">{provision.mqtt_broker_port}</code>
                <button
                  className={`copy-btn ${copiedField === 'port' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(String(provision.mqtt_broker_port), 'port')}
                >
                  {copiedField === 'port' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </div>

          <div className="provision-section">
            <h4>设备认证信息</h4>
            <div className="provision-field">
              <span className="field-label">用户名 (Client ID)</span>
              <div className="field-value-row">
                <code className="field-value mono">{provision.mqtt_username}</code>
                <button
                  className={`copy-btn ${copiedField === 'username' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(provision.mqtt_username, 'username')}
                >
                  {copiedField === 'username' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <div className="provision-field">
              <span className="field-label">密钥 (Password)</span>
              <div className="field-value-row">
                <code className="field-value secret-value">
                  {showPassword ? provision.mqtt_password : '•'.repeat(32)}
                </code>
                <button
                  className="toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
                <button
                  className={`copy-btn ${copiedField === 'password' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(provision.mqtt_password, 'password')}
                >
                  {copiedField === 'password' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </div>

          <div className="provision-section">
            <h4>MQTT 主题</h4>
            <div className="provision-field">
              <span className="field-label">心跳主题</span>
              <div className="field-value-row">
                <code className="field-value mono">{provision.heartbeat_topic}</code>
                <button
                  className={`copy-btn ${copiedField === 'heartbeat' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(provision.heartbeat_topic, 'heartbeat')}
                >
                  {copiedField === 'heartbeat' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <div className="provision-field">
              <span className="field-label">指令主题</span>
              <div className="field-value-row">
                <code className="field-value mono">{provision.cmd_topic}</code>
                <button
                  className={`copy-btn ${copiedField === 'cmd' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(provision.cmd_topic, 'cmd')}
                >
                  {copiedField === 'cmd' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <div className="provision-field">
              <span className="field-label">状态主题</span>
              <div className="field-value-row">
                <code className="field-value mono">{provision.status_topic}</code>
                <button
                  className={`copy-btn ${copiedField === 'status' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(provision.status_topic, 'status')}
                >
                  {copiedField === 'status' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary-btn" onClick={copyAllConfig}>
            {copiedField === 'all' ? '已复制全部配置' : '复制全部配置'}
          </button>
          <button className="secondary-btn" onClick={onClose}>
            我已保存，关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProvisionModal
