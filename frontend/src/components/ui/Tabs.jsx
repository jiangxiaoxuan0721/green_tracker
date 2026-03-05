import './Tabs.css'

const Tabs = ({ tabs, activeTab, onChange, className = '' }) => {
  const handleTabClick = (tabId) => {
    if (onChange) {
      onChange(tabId)
    }
  }

  return (
    <div className={`tabs-container ${className}`}>
      <div className="tabs-header">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-panel ${activeTab === tab.id ? 'tab-panel-active' : ''}`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Tabs