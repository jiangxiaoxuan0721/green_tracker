import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { rawDataService } from '@/services/rawDataService'
import { useAuth } from '@/hooks/auth/useAuth'
import { 
  Radio, Activity, ListTodo, Database, 
  CheckCircle, AlertCircle, XCircle, Clock 
} from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { fadeInUp, listContainer, listItem, cardHover } from '@/utils/animations'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './Overview.css'

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

  const statItems = [
    { key: 'totalDevices', label: '设备总数', icon: Radio, color: 'var(--primary-color)' },
    { key: 'activeDevices', label: '在线设备', icon: Activity, color: 'var(--success-color)' },
    { key: 'todaySessions', label: '今日任务', icon: ListTodo, color: 'var(--info-color)' },
    { key: 'totalDataRecords', label: '总数据记录', icon: Database, color: 'var(--warning-color)' }
  ]

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

  const getStatusIcon = (status) => {
    if (status === '正常') return <CheckCircle size={18} className="status-good-icon" />
    if (status === '警告') return <AlertCircle size={18} className="status-warning-icon" />
    return <XCircle size={18} className="status-error-icon" />
  }

  const getStatusClass = (status) => {
    if (status === '正常') return 'status-good'
    if (status === '警告') return 'status-warning'
    return 'status-error'
  }

  return (
    <div className="dashboard-overview">
      <PageHeader
        icon={Activity}
        title="数据概览"
        description="实时了解系统运行状态和数据统计"
      />

      {loading ? (
        <motion.div 
          className="dashboard-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="dashboard-loading-dots">
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
          </div>
          <div className="dashboard-loading-text">正在加载数据...</div>
        </motion.div>
      ) : (
        <>
          <motion.div 
            className="stats-grid"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            {statItems.map((item, index) => {
              const Icon = item.icon
              const value = stats[item.key]
              return (
                <motion.div 
                  key={item.key}
                  className="stat-card enhanced"
                  variants={listItem}
                  whileHover={{ ...cardHover.hover, y: -5 }}
                  custom={index}
                  style={{ '--stat-color': item.color }}
                >
                  <div className="stat-icon-wrapper" style={{ background: `linear-gradient(135deg, ${item.color}20, ${item.color}10)` }}>
                    <Icon size={24} style={{ color: item.color }} />
                  </div>
                  <div className="stat-content">
                    <motion.div 
                      className="stat-number"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1, type: 'spring' }}
                    >
                      {value}
                    </motion.div>
                    <div className="stat-label">{item.label}</div>
                  </div>
                  <div className="stat-glow" style={{ background: item.color }}></div>
                </motion.div>
              )
            })}
          </motion.div>

          <motion.div 
            className="overview-sections"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.4 }}
          >
            <motion.div 
              className="overview-section"
              variants={fadeInUp}
              whileHover={{ scale: 1.01 }}
            >
              <h2><Clock size={20} /> 最近活动</h2>
              <div className="activity-list enhanced">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <motion.div 
                      key={index} 
                      className="activity-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 5, backgroundColor: 'var(--primary-subtle)' }}
                    >
                      <div className="activity-indicator"></div>
                      <div className="activity-time">{activity.time}</div>
                      <div className="activity-content">{activity.content}</div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state-inline">
                    <Clock size={32} />
                    <p>暂无活动记录</p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
              className="overview-section"
              variants={fadeInUp}
              whileHover={{ scale: 1.01 }}
            >
              <h2><Database size={20} /> 系统状态</h2>
              <div className="system-status enhanced">
                {[
                  { key: 'database', label: '数据库' },
                  { key: 'message_queue', label: '消息队列' },
                  { key: 'disk_usage', label: '磁盘空间' }
                ].map((item, index) => (
                  <motion.div 
                    key={item.key}
                    className={`status-item ${getStatusClass(systemStatus[item.key])}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="status-icon-wrapper">
                      {getStatusIcon(systemStatus[item.key])}
                    </div>
                    <span className="status-label">{item.label}</span>
                    <span className="status-value">{systemStatus[item.key]}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default Overview