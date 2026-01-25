import './Button.css'

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
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

  return (
    <button
      type={type}
      className={`${getButtonClass()} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="btn-spinner"></span>}
      {children}
    </button>
  )
}

export default Button
