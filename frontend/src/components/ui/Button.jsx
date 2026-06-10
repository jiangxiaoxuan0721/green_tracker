import { isValidElement } from 'react'
import './Button.css'

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  icon,
  className = '',
  ...props
}) => {
  const getButtonClass = () => {
    const classes = ['btn']
    classes.push(`btn-${variant}`)
    classes.push(`btn-${size}`)
    if (disabled || loading) classes.push('btn-disabled')
    if (loading) classes.push('btn-loading')
    return classes.join(' ')
  }

  const renderIcon = () => {
    if (!icon) return null
    // 如果是 React 元素，直接渲染
    if (isValidElement(icon)) return icon
    // 如果是字符串（emoji 等），渲染为文本
    if (typeof icon === 'string') return <span className="btn-icon">{icon}</span>
    // 如果是组件引用（如 Send），当作组件渲染
    const IconComponent = icon
    return <IconComponent size={14} className="btn-icon" />
  }

  return (
    <button
      type={type}
      className={`${getButtonClass()} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="btn-spinner"></span>}
      {renderIcon()}
      {children}
    </button>
  )
}

export default Button
