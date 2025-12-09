import SettingItem from './SettingItem'
import ThemeSelector from './ThemeSelector'

const SettingsTab = () => {
  return (
    <>
      <div className="tab-header">
        <h2>系统设置</h2>
        <div className="tab-buttons">
          <button className="tab-btn active">基本设置</button>
          <button className="tab-btn">安全设置</button>
          <button className="tab-btn">通知设置</button>
        </div>
      </div>
      
      <div className="settings-form">
        <ThemeSelector />
        
        <SettingItem label="系统名称">
          <input type="text" defaultValue="物联网监控平台" />
        </SettingItem>
        
        <SettingItem label="数据采集间隔(秒)">
          <input type="number" defaultValue="30" />
        </SettingItem>
        
        <SettingItem label="自动备份">
          <label className="toggle-switch">
            <input type="checkbox" defaultChecked />
            <span className="slider"></span>
          </label>
        </SettingItem>
        
        <SettingItem label="告警通知方式">
          <select defaultValue="email">
            <option value="email">邮件</option>
            <option value="sms">短信</option>
            <option value="both">邮件和短信</option>
          </select>
        </SettingItem>
        
        <button className="save-btn">保存设置</button>
      </div>
    </>
  )
}

export default SettingsTab