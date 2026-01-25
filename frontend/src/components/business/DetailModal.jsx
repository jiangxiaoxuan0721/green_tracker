import { useState } from 'react'
import './DetailModal.css'

const DetailModal = ({ 
  isOpen, 
  onClose, 
  title, 
  tabs, 
  sections, 
  footer,
  size = 'medium',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(tabs && tabs.length > 0 ? tabs[0].id : null)

  // 处理覆盖层点击
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // 渲染内容
  const renderContent = () => {
    if (!sections || sections.length === 0) return null

    // 如果没有标签页，直接渲染所有区块
    if (!tabs || tabs.length === 0) {
      return (
        <div className="detail-content">
          {sections.map((section, index) => (
            <div key={index} className="detail-section">
              {section.title && <h3 className="section-title">{section.title}</h3>}
              {section.content}
            </div>
          ))}
        </div>
      )
    }

    // 有标签页的情况下，只显示当前标签页的内容
    const activeSections = sections.filter(section => section.tab === activeTab)
    
    return (
      <div className="detail-content">
        {activeSections.map((section, index) => (
          <div key={index} className="detail-section">
            {section.title && <h3 className="section-title">{section.title}</h3>}
            {section.content}
          </div>
        ))}
      </div>
    )
  }

  if (!isOpen) return null

  // 根据size设置样式类
  const sizeClass = size === 'small' ? 'detail-modal-small' : 
                    size === 'large' ? 'detail-modal-large' : 
                    'detail-modal-medium'

  return (
    <div className="detail-modal-overlay" onClick={handleOverlayClick}>
      <div className={`detail-modal-container ${sizeClass} ${className}`}>
        <div className="detail-modal-header">
          <h2>{title}</h2>
          <button className="detail-close-btn" onClick={onClose}>×</button>
        </div>
        
        {tabs && tabs.length > 0 && (
          <div className="detail-tabs">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`detail-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        
        {renderContent()}
        
        {footer && (
          <div className="detail-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default DetailModal

// 渲染详情行
export const renderDetailRow = (label, value, isFullWidth = false, customContent = null) => (
  <div className={`detail-row ${isFullWidth ? 'full-width' : ''}`}>
    <span className="detail-label">{label}:</span>
    <span className="detail-value">{customContent || value}</span>
  </div>
)

// 渲染状态徽章
export const renderStatusBadge = (status, type = 'valid') => (
  <span className={`detail-status-badge ${type}`}>{status}</span>
)

// 渲染列表项
export const renderListItem = (name, status, statusType) => (
  <div className="list-item">
    <span className="list-item-name">{name}</span>
    <span className={`list-item-status ${statusType}`}>{status}</span>
  </div>
)

// 渲染代码块
export const renderCodeBlock = (content) => (
  <pre className="detail-code-block">{content}</pre>
)

// 渲染标签
export const renderTag = (category, value, info) => (
  <div className="detail-tag">
    <div className="tag-category">{category}</div>
    <div className="tag-value">{value}</div>
    {info && <div className="tag-info">{info}</div>}
  </div>
)
