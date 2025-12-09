import LogItem from './LogItem'

const LogsTab = ({ logs }) => {
  return (
    <>
      <div className="tab-header">
        <h2>日志查看</h2>
        <div className="tab-buttons">
          <button className="tab-btn active">系统日志</button>
          <button className="tab-btn">错误日志</button>
          <button className="tab-btn">操作日志</button>
        </div>
      </div>
      
      <div className="log-container">
        {logs.map((log, index) => (
          <LogItem key={index} log={log} />
        ))}
      </div>
    </>
  )
}

export default LogsTab