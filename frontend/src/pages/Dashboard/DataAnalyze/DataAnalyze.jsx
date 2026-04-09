import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/auth/useAuth'
import { rawDataService } from '@/services/rawDataService'
import { deviceService } from '@/services/deviceService'
import { collectionSessionService } from '@/services/collectionSessionService'
import { Select } from '@/components/ui'
import { getMinioUrl } from '@/config/environment'
import '../Dashboard.css'
import './DataAnalyze.css'

const DataAnalyze = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [sessions, setSessions] = useState([])
  const [rawData, setRawData] = useState([])

  const [timeRange, setTimeRange] = useState('month')
  const [selectedDevices, setSelectedDevices] = useState([])
  const [selectedSessions, setSelectedSessions] = useState([])
  const [dataType, setDataType] = useState('all')

  // 获取用户的设备列表
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devicesData = await deviceService.getDevices()
        setDevices(devicesData.data || [])
        if (devicesData.data && devicesData.data.length > 0) {
          setSelectedDevices(devicesData.data.map(device => device.id))
        }
      } catch (err) {
        console.error('获取设备列表失败:', err)
      }
    }
    if (user?.id) {
      fetchDevices()
    }
  }, [user?.id])

  // 获取用户的采集会话列表
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionsData = await collectionSessionService.getSessions({ limit: 100 })
        setSessions(sessionsData || [])
        if (sessionsData && sessionsData.length > 0) {
          setSelectedSessions(sessionsData.map(session => session.id))
        }
      } catch (err) {
        console.error('获取采集会话列表失败:', err)
      }
    }
    if (user?.id) {
      fetchSessions()
    }
  }, [user?.id])

  // 获取数据统计信息
  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user?.id || selectedSessions.length === 0) return

      setLoading(true)
      setError(null)

      try {
        // 计算时间范围
        const endDate = new Date()
        const startDate = new Date()

        switch (timeRange) {
          case 'week':
            startDate.setDate(endDate.getDate() - 7)
            break
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1)
            break
          case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3)
            break
          case 'year':
            startDate.setFullYear(endDate.getFullYear() - 1)
            break
        }

        // 构建请求参数
        const params = {
          user_id: user.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString()
        }

        // 过滤选中的会话ID
        const filteredSessions = selectedSessions.length > 0 && selectedSessions.length !== sessions.length
          ? selectedSessions
          : sessions.map(s => s.id)

        if (filteredSessions.length > 0) {
          params.session_ids = filteredSessions.join(',')
        }

        // 过滤数据类型
        if (dataType !== 'all') {
          params.data_subtype = dataType
        }

        const response = await rawDataService.getRawDataStatistics(params)

        if (response.code === 200) {
          setStatistics(response.data)
        } else {
          setError(response.message || '获取分析数据失败')
        }
      } catch (err) {
        setError('获取分析数据失败，请稍后再试')
        console.error('获取分析数据失败:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [user?.id, timeRange, selectedSessions, dataType, devices, sessions])

  // 获取最近数据（仅用于显示最近10条）
  useEffect(() => {
    const fetchRecentData = async () => {
      if (!user?.id || sessions.length === 0) return

      try {
        const params = {
          user_id: user.id,
          page: 1,
          page_size: 10
        }

        // 如果选中了会话，使用选中的会话ID；否则使用所有会话ID
        const filteredSessions = selectedSessions.length > 0
          ? selectedSessions
          : sessions.map(s => s.id)

        if (filteredSessions.length > 0) {
          params.session_id = filteredSessions.join(',')
        }

        if (dataType !== 'all') {
          params.data_subtype = dataType
        }

        const response = await rawDataService.getRawDataList(params)

        if (response.code === 200) {
          setRawData(response.data.items || [])
        }
      } catch (err) {
        console.error('获取最近数据失败:', err)
      }
    }

    fetchRecentData()
  }, [user?.id, selectedSessions, dataType, sessions])

  const [statistics, setStatistics] = useState({
    total_records: 0,
    data_types: {},
    average_values: {},
    min_values: {},
    max_values: {},
    session_count: 0
  })

  // 数据类型配置
  const dataTypeConfig = {
    temperature: { label: '温度', unit: '°C', color: '#e74c3c' },
    temperature_soil: { label: '土壤温度', unit: '°C', color: '#c0392b' },
    humidity: { label: '湿度', unit: '%', color: '#3498db' },
    moisture: { label: '土壤湿度', unit: '%', color: '#9b59b6' },
    ph: { label: '土壤pH', unit: '', color: '#1abc9c' },
    ec: { label: '电导率', unit: 'μS/cm', color: '#f39c12' },
    co2: { label: 'CO2', unit: 'ppm', color: '#2ecc71' },
    light: { label: '光照', unit: 'lux', color: '#f1c40f' },
    pressure: { label: '气压', unit: 'hPa', color: '#34495e' },
    wind_speed: { label: '风速', unit: 'm/s', color: '#95a5a6' }
  }

  // 处理设备变更
  const handleDeviceChange = (deviceId) => {
    if (selectedDevices.includes(deviceId)) {
      setSelectedDevices(selectedDevices.filter(id => id !== deviceId))
    } else {
      setSelectedDevices([...selectedDevices, deviceId])
    }
  }

  // 处理会话变更
  const handleSessionChange = (sessionId) => {
    if (selectedSessions.includes(sessionId)) {
      setSelectedSessions(selectedSessions.filter(id => id !== sessionId))
    } else {
      setSelectedSessions([...selectedSessions, sessionId])
    }
  }

  // 格式化日期
  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  }

  // 生成简单的条形图
  const renderBarChart = (data) => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="no-data">暂无数据</p>
    }

    const maxValue = Math.max(...Object.values(data))

    return (
      <div className="simple-chart">
        {Object.entries(data).map(([key, value]) => {
          const configInfo = dataTypeConfig[key] || { label: key, color: '#95a5a6' }
          const percentage = (value / maxValue) * 100

          return (
            <div key={key} className="chart-bar-wrapper">
              <div className="chart-bar-label">{configInfo.label}</div>
              <div className="chart-bar-container">
                <div
                  className="chart-bar"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: configInfo.color
                  }}
                />
                <span className="chart-bar-value">{value}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="dashboard-data-analyze">
      <div className="dashboard-header">
        <h1>数据分析</h1>
      </div>

      {/* 控制面板 */}
      <div className="analysis-controls">
        <div className="controls-header">
          <div className="filter-group">
            <div className="filter-item">
              <label>时间范围</label>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                options={[
                  { value: 'week', label: '最近一周' },
                  { value: 'month', label: '最近一月' },
                  { value: 'quarter', label: '最近一季' },
                  { value: 'year', label: '最近一年' }
                ]}
              />
            </div>

            <div className="filter-item">
              <label>数据类型</label>
              <Select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                options={[
                  { value: 'all', label: '全部类型' },
                  ...Object.entries(dataTypeConfig).map(([key, config]) => ({
                    value: key,
                    label: config.label
                  }))
                ]}
              />
            </div>
          </div>

          <div className="selection-summary">
            <span className="summary-item">
              <strong>采集会话:</strong> {selectedSessions.length}/{sessions.length}
            </span>
            <span className="summary-item">
              <strong>设备:</strong> {selectedDevices.length}/{devices.length}
            </span>
          </div>
        </div>

        <div className="controls-body">
          <div className="checkbox-group">
            <div className="checkbox-group-header">
              <label>采集会话</label>
              <button
                className="text-button"
                onClick={() => setSelectedSessions(sessions.map(s => s.id))}
              >
                全选
              </button>
              <button
                className="text-button"
                onClick={() => setSelectedSessions([])}
              >
                清空
              </button>
            </div>
            <div className="checkbox-list">
              {sessions.map(session => (
                <label key={session.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedSessions.includes(session.id)}
                    onChange={() => handleSessionChange(session.id)}
                  />
                  <span className="checkbox-label-text">
                    {session.mission_name || session.mission_type || `会话 ${session.id.slice(0, 8)}`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="checkbox-group">
            <div className="checkbox-group-header">
              <label>设备</label>
              <button
                className="text-button"
                onClick={() => setSelectedDevices(devices.map(d => d.id))}
              >
                全选
              </button>
              <button
                className="text-button"
                onClick={() => setSelectedDevices([])}
              >
                清空
              </button>
            </div>
            <div className="checkbox-list">
              {devices.map(device => (
                <label key={device.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedDevices.includes(device.id)}
                    onChange={() => handleDeviceChange(device.id)}
                  />
                  <span className="checkbox-label-text">
                    {device.model || device.device_type || `设备 ${device.id.slice(0, 8)}`}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>加载数据中...</p>
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="statistics-grid">
            <div className="stat-card stat-card-primary">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.total_records}</div>
                <div className="stat-label">总数据记录</div>
              </div>
            </div>

            <div className="stat-card stat-card-success">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.session_count}</div>
                <div className="stat-label">涉及会话</div>
              </div>
            </div>

            <div className="stat-card stat-card-info">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{Object.keys(statistics.data_types).length}</div>
                <div className="stat-label">数据类型</div>
              </div>
            </div>

            <div className="stat-card stat-card-warning">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{selectedDevices.length}</div>
                <div className="stat-label">选中设备</div>
              </div>
            </div>
          </div>

          {/* 数据分布 */}
          <div className="chart-section">
            <h2>数据分布</h2>
            <div className="chart-card">
              {renderBarChart(statistics.data_types)}
            </div>
          </div>

          {/* 数据统计 */}
          <div className="chart-section">
            <h2>数据统计</h2>
            <div className="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>数据类型</th>
                    <th>记录数</th>
                    <th>平均值</th>
                    <th>最小值</th>
                    <th>最大值</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statistics.data_types).map(([key, count]) => {
                    const configInfo = dataTypeConfig[key] || { label: key }
                    
                    // 格式化数值并添加单位
                    const formatValue = (value, unit) => {
                      if (value === undefined || value === null) return '-'
                      const strValue = String(value).trim()
                      // 如果值已包含空格（后端已添加单位），直接返回
                      if (strValue.includes(' ')) {
                        return strValue
                      }
                      // 否则是纯数字，添加单位
                      const numValue = parseFloat(strValue)
                      if (isNaN(numValue)) return strValue
                      return unit ? `${numValue.toFixed(2)} ${unit}` : numValue.toFixed(2)
                    }
                    
                    return (
                      <tr key={key}>
                        <td>
                          <span
                            className="type-indicator"
                            style={{ backgroundColor: configInfo.color }}
                          ></span>
                          {configInfo.label}
                        </td>
                        <td>{count}</td>
                        <td>{formatValue(statistics.average_values[key], configInfo.unit)}</td>
                        <td>{formatValue(statistics.min_values[key], configInfo.unit)}</td>
                        <td>{formatValue(statistics.max_values[key], configInfo.unit)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 最近数据 */}
          <div className="chart-section">
            <h2>最近数据</h2>
            <div className="recent-data">
              {rawData.slice(0, 10).map(item => {
                const configInfo = dataTypeConfig[item.data_subtype] || { label: item.data_subtype }

                // 判断是否是图片/文件类型
                const isImage = item.data_type === 'image' || item.data_type === 'file'
                const minioPath = item.object_key

                // 使用 getMinioUrl 构建完整的公开访问URL
                const imageUrl = isImage && minioPath ? getMinioUrl(minioPath, false) : null

                return (
                  <div key={item.id} className="data-item">
                    <div className="data-item-header">
                      <span className="data-type-badge" style={{ backgroundColor: configInfo.color }}>
                        {configInfo.label}
                      </span>
                      <span className="data-time">{formatDate(item.capture_time || item.created_at)}</span>
                    </div>
                    <div className="data-item-value">
                      {imageUrl ? (
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#007bff',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            borderBottom: '1px dotted #007bff'
                          }}
                        >
                          查看图片
                        </a>
                      ) : (
                        <>
                          <span className="value-text">{item.data_value}</span>
                          {/* 后端已添加单位，检查值是否已包含空格（带单位） */}
                          {!String(item.data_value || '').includes(' ') && configInfo.unit && (
                            <span className="value-unit">{configInfo.unit}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              {rawData.length === 0 && (
                <div className="empty-state">
                  <p>暂无数据</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DataAnalyze
