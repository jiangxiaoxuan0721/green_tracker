import { useEffect } from 'react'

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  closeOnOverlay = true,
  showCloseButton = true,
  footer = null,
  className = ''
}) => {
  // 处理ESC键关闭
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      // 禁止背景滚动
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
      // 恢复背景滚动
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // 如果模态框未打开，不渲染任何内容
  if (!isOpen) return null

  // 处理覆盖层点击
  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose()
    }
  }

  // 根据size设置样式类
  const sizeClass = size === 'small' ? 'modal-small' : 
                    size === 'large' ? 'modal-large' : 
                    'modal-medium'

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-container ${sizeClass} ${className}`}>
        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
            {showCloseButton && (
              <button 
                className="close-btn" 
                onClick={onClose}
                aria-label="关闭"
              >
                ×
              </button>
            )}
          </div>
        )}
        
        <div className="modal-body">
          {children}
        </div>
        
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal