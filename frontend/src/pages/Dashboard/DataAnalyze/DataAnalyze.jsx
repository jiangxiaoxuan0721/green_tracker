import { useState, useEffect, useCallback } from 'react'
import { BarChart3 } from 'lucide-react'
import { useAuth } from '@/hooks/auth/useAuth'
import { rawDataService } from '@/services/rawDataService'
import { deviceService } from '@/services/deviceService'
import { collectionSessionService } from '@/services/collectionSessionService'
import { Select, PageHeader, Card } from '@/components/ui'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './DataAnalyze.css'

// ── 数据类型配置 ──────────────────────────────────
const DATA_TYPE_CONFIG = {
  temperature:       { label: '温度', unit: '°C', color: '#e74c3c', icon: '🌡️' },
  humidity:          { label: '湿度', unit: '%', color: '#3498db', icon: '💧' },
  co2:               { label: 'CO₂', unit: 'ppm', color: '#2ecc71', icon: '🌿' },
  light:             { label: '光照', unit: 'lux', color: '#f1c40f', icon: '☀️' },
  pressure:          { label: '气压', unit: 'hPa', color: '#6366f1', icon: '🌀' },
  temperature_soil:  { label: '土壤温度', unit: '°C', color: '#c0392b', icon: '🌱' },
  moisture:          { label: '土壤湿度', unit: '%', color: '#8b5cf6', icon: '💦' },
  ph:                { label: '土壤pH', unit: '', color: '#14b8a6', icon: '🧪' },
  ec:                { label: '电导率', unit: 'μS/cm', color: '#f97316', icon: '⚡' },
  wind_speed:        { label: '风速', unit: 'm/s', color: '#64748b', icon: '💨' },
}

// ── 折线图卡片组件 ─────────────────────────────────
const LineChartCard = ({ title, data, dataKey, color, unit, span = 1 }) => {
  if (!data || data.length === 0) {
    return (
      <Card className={`chart-card chart-card-span-${span} chart-card-empty`}>
        <div className="chart-card-header">
          <h3>{title}</h3>
        </div>
        <div className="chart-empty-state">
          <span className="chart-empty-icon">📊</span>
          <p>暂无数据</p>
        </div>
      </Card>
    )
  }

  // 格式化时间轴标签
  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    try {
      const d = new Date(timeStr)
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch { return timeStr }
  }

  // 自定义 tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-time">{formatTime(label)}</p>
          {payload.map((entry, index) => (
            <p key={index} className="chart-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value} {unit}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card className={`chart-card chart-card-span-${span}`}>
      <div className="chart-card-header">
        <h3>{title}</h3>
        <span className="chart-card-unit">{unit}</span>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #e5e7eb)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 11, fill: 'var(--text-muted, #9ca3af)' }}
              axisLine={{ stroke: 'var(--border-light, #e5e7eb)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted, #9ca3af)' }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              name={title}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ── 主组件 ────────────────────────────────────────
const DataAnalyze = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [sessions, setSessions] = useState([])

  const [timeRange, setTimeRange] = useState('month')
  const [selectedDevices, setSelectedDevices] = useState([])
  const [selectedSessions, setSelectedSessions] = useState([])
  const [dataType, setDataType] = useState('all')

  const [statistics, setStatistics] = useState({
    total_records: 0,
    data_types: {},
    average_values: {},
    min_values: {},
    max_values: {},
    session_count: 0
  })

  // timeseries 数据 { temperature: [{time, value}, ...], humidity: [...] }
  const [timeseries, setTimeseries] = useState({})

  // ── 获取设备列表 ──
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devicesData = await deviceService.getDevices()
        setDevices(devicesData.data || [])
        if (devicesData.data?.length) {
          setSelectedDevices(devicesData.data.map(d => d.id))
        }
      } catch (err) { console.error('获取设备列表失败:', err) }
    }
    if (user?.id) fetchDevices()
  }, [user?.id])

  // ── 获取会话列表 ──
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await collectionSessionService.getSessions({ limit: 100 })
        setSessions(data || [])
        if (data?.length) setSelectedSessions(data.map(s => s.id))
      } catch (err) { console.error('获取会话列表失败:', err) }
    }
    if (user?.id) fetchSessions()
  }, [user?.id])

  // ── 构建有效的 session IDs ──
  const getEffectiveSessionIds = useCallback(() => {
    if (selectedSessions.length > 0 && selectedSessions.length !== sessions.length) {
      return selectedSessions
    }
    return sessions.map(s => s.id)
  }, [selectedSessions, sessions])

  // ── 获取数据统计 ──
  useEffect(() => {
    const fetch = async () => {
      if (!user?.id || sessions.length === 0) return
      setLoading(true)
      setError(null)

      try {
        const endDate = new Date()
        const startDate = new Date()
        switch (timeRange) {
          case 'week': startDate.setDate(endDate.getDate() - 7); break
          case 'month': startDate.setMonth(endDate.getMonth() - 1); break
          case 'quarter': startDate.setMonth(endDate.getMonth() - 3); break
          case 'year': startDate.setFullYear(endDate.getFullYear() - 1); break
        }

        const sessionIds = getEffectiveSessionIds()
        const params = {
          user_id: user.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString()
        }
        if (sessionIds.length > 0) params.session_ids = sessionIds.join(',')
        if (dataType !== 'all') params.data_subtype = dataType

        const res = await rawDataService.getRawDataStatistics(params)
        if (res.code === 200) setStatistics(res.data)
        else setError(res.message || '获取分析数据失败')
      } catch (err) {
        setError('获取分析数据失败，请稍后再试')
      } finally { setLoading(false) }
    }
    fetch()
  }, [user?.id, timeRange, selectedSessions, dataType, sessions, getEffectiveSessionIds])

  // ── 获取时序数据（折线图） ──
  useEffect(() => {
    const fetch = async () => {
      if (!user?.id || sessions.length === 0) return
      setChartLoading(true)

      try {
        const endDate = new Date()
        const startDate = new Date()
        switch (timeRange) {
          case 'week': startDate.setDate(endDate.getDate() - 7); break
          case 'month': startDate.setMonth(endDate.getMonth() - 1); break
          case 'quarter': startDate.setMonth(endDate.getMonth() - 3); break
          case 'year': startDate.setFullYear(endDate.getFullYear() - 1); break
        }

        const sessionIds = getEffectiveSessionIds()
        const params = {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          limit: 200
        }
        if (sessionIds.length > 0) params.session_ids = sessionIds.join(',')

        // 根据筛选决定查询哪些子类型
        if (dataType !== 'all') {
          params.data_subtypes = dataType
        } else {
          // 默认查询所有数值类型
          params.data_subtypes = 'temperature,humidity,co2,light,pressure,temperature_soil,moisture,ph,ec'
        }

        const res = await rawDataService.getTimeseriesData(params)
        if (res.code === 200 && res.data?.series) {
          setTimeseries(res.data.series)
        }
      } catch (err) {
        console.error('获取时序数据失败:', err)
      } finally { setChartLoading(false) }
    }
    fetch()
  }, [user?.id, timeRange, selectedSessions, dataType, sessions, getEffectiveSessionIds])

  // ── 筛选事件处理 ──
  const handleDeviceChange = (id) => {
    setSelectedDevices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const handleSessionChange = (id) => {
    setSelectedSessions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── 渲染条形图 ──
  const renderBarChart = (data) => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="no-data">暂无数据</p>
    }
    const maxValue = Math.max(...Object.values(data))
    return (
      <div className="simple-chart">
        {Object.entries(data).map(([key, value]) => {
          const cfg = DATA_TYPE_CONFIG[key] || { label: key, color: '#95a5a6' }
          return (
            <div key={key} className="chart-bar-wrapper">
              <div className="chart-bar-label">{cfg.label}</div>
              <div className="chart-bar-container">
                <div className="chart-bar" style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: cfg.color }} />
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
      <PageHeader
        icon={BarChart3}
        title="数据分析"
        description="多维度分析农业数据，生成可视化报表"
      />

      {/* ── 控制面板 ── */}
      <div className="analysis-controls">
        <div className="controls-header">
          <div className="filter-group">
            <div className="filter-item">
              <label>时间范围</label>
              <Select value={timeRange} onChange={e => setTimeRange(e.target.value)}
                options={[
                  { value: 'week', label: '最近一周' },
                  { value: 'month', label: '最近一月' },
                  { value: 'quarter', label: '最近一季' },
                  { value: 'year', label: '最近一年' }
                ]} />
            </div>
            <div className="filter-item">
              <label>数据类型</label>
              <Select value={dataType} onChange={e => setDataType(e.target.value)}
                options={[
                  { value: 'all', label: '全部类型' },
                  ...Object.entries(DATA_TYPE_CONFIG).map(([k, c]) => ({ value: k, label: c.label }))
                ]} />
            </div>
          </div>
          <div className="selection-summary">
            <span className="summary-item"><strong>会话:</strong> {selectedSessions.length}/{sessions.length}</span>
            <span className="summary-item"><strong>设备:</strong> {selectedDevices.length}/{devices.length}</span>
          </div>
        </div>
        <div className="controls-body">
          <div className="checkbox-group">
            <div className="checkbox-group-header">
              <label>采集会话</label>
              <button className="text-button" onClick={() => setSelectedSessions(sessions.map(s => s.id))}>全选</button>
              <button className="text-button" onClick={() => setSelectedSessions([])}>清空</button>
            </div>
            <div className="checkbox-list">
              {sessions.map(s => (
                <label key={s.id} className="checkbox-item">
                  <input type="checkbox" checked={selectedSessions.includes(s.id)} onChange={() => handleSessionChange(s.id)} />
                  <span className="checkbox-label-text">{s.mission_name || s.mission_type || `会话 ${s.id.slice(0, 8)}`}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="checkbox-group">
            <div className="checkbox-group-header">
              <label>设备</label>
              <button className="text-button" onClick={() => setSelectedDevices(devices.map(d => d.id))}>全选</button>
              <button className="text-button" onClick={() => setSelectedDevices([])}>清空</button>
            </div>
            <div className="checkbox-list">
              {devices.map(d => (
                <label key={d.id} className="checkbox-item">
                  <input type="checkbox" checked={selectedDevices.includes(d.id)} onChange={() => handleDeviceChange(d.id)} />
                  <span className="checkbox-label-text">{d.model || d.device_type || `设备 ${d.id.slice(0, 8)}`}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state"><div className="spinner"></div><p>加载数据中...</p></div>
      ) : (
        <>
          {/* ── 统计卡片 ── */}
          <div className="statistics-grid">
            <div className="stat-card stat-card-primary">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
                </svg>
              </div>
              <div className="stat-content"><div className="stat-value">{statistics.total_records}</div><div className="stat-label">总数据记录</div></div>
            </div>
            <div className="stat-card stat-card-success">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="stat-content"><div className="stat-value">{statistics.session_count}</div><div className="stat-label">涉及会话</div></div>
            </div>
            <div className="stat-card stat-card-info">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
                </svg>
              </div>
              <div className="stat-content"><div className="stat-value">{Object.keys(statistics.data_types).length}</div><div className="stat-label">数据类型</div></div>
            </div>
            <div className="stat-card stat-card-warning">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="stat-content"><div className="stat-value">{selectedDevices.length}</div><div className="stat-label">选中设备</div></div>
            </div>
          </div>

          {/* ── 时序折线图（网格布局） ── */}
          <div className="chart-section">
            <h2>时序趋势</h2>
            {chartLoading ? (
              <div className="loading-state"><div className="spinner"></div><p>加载图表数据...</p></div>
            ) : (
              <div className="charts-grid">
                <LineChartCard title="温度" data={timeseries.temperature} dataKey="value" color={DATA_TYPE_CONFIG.temperature.color} unit="°C" span={2} />
                <LineChartCard title="湿度" data={timeseries.humidity} dataKey="value" color={DATA_TYPE_CONFIG.humidity.color} unit="%" span={1} />
                <LineChartCard title="CO₂" data={timeseries.co2} dataKey="value" color={DATA_TYPE_CONFIG.co2.color} unit="ppm" span={1} />
                <LineChartCard title="光照" data={timeseries.light} dataKey="value" color={DATA_TYPE_CONFIG.light.color} unit="lux" span={1} />
                <LineChartCard title="气压" data={timeseries.pressure} dataKey="value" color={DATA_TYPE_CONFIG.pressure.color} unit="hPa" span={1} />
                <LineChartCard title="土壤温度" data={timeseries.temperature_soil} dataKey="value" color={DATA_TYPE_CONFIG.temperature_soil.color} unit="°C" span={1} />
                <LineChartCard title="土壤湿度" data={timeseries.moisture} dataKey="value" color={DATA_TYPE_CONFIG.moisture.color} unit="%" span={1} />
                <LineChartCard title="土壤pH" data={timeseries.ph} dataKey="value" color={DATA_TYPE_CONFIG.ph.color} unit="" span={1} />
              </div>
            )}
          </div>

          {/* ── 数据分布 ── */}
          <div className="chart-section">
            <h2>数据分布</h2>
            <Card className="chart-card">
              {renderBarChart(statistics.data_types)}
            </Card>
          </div>

          {/* ── 数据统计表 ── */}
          <div className="chart-section">
            <h2>数据统计</h2>
            <div className="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>数据类型</th><th>记录数</th><th>平均值</th><th>最小值</th><th>最大值</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statistics.data_types).map(([key, count]) => {
                    const cfg = DATA_TYPE_CONFIG[key] || { label: key, unit: '' }
                    const fmt = (v) => {
                      if (v === undefined || v === null) return '-'
                      const s = String(v).trim()
                      if (s.includes(' ')) return s
                      const n = parseFloat(s)
                      return isNaN(n) ? s : cfg.unit ? `${n.toFixed(2)} ${cfg.unit}` : n.toFixed(2)
                    }
                    return (
                      <tr key={key}>
                        <td><span className="type-indicator" style={{ backgroundColor: cfg.color }}></span>{cfg.label}</td>
                        <td>{count}</td>
                        <td>{fmt(statistics.average_values[key])}</td>
                        <td>{fmt(statistics.min_values[key])}</td>
                        <td>{fmt(statistics.max_values[key])}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DataAnalyze
