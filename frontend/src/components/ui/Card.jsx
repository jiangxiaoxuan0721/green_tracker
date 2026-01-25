import './Card.css'

const Card = ({
  children,
  title,
  subtitle,
  footer,
  hoverable = false,
  className = '',
  onClick
}) => {
  return (
    <div
      className={`card ${hoverable ? 'card-hoverable' : ''} ${onClick ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="card-content">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  )
}

export default Card
