import './StatsBar.css'

/**
 * 四合一横向统计栏（对标 Devices 页的 mqtt-stats-bar）
 *
 * 用一条紧凑横栏替代并列的多个 stat-card，放在页面顶部。
 *
 * @param {Array<{key?: string, label: string, value: React.ReactNode, icon?: React.ComponentType, tone?: string, suffix?: string}>} items
 * @param {React.ReactNode} extra - 末尾附加信息（如统计区间）
 * @param {boolean} loading - 数据刷新中，数值置灰
 */
const StatsBar = ({ items = [], extra = null, loading = false, className = '' }) => {
  return (
    <div className={`stats-bar ${loading ? 'is-loading' : ''} ${className}`.trim()}>
      {items.map((item, index) => {
        const Icon = item.icon
        const tone = item.tone ? `is-${item.tone}` : ''
        return (
          <div className="stats-bar-group" key={item.key || item.label}>
            {index > 0 && <span className="stats-bar-sep" />}
            <div className="stats-bar-item">
              {Icon && <Icon size={16} className={`stats-bar-icon ${tone}`} />}
              <span className="stats-bar-label">{item.label}</span>
              <span className={`stats-bar-value ${tone}`}>
                {loading ? '···' : (item.value ?? '-')}
              </span>
              {item.suffix && !loading && (
                <span className="stats-bar-suffix">{item.suffix}</span>
              )}
            </div>
          </div>
        )
      })}

      {extra && (
        <div className="stats-bar-group stats-bar-group-extra">
          <span className="stats-bar-sep" />
          <div className="stats-bar-extra">{extra}</div>
        </div>
      )}
    </div>
  )
}

export default StatsBar
