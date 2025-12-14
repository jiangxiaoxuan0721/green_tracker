import { useState } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const Sessions = () => {
  const [sessions] = useState([
    {
      id: 'SESS-001',
      name: '东区A地块土壤监测',
      status: 'running',
      startTime: '2023-06-15 08:30:00',
      endTime: null,
      deviceCount: 12,
      dataPoints: 1426
    },
    {
      id: 'SESS-002',
      name: '西区A地块灌溉任务',
      status: 'completed',
      startTime: '2023-06-15 06:00:00',
      endTime: '2023-06-15 07:45:00',
      deviceCount: 8,
      dataPoints: 893
    },
    {
      id: 'SESS-003',
      name: '东区B地块病虫害监测',
      status: 'scheduled',
      startTime: '2023-06-15 14:00:00',
      endTime: null,
      deviceCount: 15,
      dataPoints: 0
    }
  ])

  const getStatusClass = (status) => {
    switch(status) {
      case 'running': return 'status-running'
      case 'completed': return 'status-completed'
      case 'scheduled': return 'status-scheduled'
      case 'failed': return 'status-failed'
      default: return ''
    }
  }

  const getStatusText = (status) => {
    switch(status) {
      case 'running': return '运行中'
      case 'completed': return '已完成'
      case 'scheduled': return '计划中'
      case 'failed': return '失败'
      default: return status
    }
  }

  return (
    <div className="dashboard-sessions">
      <div className="dashboard-header">
        <h1>任务管理</h1>
        <button className="primary-btn">创建任务</button>
      </div>
      
      <div className="sessions-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>任务名称</th>
              <th>状态</th>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>设备数量</th>
              <th>数据点</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.id}>
                <td>{session.name}</td>
                <td>
                  <div className={`status-badge ${getStatusClass(session.status)}`}>
                    {getStatusText(session.status)}
                  </div>
                </td>
                <td>{session.startTime}</td>
                <td>{session.endTime || '-'}</td>
                <td>{session.deviceCount}</td>
                <td>{session.dataPoints.toLocaleString()}</td>
                <td>
                  <div className="action-buttons">
                    <button className="secondary-btn">查看</button>
                    {session.status === 'running' && (
                      <button className="secondary-btn warning-btn">停止</button>
                    )}
                    {session.status === 'scheduled' && (
                      <button className="secondary-btn">开始</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Sessions