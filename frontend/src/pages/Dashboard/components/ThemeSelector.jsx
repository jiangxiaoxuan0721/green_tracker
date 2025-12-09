import { useState, useEffect } from 'react'

const themes = [
  { id: 'default', name: '默认黑蓝', preview: 'linear-gradient(135deg, #0a0e27 0%, #1a2347 50%, #0f1b3c 100%)' },
  { id: 'light', name: '明亮模式', preview: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%)' },
  { id: 'dark', name: '深色模式', preview: 'linear-gradient(135deg, #121212 0%, #1e1e1e 50%, #2d2d2d 100%)' },
  { id: 'mint-green', name: '薄荷绿', preview: 'linear-gradient(135deg, #f0f8f0 0%, #e6f3e6 50%, #dcefdc 100%)' },
  { id: 'sunset', name: '日落橙', preview: 'linear-gradient(135deg, #fff8f0 0%, #ffefe0 50%, #ffe6d0 100%)' },
  { id: 'sky-blue', name: '天空蓝', preview: 'linear-gradient(135deg, #e8f4fd 0%, #d1e9fc 50%, #badef7 100%)' }
]

const ThemeSelector = () => {
  const [currentTheme, setCurrentTheme] = useState('default')

  useEffect(() => {
    // 从localStorage读取保存的主题
    const savedTheme = localStorage.getItem('theme') || 'default'
    setCurrentTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme === 'default' ? '' : savedTheme)
  }, [])

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId)
    localStorage.setItem('theme', themeId)
    
    // 应用主题到DOM
    if (themeId === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', themeId)
    }
  }

  return (
    <div className="theme-selector">
      <label className="setting-label">颜色主题</label>
      <div className="theme-grid">
        {themes.map(theme => (
          <div
            key={theme.id}
            className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
            onClick={() => handleThemeChange(theme.id)}
          >
            <div 
              className="theme-preview" 
              style={{ background: theme.preview }}
            />
            <span className="theme-name">{theme.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThemeSelector