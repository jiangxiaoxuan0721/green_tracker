import { useEffect } from 'react'
import './Toast.css'

const Toast = ({
  message,
  type = 'error',
  duration = 3000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const icons = {
    error: '✕',
    success: '✓',
    warning: '⚠',
    info: 'ℹ'
  }

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
    </div>
  )
}

export default Toast
