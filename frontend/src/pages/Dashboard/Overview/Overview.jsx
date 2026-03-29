import { useState, useEffect } from 'react'
import { rawDataService } from '@/services/rawDataService'
import { useAuth } from '@/hooks/auth/useAuth'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const Overview = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    todaySessions: 0,
    totalDataRecords: 0
  })
  const [recentActivities, setRecentActivities] = useState([])
  const [systemStatus, setSystemStatus] = useState({
    database: '未知',
    message_queue: '未知',
    disk_usage: '未知'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOverviewData()
  }, [user])

  const fetchOverviewData = async () => {
    try {
      setLoading(true)
      const userId = user?.id
      console.log('[概览页面] 当前用户信息:', user)
      console.log('[概览页面] 用户ID:', userId)
      console.log('[概览页面] 准备调用API')
      
      const response = await rawDataService.getOverviewStatistics(userId)

      console.log('[概览页面] API响应:', response)

      if (response && response.data) {
        const data = response.data
        console.log('[概览页面] 数据内容:', data)
        setStats({
          totalDevices: data.total_devices || 0,
          activeDevices: data.active_devices || 0,
          todaySessions: data.today_sessions || 0,
          totalDataRecords: data.total_data_records || 0
        })
        setRecentActivities(data.recent_activities || [])
        setSystemStatus(data.system_status || {
          database: '未知',
          message_queue: '未知',
          disk_usage: '未知'
        })
      } else {
        console.log('[概览页面] 响应或数据为空')
      }
    } catch (error) {
      console.error('[概览页面] 获取概览数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIndicatorClass = (status) => {
    if (status === '正常') return 'status-good'
    if (status === '警告') return 'status-warning'
    return 'status-error'
  }

  return (
    <div className="dashboard-overview">
      <h1>概览</h1>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>
      ) : (
        <>
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
              <div className="stat-number">{stats.totalDataRecords}</div>
              <div className="stat-label">总数据记录</div>
            </div>
          </div>

          <div className="overview-sections">
            <div className="overview-section">
              <h2>最近活动</h2>
              <div className="activity-list">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-time">{activity.time}</div>
                      <div className="activity-content">{activity.content}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', color: '#666' }}>暂无活动记录</div>
                )}
              </div>
            </div>

            <div className="overview-section">
              <h2>系统状态</h2>
              <div className="system-status">
                <div className="status-item">
                  <div className={`status-indicator ${getStatusIndicatorClass(systemStatus.database)}`}></div>
                  <div className="status-text">数据库 {systemStatus.database}</div>
                </div>
                <div className="status-item">
                  <div className={`status-indicator ${getStatusIndicatorClass(systemStatus.message_queue)}`}></div>
                  <div className="status-text">消息队列 {systemStatus.message_queue}</div>
                </div>
                <div className="status-item">
                  <div className={`status-indicator ${getStatusIndicatorClass(systemStatus.disk_usage)}`}></div>
                  <div className="status-text">磁盘空间 {systemStatus.disk_usage}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Overview