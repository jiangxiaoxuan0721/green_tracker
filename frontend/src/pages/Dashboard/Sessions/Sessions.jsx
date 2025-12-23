import { useState, useEffect } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './Sessions.css'
import { collectionSessionService } from '../../../services/collectionSessionService'
import { fieldService } from '../../../services/fieldService'

const Sessions = () => {
  const [sessions, setSessions] = useState([])
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // 过滤状态
  const [statusFilter, setStatusFilter] = useState('')
  const [fieldFilter, setFieldFilter] = useState('')
  const [missionTypeFilter, setMissionTypeFilter] = useState('')
  

  
  // 获取采集任务列表
  const fetchSessions = async () => {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (fieldFilter) params.field_id = fieldFilter
      if (missionTypeFilter) params.mission_types = missionTypeFilter
      
      const data = await collectionSessionService.getSessions(params)
      setSessions(data)
      setError(null)
    } catch (err) {
      console.error('获取采集任务失败:', err)
      setError('获取采集任务失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }
  
  // 获取农田列表
  const fetchFields = async () => {
    try {
      const data = await fieldService.getFields()
      setFields(data)
    } catch (err) {
      console.error('获取农田列表失败:', err)
    }
  }
  
  // 初始化加载数据
  useEffect(() => {
    fetchSessions()
    fetchFields()
  }, [])
  
  // 过滤条件变化时重新获取数据
  useEffect(() => {
    fetchSessions()
  }, [statusFilter, fieldFilter, missionTypeFilter])
  
  // 获取任务详情
  const handleViewSession = async (sessionId) => {
    try {
      const session = await collectionSessionService.getSessionById(sessionId)
      setSelectedSession(session)
      setShowDetailModal(true)
    } catch (err) {
      console.error('获取任务详情失败:', err)
      setError('获取任务详情失败: ' + (err.response?.data?.detail || err.message))
    }
  }
  
  // 更新任务状态
  const handleUpdateSessionStatus = async (sessionId, newStatus) => {
    try {
      // 如果是完成任务，添加结束时间
      const updateData = { status: newStatus }
      if (newStatus === 'completed') {
        updateData.end_time = new Date().toISOString()
      }
      
      await collectionSessionService.updateSession(sessionId, updateData)
      fetchSessions()
      if (showDetailModal && selectedSession && selectedSession.id === sessionId) {
        setSelectedSession({
          ...selectedSession,
          status: newStatus,
          ...(newStatus === 'completed' ? { end_time: updateData.end_time } : {})
        })
      }
    } catch (err) {
      console.error('更新任务状态失败:', err)
      setError('更新任务状态失败: ' + (err.response?.data?.detail || err.message))
    }
  }
  
  // 删除任务
  const handleDeleteSession = async (sessionId) => {
    if (window.confirm('确定要删除这个任务吗？此操作不可恢复。')) {
      try {
        await collectionSessionService.deleteSession(sessionId)
        fetchSessions()
        setShowDetailModal(false)
      } catch (err) {
        console.error('删除任务失败:', err)
        setError('删除任务失败: ' + (err.response?.data?.detail || err.message))
      }
    }
  }
  
  // 创建任务
  const handleCreateSession = async (sessionData) => {
    try {
      await collectionSessionService.createSession(sessionData)
      fetchSessions()
      setShowCreateModal(false)
    } catch (err) {
      console.error('创建任务失败:', err)
      setError('创建任务失败: ' + (err.response?.data?.detail || err.message))
    }
  }
  
  const getStatusClass = (status) => {
    switch(status) {
      case 'running': return 'status-running'
      case 'completed': return 'status-completed'
      case 'planned': return 'status-scheduled'
      case 'failed': return 'status-failed'
      default: return ''
    }
  }

  const getStatusText = (status) => {
    switch(status) {
      case 'running': return '运行中'
      case 'completed': return '已完成'
      case 'planned': return '计划中'
      case 'failed': return '失败'
      default: return status
    }
  }
  
  const getMissionTypeText = (type) => {
    // 后端返回的是中文，直接返回
    return type || '-'
  }
  
  // 格式化日期时间
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '-'
    const date = new Date(dateTimeString)
    return date.toLocaleString('zh-CN')
  }

  return (
    <div className="dashboard-sessions">
      <div className="dashboard-header">
        <h1>任务管理</h1>
        <button className="primary-btn" onClick={() => setShowCreateModal(true)}>创建任务</button>
      </div>
      
      {/* 过滤器 */}
      <div className="filter-container">
        <div className="filter-group">
          <label>状态:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="planned">计划中</option>
            <option value="running">运行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>农田:</label>
          <select value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
            <option value="">全部农田</option>
            {fields.map(field => (
              <option key={field.id} value={field.id}>{field.name}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>任务类型:</label>
          <select value={missionTypeFilter} onChange={(e) => setMissionTypeFilter(e.target.value)}>
            <option value="">全部类型</option>
            <option value="巡检">巡检</option>
            <option value="定点">定点</option>
            <option value="路径">路径</option>
            <option value="应急">应急</option>
          </select>
        </div>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}
      
      {/* 加载状态 */}
      {loading ? (
        <div className="loading-container">加载中...</div>
      ) : (
        <div className="sessions-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>农田</th>
                <th>任务类型</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">暂无数据</td>
                </tr>
              ) : (
                sessions.map(session => (
                  <tr key={session.id}>
                    <td>{session.mission_name || '-'}</td>
                    <td>{session.field_name || '-'}</td>
                    <td>{getMissionTypeText(session.mission_type)}</td>
                    <td>
                      <div className={`status-badge ${getStatusClass(session.status)}`}>
                        {getStatusText(session.status)}
                      </div>
                    </td>
                    <td>{formatDateTime(session.start_time)}</td>
                    <td>{formatDateTime(session.end_time)}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="secondary-btn" onClick={() => handleViewSession(session.id)}>查看</button>
                        
                        {session.status === 'planned' && (
                          <button className="secondary-btn" onClick={() => handleUpdateSessionStatus(session.id, 'running')}>开始</button>
                        )}
                        
                        {session.status === 'running' && (
                          <button className="secondary-btn warning-btn" onClick={() => handleUpdateSessionStatus(session.id, 'completed')}>完成</button>
                        )}
                        
                        <button className="danger-btn" onClick={() => handleDeleteSession(session.id)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* 任务详情弹窗 */}
      {showDetailModal && selectedSession && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>任务详情</h2>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <span className="label">任务名称:</span>
                <span className="value">{selectedSession.mission_name || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="label">农田:</span>
                <span className="value">{selectedSession.field_name || selectedSession.field_id || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="label">任务类型:</span>
                <span className="value">{getMissionTypeText(selectedSession.mission_type)}</span>
              </div>
              <div className="detail-item">
                <span className="label">状态:</span>
                <div className={`status-badge ${getStatusClass(selectedSession.status)}`}>
                  {getStatusText(selectedSession.status)}
                </div>
              </div>
              <div className="detail-item">
                <span className="label">开始时间:</span>
                <span className="value">{formatDateTime(selectedSession.start_time)}</span>
              </div>
              <div className="detail-item">
                <span className="label">结束时间:</span>
                <span className="value">{formatDateTime(selectedSession.end_time)}</span>
              </div>
              <div className="detail-item">
                <span className="label">描述:</span>
                <span className="value">{selectedSession.description || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="label">天气快照:</span>
                <span className="value">
                  {selectedSession.weather_snapshot ? (
                    <div className="weather-info">
                      <div>温度: {selectedSession.weather_snapshot.temperature || '-'}℃</div>
                      <div>湿度: {selectedSession.weather_snapshot.humidity || '-'}%</div>
                      <div>风速: {selectedSession.weather_snapshot.wind_speed || '-'}km/h</div>
                      <div>天气: {selectedSession.weather_snapshot.weather || '-'}</div>
                    </div>
                  ) : '-'}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">创建者:</span>
                <span className="value">{selectedSession.creator_name || selectedSession.creator_id || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="label">创建时间:</span>
                <span className="value">{formatDateTime(selectedSession.created_at)}</span>
              </div>
              <div className="detail-item">
                <span className="label">更新时间:</span>
                <span className="value">{formatDateTime(selectedSession.updated_at)}</span>
              </div>
            </div>
            <div className="modal-footer">
              {selectedSession.status === 'planned' && (
                <button className="primary-btn" onClick={() => {
                  handleUpdateSessionStatus(selectedSession.id, 'running')
                  setShowDetailModal(false)
                }}>开始任务</button>
              )}
              
              {selectedSession.status === 'running' && (
                <button className="primary-btn" onClick={() => {
                  handleUpdateSessionStatus(selectedSession.id, 'completed')
                  setShowDetailModal(false)
                }}>完成任务</button>
              )}
              
              <button className="danger-btn" onClick={() => {
                handleDeleteSession(selectedSession.id)
                setShowDetailModal(false)
              }}>删除任务</button>
              
              <button className="secondary-btn" onClick={() => setShowDetailModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      
      {/* 创建任务弹窗 */}
      {showCreateModal && (
        <CreateSessionModal 
          fields={fields}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSession}
        />
      )}
    </div>
  )
}

// 创建任务弹窗组件
const CreateSessionModal = ({ fields, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    field_id: '',
    mission_name: '',
    mission_type: '巡检',
    description: '',
    start_time: '',
    status: 'planned',
    weather_snapshot: {
      temperature: 20,    // 温度(摄氏度)
      humidity: 60,       // 湿度(%)
      wind_speed: 5,      // 风速(km/h)
      weather: '晴'       // 天气状况
    }
  })
  
  const handleChange = (e) => {
    const { name, value } = e.target
    // 确保不设置id字段
    if (name === 'id') return
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }
  
  const handleWeatherChange = (field, value) => {
    // 确保不设置id字段
    if (field === 'id') return
    
    setFormData(prev => ({
      ...prev,
      weather_snapshot: {
        ...prev.weather_snapshot,
        [field]: field === 'temperature' || field === 'humidity' || field === 'wind_speed' 
          ? Number(value) 
          : value
      }
    }))
  }
  
  const handleSubmit = (e) => {
    e.preventDefault()
    
    // 验证必填字段
    if (!formData.field_id) {
      alert('请选择农田')
      return
    }
    
    // 确保时间格式正确：datetime-local 输出的是 YYYY-MM-DDTHH:MM
    // 后端期望 ISO 8601 格式，需要添加秒数和时区信息
    const transformedData = {
      field_id: formData.field_id,
      mission_name: formData.mission_name,
      mission_type: formData.mission_type,
      description: formData.description,
      start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
      status: formData.status,
      weather_snapshot: formData.weather_snapshot
      // 明确列出所有字段，确保不包含id
    }
    
    onSubmit(transformedData)
  }
  
  // 设置默认开始时间为当前时间
  useEffect(() => {
    const now = new Date()
    // 为 datetime-local 输入格式化为 YYYY-MM-DDTHH:MM
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`
    
    setFormData(prev => ({
      ...prev,
      start_time: formattedDateTime
    }))
  }, [])
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>创建新任务</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="field_id">农田:</label>
            <select 
              id="field_id" 
              name="field_id" 
              value={formData.field_id} 
              onChange={handleChange}
              required
            >
              <option value="">请选择农田</option>
              {fields.map(field => (
                <option key={field.id} value={field.id}>{field.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="mission_name">任务名称:</label>
            <input 
              type="text" 
              id="mission_name" 
              name="mission_name" 
              value={formData.mission_name} 
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="mission_type">任务类型:</label>
            <select 
              id="mission_type" 
              name="mission_type" 
              value={formData.mission_type} 
              onChange={handleChange}
              required
            >
              <option value="巡检">巡检</option>
              <option value="定点">定点</option>
              <option value="路径">路径</option>
              <option value="应急">应急</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="start_time">开始时间:</label>
            <input 
              type="datetime-local" 
              id="start_time" 
              name="start_time" 
              value={formData.start_time} 
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">描述:</label>
            <textarea 
              id="description" 
              name="description" 
              value={formData.description} 
              onChange={handleChange}
              rows="3"
            ></textarea>
          </div>
          
          <div className="form-group">
            <label>天气快照（可选）</label>
            <div className="weather-snapshot-grid">
              <div className="form-group">
                <label htmlFor="temperature">温度(℃):</label>
                <input 
                  type="number" 
                  id="temperature" 
                  value={formData.weather_snapshot.temperature} 
                  onChange={(e) => handleWeatherChange('temperature', e.target.value)}
                  min="-50" 
                  max="50"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="humidity">湿度(%):</label>
                <input 
                  type="number" 
                  id="humidity" 
                  value={formData.weather_snapshot.humidity} 
                  onChange={(e) => handleWeatherChange('humidity', e.target.value)}
                  min="0" 
                  max="100"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="wind_speed">风速(km/h):</label>
                <input 
                  type="number" 
                  id="wind_speed" 
                  value={formData.weather_snapshot.wind_speed} 
                  onChange={(e) => handleWeatherChange('wind_speed', e.target.value)}
                  min="0" 
                  max="200"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="weather">天气状况:</label>
                <select 
                  id="weather" 
                  value={formData.weather_snapshot.weather} 
                  onChange={(e) => handleWeatherChange('weather', e.target.value)}
                >
                  <option value="晴">晴</option>
                  <option value="多云">多云</option>
                  <option value="阴">阴</option>
                  <option value="小雨">小雨</option>
                  <option value="中雨">中雨</option>
                  <option value="大雨">大雨</option>
                  <option value="暴雨">暴雨</option>
                  <option value="小雪">小雪</option>
                  <option value="中雪">中雪</option>
                  <option value="大雪">大雪</option>
                  <option value="暴雪">暴雪</option>
                  <option value="雨夹雪">雨夹雪</option>
                  <option value="冰雹">冰雹</option>
                  <option value="雾">雾</option>
                  <option value="霾">霾</option>
                  <option value="沙尘暴">沙尘暴</option>
                </select>
              </div>
            </div>
          </div>
        </form>
        <div className="modal-footer">
          <button type="button" className="primary-btn" onClick={handleSubmit}>创建</button>
          <button type="button" className="secondary-btn" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}

export default Sessions