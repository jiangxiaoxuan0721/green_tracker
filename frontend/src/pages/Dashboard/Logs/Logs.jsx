import { useState, useEffect } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const Logs = () => {
  const [logs, setLogs] = useState([
    {
      id: 1,
      timestamp: '2023-06-15 10:30:15',
      level: 'info',
      source: '传感器数据采集',
      message: '温度传感器-001 数据采集完成'
    },
    {
      id: 2,
      timestamp: '2023-06-15 10:25:28',
      level: 'warning',
      source: '设备管理',
      message: '湿度传感器-002 连接不稳定'
    },
    {
      id: 3,
      timestamp: '2023-06-15 09:48:12',
      level: 'error',
      source: '系统',
      message: '数据库查询超时'
    },
    {
      id: 4,
      timestamp: '2023-06-15 09:15:12',
      level: 'info',
      source: '任务管理',
      message: '任务SESS-002 执行完成'
    },
    {
      id: 5,
      timestamp: '2023-06-15 08:30:05',
      level: 'info',
      source: '系统',
      message: '系统启动完成'
    }
  ])
  
  const [filter, setFilter] = useState({
    level: 'all',
    source: 'all',
    dateFrom: '',
    dateTo: ''
  })
  
  const handleFilterChange = (field, value) => {
    setFilter(prev => ({
      ...prev,
      [field]: value
    }))
  }
  
  const getLevelClass = (level) => {
    switch(level) {
      case 'error': return 'log-error'
      case 'warning': return 'log-warning'
      case 'info': return 'log-info'
      case 'success': return 'log-success'
      default: return ''
    }
  }
  
  const getLevelText = (level) => {
    switch(level) {
      case 'error': return '错误'
      case 'warning': return '警告'
      case 'info': return '信息'
      case 'success': return '成功'
      default: return level
    }
  }
  
  const filteredLogs = logs.filter(log => {
    let matchesFilter = true
    
    if (filter.level !== 'all' && log.level !== filter.level) {
      matchesFilter = false
    }
    
    if (filter.source !== 'all' && !log.source.includes(filter.source)) {
      matchesFilter = false
    }
    
    if (filter.dateFrom && log.timestamp < filter.dateFrom) {
      matchesFilter = false
    }
    
    if (filter.dateTo && log.timestamp > filter.dateTo + ' 23:59:59') {
      matchesFilter = false
    }
    
    return matchesFilter
  })
  
  return (
    <div className="dashboard-logs">
      <div className="dashboard-header">
        <h1>日志查看</h1>
        <button className="primary-btn">导出日志</button>
      </div>
      
      <div className="log-filters">
        <div className="filter-group">
          <label>日志级别</label>
          <select 
            value={filter.level} 
            onChange={(e) => handleFilterChange('level', e.target.value)}
          >
            <option value="all">全部级别</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
            <option value="success">成功</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>来源</label>
          <input 
            type="text" 
            value={filter.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            placeholder="输入来源关键词"
          />
        </div>
        
        <div className="filter-group">
          <label>开始日期</label>
          <input 
            type="date" 
            value={filter.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <label>结束日期</label>
          <input 
            type="date" 
            value={filter.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
      </div>
      
      <div className="log-container">
        <div className="log-table">
          <div className="log-header">
            <div className="log-cell">时间</div>
            <div className="log-cell">级别</div>
            <div className="log-cell">来源</div>
            <div className="log-cell">消息</div>
          </div>
          
          {filteredLogs.map(log => (
            <div key={log.id} className="log-row">
              <div className="log-cell">{log.timestamp}</div>
              <div className={`log-cell ${getLevelClass(log.level)}`}>
                {getLevelText(log.level)}
              </div>
              <div className="log-cell">{log.source}</div>
              <div className="log-cell">{log.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Logs