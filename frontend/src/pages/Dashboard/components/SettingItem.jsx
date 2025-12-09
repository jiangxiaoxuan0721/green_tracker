// 通用设置项组件
const SettingItem = ({ label, children }) => {
  return (
    <div className="setting-item">
      <label>{label}</label>
      {children}
    </div>
  )
}

export default SettingItem