// 通用日志项组件
const LogItem = ({ log }) => {
  const levelMap = {
    'info': '信息',
    'warning': '警告',
    'error': '错误',
    'success': '成功'
  }
  
  return (
    <div className={`log-item ${log.level}`}>
      <div className="log-time">{log.time}</div>
      <div className="log-level">{levelMap[log.level] || log.level}</div>
      <div className="log-message">{log.message}</div>
    </div>
  )
}

export default LogItem