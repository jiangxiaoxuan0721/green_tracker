// 通用设置项组件
const SettingItem = ({ label, children, description }) => {
  return (
    <div className="setting-item">
      <div className="setting-label">
        <label>{label}</label>
        {description && <p className="setting-description">{description}</p>}
      </div>
      <div className="setting-control">
        {children}
      </div>
    </div>
  )
}

export default SettingItem