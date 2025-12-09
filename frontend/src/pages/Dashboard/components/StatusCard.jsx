// 通用状态卡片组件
const StatusCard = ({ title, value, status, statusType = 'normal' }) => {
  return (
    <div className="overview-card">
      <h3>{title}</h3>
      <p className="card-value">{value}</p>
      <span className={`card-status ${statusType}`}>{status}</span>
    </div>
  )
}

export default StatusCard