import SettingItem from './SettingItem'
import ThemeSelector from './ThemeSelector'

const SettingsTab = () => {
  return (
    <div className="settings-container">
      <div className="dashboard-header">
        <h1>系统设置</h1>
      </div>
      
      <div className="settings-content">
        <div className="settings-section">
          <h2>基本设置</h2>
          
          <div className="settings-grid">
            <SettingItem label="系统名称">
              <input type="text" defaultValue="物联网监控平台" placeholder="输入系统名称" />
            </SettingItem>
            
            <SettingItem label="数据采集间隔(秒)">
              <input type="number" defaultValue="30" min="10" max="300" />
            </SettingItem>
            
            <SettingItem label="数据保留天数">
              <input type="number" defaultValue="90" min="7" max="365" />
            </SettingItem>
            
            <SettingItem label="自动备份">
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </SettingItem>
          </div>
        </div>
        
        <div className="settings-section">
          <h2>告警设置</h2>
          
          <div className="settings-grid">
            <SettingItem label="告警通知方式">
              <select defaultValue="email">
                <option value="email">邮件通知</option>
                <option value="sms">短信通知</option>
                <option value="both">邮件和短信</option>
                <option value="app">应用内通知</option>
              </select>
            </SettingItem>
            
            <SettingItem label="告警阈值">
              <input type="number" defaultValue="3" min="1" max="10" />
            </SettingItem>
            
            <SettingItem label="告警静默时间(分钟)">
              <input type="number" defaultValue="30" min="5" max="1440" />
            </SettingItem>
            
            <SettingItem label="紧急告警电话">
              <input type="tel" placeholder="输入手机号码" />
            </SettingItem>
          </div>
        </div>
        
        <div className="settings-section">
          <h2>界面设置</h2>
          
          <ThemeSelector />
          
          <div className="settings-grid">
            <SettingItem label="页面刷新间隔(秒)">
              <input type="number" defaultValue="60" min="10" max="600" />
            </SettingItem>
            
            <SettingItem label="启用音效">
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked={false} />
                <span className="toggle-slider"></span>
              </label>
            </SettingItem>
            
            <SettingItem label="显示详细提示">
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </SettingItem>
          </div>
        </div>
        
        <div className="settings-actions">
          <button className="save-btn">保存设置</button>
          <button className="reset-btn">恢复默认</button>
        </div>
      </div>
    </div>
  )
}

export default SettingsTab