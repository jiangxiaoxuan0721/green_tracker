import './PageHeader.css'

/**
 * 统一页面头部组件 - 紧凑版
 * @param {Object} props
 * @param {React.ComponentType} props.icon - 图标组件 (lucide-react)
 * @param {string} props.title - 页面标题
 * @param {string} props.description - 页面描述
 * @param {React.ReactNode} props.actions - 操作按钮区域
 */
const PageHeader = ({ 
  icon: Icon, 
  title, 
  description, 
  actions 
}) => {
  return (
    <div className="page-header">
      <div className="page-header-content">
        <div className="page-header-main">
          {Icon && (
            <div className="page-header-icon">
              <Icon size={18} />
            </div>
          )}
          <div className="page-header-text">
            <h1 className="page-title">{title}</h1>
            {description && (
              <p className="page-description">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>
      <div className="page-header-line" />
    </div>
  )
}

export default PageHeader
