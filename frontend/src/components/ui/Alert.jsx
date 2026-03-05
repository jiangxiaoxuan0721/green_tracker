import './Alert.css'

const Alert = ({ type = 'info', message, onClose, className = '' }) => {
  const getAlertClass = () => {
    const classes = ['alert']
    classes.push(`alert-${type}`)
    return `${classes.join(' ')} ${className}`
  }

  return (
    <div className={getAlertClass()}>
      <span className="alert-message">{message}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}

export default Alert