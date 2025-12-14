import { useState, useEffect } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const Overview = () => {
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    todaySessions: 0,
    pendingTasks: 0
  })

  useEffect(() => {
    // 模拟获取统计数据
    setStats({
      totalDevices: 45,
      activeDevices: 42,
      todaySessions: 7,
      pendingTasks: 3
    })
  }, [])

  return (
    <div className="dashboard-overview">
      <h1>概览</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.totalDevices}</div>
          <div className="stat-label">设备总数</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number">{stats.activeDevices}</div>
          <div className="stat-label">在线设备</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number">{stats.todaySessions}</div>
          <div className="stat-label">今日任务</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number">{stats.pendingTasks}</div>
          <div className="stat-label">待处理</div>
        </div>
      </div>
      
      <div className="overview-sections">
        <div className="overview-section">
          <h2>最近活动</h2>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-time">10:30</div>
              <div className="activity-content">传感器数据采集完成</div>
            </div>
            <div className="activity-item">
              <div className="activity-time">09:45</div>
              <div className="activity-content">设备A-001离线</div>
            </div>
            <div className="activity-item">
              <div className="activity-time">09:12</div>
              <div className="activity-content">任务#007开始执行</div>
            </div>
          </div>
        </div>
        
        <div className="overview-section">
          <h2>系统状态</h2>
          <div className="system-status">
            <div className="status-item">
              <div className="status-indicator status-good"></div>
              <div className="status-text">数据库连接正常</div>
            </div>
            <div className="status-item">
              <div className="status-indicator status-good"></div>
              <div className="status-text">消息队列正常</div>
            </div>
            <div className="status-item">
              <div className="status-indicator status-warning"></div>
              <div className="status-text">磁盘空间使用85%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Overview