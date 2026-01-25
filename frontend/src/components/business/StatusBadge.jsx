import './StatusBadge.css'

const StatusBadge = ({ status, className = '' }) => {
  const getStatusConfig = (status) => {
    const config = {
      // 设备状态
      online: { className: 'status-completed', text: '在线' },
      offline: { className: 'status-failed', text: '离线' },
      unknown: { className: 'status-scheduled', text: '未知' },

      // 任务状态
      pending: { className: 'status-scheduled', text: '待处理' },
      processing: { className: 'status-running', text: '进行中' },
      completed: { className: 'status-completed', text: '已完成' },
      failed: { className: 'status-failed', text: '失败' },
      cancelled: { className: 'status-scheduled', text: '已取消' },
      running: { className: 'status-running', text: '进行中' },

      // 数据状态
      raw: { className: 'status-scheduled', text: '原始数据' },
      processed: { className: 'status-completed', text: '已处理' },
      analyzing: { className: 'status-running', text: '分析中' },
      analyzed: { className: 'status-completed', text: '已分析' },

      // 通用状态
      active: { className: 'status-completed', text: '活跃' },
      inactive: { className: 'status-failed', text: '非活跃' },
      deleted: { className: 'status-failed', text: '已删除' },
      archived: { className: 'status-scheduled', text: '已归档' }
    }

    return config[status?.toLowerCase()] || { className: 'status-scheduled', text: status || '未知' }
  }

  const config = getStatusConfig(status)

  return (
    <span className={`status-badge ${config.className} ${className}`}>
      {config.text}
    </span>
  )
}

export default StatusBadge
