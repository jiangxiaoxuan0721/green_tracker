import { useState, useEffect, useCallback } from 'react'
import { Settings, Check, RotateCcw } from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import SettingItem from './SettingItem'
import ThemeSelector from './ThemeSelector'

const SETTINGS_KEY = 'green_tracker_settings'

const defaultSettings = {
  systemName: '物联网监控平台',
  collectionInterval: 30,
  dataRetentionDays: 90,
  autoBackup: true,
  alertMethod: 'email',
  alertThreshold: 3,
  alertSilenceMinutes: 30,
  emergencyPhone: '',
  refreshInterval: 60,
  enableSound: false,
  showTooltips: true,
}

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaultSettings, ...parsed }
    }
  } catch (e) {
    console.warn('Failed to load settings, using defaults', e)
  }
  return { ...defaultSettings }
}

const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch (e) {
    console.error('Failed to save settings', e)
    return false
  }
}

const SettingsTab = () => {
  const [settings, setSettings] = useState(defaultSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setSettings({ ...defaultSettings })
    saveSettings(defaultSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-container">
      <PageHeader
        icon={Settings}
        title="系统设置"
        description="配置系统参数、告警规则和界面偏好"
        actions={
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button variant="primary" icon={Check} onClick={handleSave}>
              {saved ? '已保存' : '保存设置'}
            </Button>
            <Button variant="outline" icon={RotateCcw} onClick={handleReset}>
              恢复默认
            </Button>
          </div>
        }
      />

      <div className="settings-content">
        <div className="settings-section">
          <h2>基本设置</h2>

          <div className="settings-grid">
            <SettingItem label="系统名称">
              <input
                type="text"
                value={settings.systemName}
                onChange={(e) => updateSetting('systemName', e.target.value)}
                placeholder="输入系统名称"
              />
            </SettingItem>

            <SettingItem label="数据采集间隔(秒)">
              <input
                type="number"
                value={settings.collectionInterval}
                onChange={(e) => updateSetting('collectionInterval', parseInt(e.target.value) || 30)}
                min="10" max="300"
              />
            </SettingItem>

            <SettingItem label="数据保留天数">
              <input
                type="number"
                value={settings.dataRetentionDays}
                onChange={(e) => updateSetting('dataRetentionDays', parseInt(e.target.value) || 90)}
                min="7" max="365"
              />
            </SettingItem>

            <SettingItem label="自动备份">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.autoBackup}
                  onChange={(e) => updateSetting('autoBackup', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </SettingItem>
          </div>
        </div>

        <div className="settings-section">
          <h2>告警设置</h2>

          <div className="settings-grid">
            <SettingItem label="告警通知方式">
              <select
                value={settings.alertMethod}
                onChange={(e) => updateSetting('alertMethod', e.target.value)}
              >
                <option value="email">邮件通知</option>
                <option value="sms">短信通知</option>
                <option value="both">邮件和短信</option>
                <option value="app">应用内通知</option>
              </select>
            </SettingItem>

            <SettingItem label="告警阈值">
              <input
                type="number"
                value={settings.alertThreshold}
                onChange={(e) => updateSetting('alertThreshold', parseInt(e.target.value) || 3)}
                min="1" max="10"
              />
            </SettingItem>

            <SettingItem label="告警静默时间(分钟)">
              <input
                type="number"
                value={settings.alertSilenceMinutes}
                onChange={(e) => updateSetting('alertSilenceMinutes', parseInt(e.target.value) || 30)}
                min="5" max="1440"
              />
            </SettingItem>

            <SettingItem label="紧急告警电话">
              <input
                type="tel"
                value={settings.emergencyPhone}
                onChange={(e) => updateSetting('emergencyPhone', e.target.value)}
                placeholder="输入手机号码"
              />
            </SettingItem>
          </div>
        </div>

        <div className="settings-section">
          <h2>界面设置</h2>

          <ThemeSelector />

          <div className="settings-grid">
            <SettingItem label="页面刷新间隔(秒)">
              <input
                type="number"
                value={settings.refreshInterval}
                onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value) || 60)}
                min="10" max="600"
              />
            </SettingItem>

            <SettingItem label="启用音效">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableSound}
                  onChange={(e) => updateSetting('enableSound', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </SettingItem>

            <SettingItem label="显示详细提示">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.showTooltips}
                  onChange={(e) => updateSetting('showTooltips', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </SettingItem>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsTab