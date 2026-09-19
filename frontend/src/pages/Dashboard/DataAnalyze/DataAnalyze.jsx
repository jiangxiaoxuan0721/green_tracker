import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart3, RefreshCw, Database, ListChecks, Layers, Cpu, Maximize2
} from 'lucide-react'
import { useAuth } from '@/hooks/auth/useAuth'
import { rawDataService } from '@/services/rawDataService'
import { deviceService } from '@/services/deviceService'
import { collectionSessionService } from '@/services/collectionSessionService'
import { Button, Card, PageHeader } from '@/components/ui'
import {
  FilterPanel, FilterSelect, FilterMultiSelect, StatsBar, DataTable
} from '@/components/business'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import ChartDetailModal from './ChartDetailModal'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './DataAnalyze.css'

// ── 监测指标配置 ──────────────────────────────────
const METRIC_CONFIG = {
  temperature:       { label: '温度', unit: '°C', color: '#e74c3c' },
  humidity:          { label: '湿度', unit: '%', color: '#3498db' },
  co2:               { label: 'CO₂', unit: 'ppm', color: '#2ecc71' },
  light:             { label: '光照', unit: 'lux', color: '#f1c40f' },
  pressure:          { label: '气压', unit: 'hPa', color: '#6366f1' },
  wind_speed:        { label: '风速', unit: 'm/s', color: '#64748b' },
  temperature_soil:  { label: '土壤温度', unit: '°C', color: '#c0392b' },
  moisture:          { label: '土壤湿度', unit: '%', color: '#8b5cf6' },
  ph:                { label: '土壤pH', unit: '', color: '#14b8a6' },
  ec:                { label: '电导率', unit: 'μS/cm', color: '#f97316' },
}

// ── 数据大类（决定可选的监测指标）───────────────────
const CATEGORY_CONFIG = {
  all:           { label: '全部类型', subtypes: Object.keys(METRIC_CONFIG) },
  environmental: { label: '环境数据', subtypes: ['temperature', 'humidity', 'co2', 'light', 'pressure', 'wind_speed'] },
  soil:          { label: '土壤数据', subtypes: ['temperature_soil', 'moisture', 'ph', 'ec'] },
  file:          { label: '文件数据', subtypes: [] }
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'environmental', label: '环境数据' },
  { value: 'soil', label: '土壤数据' },
  { value: 'file', label: '文件数据' }
]

// ── 时间范围 ──────────────────────────────────────
const TIME_RANGE_CONFIG = {
  day:     { label: '最近 24 小时', hours: 24 },
  week:    { label: '最近一周', days: 7 },
  month:   { label: '最近一月', months: 1 },
  quarter: { label: '最近一季', months: 3 },
  year:    { label: '最近一年', years: 1 },
  all:     { label: '全部时间' }
}

const TIME_RANGE_OPTIONS = Object.entries(TIME_RANGE_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label
}))

const EMPTY_STATISTICS = {
  total_records: 0,
  data_types: {},
  average_values: {},
  min_values: {},
  max_values: {},
  session_count: 0
}

const resolveRange = (range) => {
  const end = new Date()
  if (range === 'all') return { start: null, end }

  const cfg = TIME_RANGE_CONFIG[range] || TIME_RANGE_CONFIG.month
  const start = new Date()
  if (cfg.hours) start.setHours(start.getHours() - cfg.hours)
  if (cfg.days) start.setDate(start.getDate() - cfg.days)
  if (cfg.months) start.setMonth(start.getMonth() - cfg.months)
  if (cfg.years) start.setFullYear(start.getFullYear() - cfg.years)
  return { start, end }
}

const formatDay = (date) => date
  ? date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  : '—'

// ── 可点击放大的图表外壳 ───────────────────────────
const ChartShell = ({ span = 1, label, onExpand, children }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onExpand()
    }
  }

  return (
    <div
      className={`chart-card-shell chart-card-span-${span}`}
      role="button"
      tabIndex={0}
      aria-label={`放大查看${label}`}
      onClick={onExpand}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}

// ── 折线图卡片组件 ─────────────────────────────────
const LineChartCard = ({ title, data, dataKey, color, unit, span = 1, onExpand }) => {
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
    <ChartShell span={span} label={title} onExpand={onExpand}>
      <Card className="chart-card">
        <div className="chart-card-header">
          <h3>{title}</h3>
          <span className="chart-card-unit">{unit || '-'}</span>
          <Maximize2 size={12} className="chart-card-expand-icon" aria-hidden="true" />
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #e5e7eb)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }}
                axisLine={{ stroke: 'var(--border-light, #e5e7eb)' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                name={title}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </ChartShell>
  )
}

// ── 主组件 ────────────────────────────────────────
const DataAnalyze = () => {
  const { user } = useAuth()

  const [metaLoading, setMetaLoading] = useState(true)
  const [querying, setQuerying] = useState(false)
  const [error, setError] = useState(null)

  const [devices, setDevices] = useState([])
  const [sessions, setSessions] = useState([])

  // 筛选条件：时间范围 / 数据大类 / 监测指标 / 设备 / 采集会话
  const [timeRange, setTimeRange] = useState('month')
  const [category, setCategory] = useState('all')
  const [metric, setMetric] = useState('all')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([])
  const [selectedSessionIds, setSelectedSessionIds] = useState([])

  const [statistics, setStatistics] = useState(EMPTY_STATISTICS)
  const [timeseries, setTimeseries] = useState({})
  const [rangeLabel, setRangeLabel] = useState('')

  // 放大查看的图表（null 表示未打开）
  const [expandedChart, setExpandedChart] = useState(null)

  // ── 加载筛选项（设备 / 采集会话）──
  const loadMeta = useCallback(async () => {
    if (!user?.id) return
    setMetaLoading(true)
    try {
      const [devicesRes, sessionsData] = await Promise.all([
        deviceService.getDevices(),
        collectionSessionService.getSessions({ limit: 100 })
      ])
      setDevices(Array.isArray(devicesRes) ? devicesRes : (devicesRes?.data || []))
      setSessions(sessionsData || [])
    } catch (err) {
      console.error('获取分析筛选项失败:', err)
      setError('获取设备/任务列表失败，请稍后再试')
    } finally {
      setMetaLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadMeta() }, [loadMeta])

  // ── 选择逻辑 ──
  // 空选 = 不限；设备与会话是「与」关系，最终落到 session_ids 上
  // （后端按 session 聚合，设备通过 session.device_id 间接过滤）
  const effectiveSessionIds = useMemo(() => {
    const deviceFilterActive =
      selectedDeviceIds.length > 0 && selectedDeviceIds.length < devices.length
    const sessionFilterActive =
      selectedSessionIds.length > 0 && selectedSessionIds.length < sessions.length

    if (!deviceFilterActive && !sessionFilterActive) return null // null = 不限制

    return sessions
      .filter(s => !deviceFilterActive || selectedDeviceIds.includes(s.device_id))
      .filter(s => !sessionFilterActive || selectedSessionIds.includes(s.id))
      .map(s => s.id)
  }, [sessions, devices, selectedDeviceIds, selectedSessionIds])

  // 用字符串做依赖，避免数组引用变化导致重复请求
  const sessionIdsKey = effectiveSessionIds ? effectiveSessionIds.join(',') : ''

  // 当前筛选命中的会话（用于「涉及设备」统计）
  const scopedSessions = useMemo(() => {
    if (!effectiveSessionIds) return sessions
    const idSet = new Set(effectiveSessionIds)
    return sessions.filter(s => idSet.has(s.id))
  }, [sessions, effectiveSessionIds])

  const deviceOptions = useMemo(() => devices.map(d => ({
    value: d.id,
    label: d.name || d.model || d.device_type || `设备 ${String(d.id).slice(0, 8)}`
  })), [devices])

  const sessionOptions = useMemo(() => sessions.map(s => ({
    value: s.id,
    label: [s.mission_name || s.mission_type, s.field_name].filter(Boolean).join(' · ')
      || `任务 ${String(s.id).slice(0, 8)}`
  })), [sessions])

  const metricOptions = useMemo(() => {
    const subtypes = (CATEGORY_CONFIG[category] || CATEGORY_CONFIG.all).subtypes
    return [
      { value: 'all', label: '全部指标' },
      ...subtypes.map(k => ({ value: k, label: METRIC_CONFIG[k]?.label || k }))
    ]
  }, [category])

  // ── 加载统计数据 + 时序数据 ──
  const loadAnalysis = useCallback(async () => {
    if (!user?.id || sessions.length === 0) return

    // 筛选后没有任何命中的任务，直接给出空结果（否则空 session_ids 会被后端当成「不限制」）
    if (effectiveSessionIds && effectiveSessionIds.length === 0) {
      setStatistics(EMPTY_STATISTICS)
      setTimeseries({})
      setError(null)
      return
    }

    setQuerying(true)
    setError(null)

    try {
      const { start, end } = resolveRange(timeRange)
      const base = { user_id: user.id }
      if (start) base.start_time = start.toISOString()
      base.end_time = end.toISOString()
      if (effectiveSessionIds) base.session_ids = effectiveSessionIds.join(',')

      const statsParams = { ...base }
      if (category !== 'all') statsParams.data_type = category
      if (metric !== 'all') statsParams.data_subtype = metric

      const wantedSubtypes = metric !== 'all'
        ? [metric]
        : ((CATEGORY_CONFIG[category] || CATEGORY_CONFIG.all).subtypes)

      const seriesParams = { ...base, limit: 200 }
      if (wantedSubtypes.length > 0) seriesParams.data_subtypes = wantedSubtypes.join(',')

      const [statsRes, seriesRes] = await Promise.all([
        rawDataService.getRawDataStatistics(statsParams),
        rawDataService.getTimeseriesData(seriesParams)
      ])

      setStatistics(statsRes?.code === 200 ? (statsRes.data || EMPTY_STATISTICS) : EMPTY_STATISTICS)
      if (statsRes?.code !== 200) setError(statsRes?.message || '获取分析数据失败')

      setTimeseries(seriesRes?.code === 200 && seriesRes.data?.series ? seriesRes.data.series : {})
      setRangeLabel(`${formatDay(start)} ~ ${formatDay(end)}`)
    } catch (err) {
      console.error('获取分析数据失败:', err)
      setError('获取分析数据失败，请稍后再试')
    } finally {
      setQuerying(false)
    }
  }, [user?.id, sessions.length, timeRange, category, metric, effectiveSessionIds, sessionIdsKey])

  useEffect(() => { loadAnalysis() }, [loadAnalysis])

  // ── 筛选事件处理 ──
  const handleCategoryChange = (e) => {
    setCategory(e.target.value)
    setMetric('all') // 大类变化后原指标可能已不在候选内
  }

  const handleReset = () => {
    setTimeRange('month')
    setCategory('all')
    setMetric('all')
    setSelectedDeviceIds([])
    setSelectedSessionIds([])
  }

  // ── 顶部统计栏数据 ──
  const barItems = useMemo(() => {
    const involvedDevices = new Set(scopedSessions.map(s => s.device_id).filter(Boolean)).size
    return [
      {
        key: 'records',
        icon: Database,
        label: '数据记录',
        value: statistics.total_records,
        tone: 'primary'
      },
      {
        key: 'sessions',
        icon: ListChecks,
        label: '涉及任务',
        value: statistics.session_count,
        tone: 'success'
      },
      {
        key: 'metrics',
        icon: Layers,
        label: '覆盖指标',
        value: Object.keys(statistics.data_types || {}).length,
        tone: 'info'
      },
      {
        key: 'devices',
        icon: Cpu,
        label: '涉及设备',
        value: involvedDevices,
        tone: 'warning'
      }
    ]
  }, [statistics, scopedSessions])

  // ── 时序图：只渲染真正有数据的指标 ──
  const visibleSeries = useMemo(() => {
    const order = Object.keys(METRIC_CONFIG)
    return Object.keys(timeseries)
      .filter(k => Array.isArray(timeseries[k]) && timeseries[k].length > 0)
      .sort((a, b) => {
        const ia = order.indexOf(a)
        const ib = order.indexOf(b)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      })
  }, [timeseries])

  // ── 数据分布（同时供小图与放大视图使用）──
  const distributionRows = useMemo(() => (
    Object.entries(statistics.data_types || {})
      .map(([key, value]) => {
        const cfg = METRIC_CONFIG[key] || { label: key, color: '#95a5a6' }
        return { key, label: cfg.label, color: cfg.color, value }
      })
      .sort((a, b) => b.value - a.value)
  ), [statistics])

  const renderBarChart = (rows) => {
    if (!rows || rows.length === 0) {
      return <p className="no-data">暂无数据</p>
    }
    const maxValue = Math.max(...rows.map(r => r.value))
    return (
      <div className="simple-chart">
        {rows.map(({ key, label, value, color }) => (
          <div key={key} className="chart-bar-wrapper">
            <div className="chart-bar-label">{label}</div>
            <div className="chart-bar-container">
              <div className="chart-bar" style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: color }} />
              <span className="chart-bar-value">{value}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── 统计明细表 ──
  const formatMetricValue = (value, unit) => {
    if (value === undefined || value === null || value === '') return '-'
    const raw = String(value).trim()
    if (raw.includes(' ')) return raw // 后端已带单位
    const num = parseFloat(raw)
    if (isNaN(num)) return raw
    return unit ? `${num.toFixed(2)} ${unit}` : num.toFixed(2)
  }

  const statsColumns = [
    {
      title: '监测指标',
      dataIndex: 'label',
      render: (label, row) => (
        <>
          <span className="type-indicator" style={{ backgroundColor: row.color }}></span>
          {label}
        </>
      )
    },
    { title: '记录数', dataIndex: 'count' },
    { title: '平均值', dataIndex: 'avg', render: (v, row) => formatMetricValue(v, row.unit) },
    { title: '最小值', dataIndex: 'min', render: (v, row) => formatMetricValue(v, row.unit) },
    { title: '最大值', dataIndex: 'max', render: (v, row) => formatMetricValue(v, row.unit) }
  ]

  const statsRows = useMemo(() => (
    Object.entries(statistics.data_types || {})
      .map(([key, count]) => {
        const cfg = METRIC_CONFIG[key] || { label: key, unit: '', color: '#95a5a6' }
        return {
          key,
          label: cfg.label,
          color: cfg.color,
          unit: cfg.unit,
          count,
          avg: statistics.average_values?.[key],
          min: statistics.min_values?.[key],
          max: statistics.max_values?.[key]
        }
      })
      .sort((a, b) => b.count - a.count)
  ), [statistics])

  const hasScope = !(effectiveSessionIds && effectiveSessionIds.length === 0)

  return (
    <div className="dashboard-data-analyze">
      <PageHeader
        icon={BarChart3}
        title="数据分析"
        description="按时间、设备、任务与指标多维度分析采集数据"
        actions={
          <Button
            variant="outline"
            size="small"
            icon={RefreshCw}
            onClick={() => { loadMeta(); loadAnalysis() }}
            disabled={metaLoading || querying}
          >
            刷新
          </Button>
        }
      />

      <FilterPanel onReset={handleReset}>
        <FilterSelect
          label="时间范围"
          name="timeRange"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          options={TIME_RANGE_OPTIONS}
        />
        <FilterSelect
          label="数据大类"
          name="category"
          value={category}
          onChange={handleCategoryChange}
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          label="监测指标"
          name="metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          options={metricOptions}
          disabled={metricOptions.length <= 1}
        />
        <FilterMultiSelect
          label="采集设备"
          value={selectedDeviceIds}
          options={deviceOptions}
          onChange={setSelectedDeviceIds}
          disabled={metaLoading}
        />
        <FilterMultiSelect
          label="采集任务"
          value={selectedSessionIds}
          options={sessionOptions}
          onChange={setSelectedSessionIds}
          disabled={metaLoading}
        />
      </FilterPanel>

      <StatsBar
        items={barItems}
        loading={querying || metaLoading}
        extra={rangeLabel ? `统计区间 ${rangeLabel}` : null}
      />

      {error && <div className="error-message">{error}</div>}

      {metaLoading ? (
        <div className="loading-state"><div className="spinner"></div><p>加载筛选项中...</p></div>
      ) : (
        <>
          {!hasScope && (
            <div className="analyze-hint">
              当前设备 / 任务筛选没有匹配到任何采集任务，请调整筛选条件。
            </div>
          )}

          {/* ── 时序折线图 ── */}
          <div className="chart-section">
            <h2>时序趋势<span className="chart-section-hint">点击图表可放大查看</span></h2>
            {querying ? (
              <div className="loading-state"><div className="spinner"></div><p>正在查询...</p></div>
            ) : visibleSeries.length === 0 ? (
              <p className="no-data">当前筛选条件下暂无时序数据</p>
            ) : (
              <div className="charts-grid">
                {visibleSeries.map((key, index) => {
                  const cfg = METRIC_CONFIG[key] || { label: key, unit: '', color: '#95a5a6' }
                  const span = visibleSeries.length === 1 ? 4 : (index === 0 ? 2 : 1)
                  return (
                    <LineChartCard
                      key={key}
                      title={cfg.label}
                      data={timeseries[key]}
                      dataKey="value"
                      color={cfg.color}
                      unit={cfg.unit}
                      span={span}
                      onExpand={() => setExpandedChart({
                        type: 'line',
                        title: cfg.label,
                        unit: cfg.unit,
                        color: cfg.color,
                        data: timeseries[key]
                      })}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 数据分布 + 统计明细（同一行）── */}
          <div className="analyze-duo">
            <div className="chart-section">
              <h2>数据分布</h2>
              <ChartShell
                label="数据分布"
                onExpand={() => setExpandedChart({
                  type: 'bar',
                  title: '数据分布',
                  unit: '条',
                  color: '#22c55e',
                  data: distributionRows
                })}
              >
                <Card className={`chart-card ${querying ? 'is-querying' : ''}`}>
                  {renderBarChart(distributionRows)}
                </Card>
              </ChartShell>
            </div>

            <div className="chart-section">
              <h2>统计明细</h2>
              <div className="stats-table-wrap">
                <DataTable
                  columns={statsColumns}
                  data={statsRows}
                  loading={false}
                  querying={querying}
                  rowKey="key"
                  emptyMessage="暂无统计数据"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <ChartDetailModal
        chart={expandedChart}
        onClose={() => setExpandedChart(null)}
      />
    </div>
  )
}

export default DataAnalyze
