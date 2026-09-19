import { useMemo } from 'react'
import { Modal } from '@/components/ui'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Brush
} from 'recharts'
import './ChartDetailModal.css'

const pad = (n) => String(n).padStart(2, '0')

const formatTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DetailTooltip = ({ active, payload, label, unit, nameKey }) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">
        {nameKey === 'time' ? formatTime(label) : label}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="chart-tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          {unit ? ` ${unit}` : ''}
        </p>
      ))}
    </div>
  )
}

const SummaryItem = ({ label, value }) => (
  <div className="chart-detail-summary-item">
    <span className="chart-detail-summary-label">{label}</span>
    <span className="chart-detail-summary-value">{value}</span>
  </div>
)

const DetailContent = ({ chart }) => {
  const { type, title, unit, color, data } = chart

  const summary = useMemo(() => {
    if (type === 'bar') {
      const list = Array.isArray(data) ? data : []
      const total = list.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
      const top = list.reduce(
        (best, item) => ((Number(item.value) || 0) > (Number(best?.value) || 0) ? item : best),
        null
      )
      return [
        { label: '指标种类', value: list.length },
        { label: '记录总数', value: total },
        { label: '占比最高', value: top ? `${top.label}（${top.value}）` : '-' }
      ]
    }

    const values = (Array.isArray(data) ? data : [])
      .map(item => Number(item.value))
      .filter(v => Number.isFinite(v))

    if (values.length === 0) return []

    const sum = values.reduce((a, b) => a + b, 0)
    const first = data[0]?.time
    const last = data[data.length - 1]?.time

    return [
      { label: '数据点数', value: values.length },
      {
        label: '平均值',
        value: `${(sum / values.length).toFixed(2)}${unit ? ` ${unit}` : ''}`
      },
      {
        label: '最小值',
        value: `${Math.min(...values).toFixed(2)}${unit ? ` ${unit}` : ''}`
      },
      {
        label: '最大值',
        value: `${Math.max(...values).toFixed(2)}${unit ? ` ${unit}` : ''}`
      },
      { label: '时间范围', value: `${formatTime(first)} ~ ${formatTime(last)}` }
    ]
  }, [type, data, unit])

  const hasData = Array.isArray(data) && data.length > 0

  return (
    <div className="chart-detail-body">
      {summary.length > 0 && (
        <div className="chart-detail-summary">
          {summary.map(item => (
            <SummaryItem key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      )}

      {!hasData ? (
        <p className="no-data">暂无可展示的数据</p>
      ) : (
        <div className="chart-detail-canvas">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart data={data} margin={{ top: 18, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light, #e5e7eb)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #9ca3af)' }}
                  axisLine={{ stroke: 'var(--border-light, #e5e7eb)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #9ca3af)' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={<DetailTooltip unit={unit} nameKey="label" />}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="value" name={title} radius={[4, 4, 0, 0]} maxBarSize={72}>
                  {data.map(item => (
                    <Cell key={item.key} fill={item.color || color} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    fontSize={11}
                    fill="var(--text-muted, #9ca3af)"
                  />
                </Bar>
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartDetailFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #e5e7eb)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #9ca3af)' }}
                  axisLine={{ stroke: 'var(--border-light, #e5e7eb)' }}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #9ca3af)' }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<DetailTooltip unit={unit} nameKey="time" />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#chartDetailFill)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  name={title}
                />
                <Brush
                  dataKey="time"
                  height={26}
                  travellerWidth={8}
                  stroke={color}
                  tickFormatter={formatTime}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {type !== 'bar' && hasData && (
        <p className="chart-detail-hint">拖动下方滑块可缩放时间区间，双击滑块区域可恢复完整范围。</p>
      )}
    </div>
  )
}

const ChartDetailModal = ({ chart, onClose }) => (
  <Modal
    isOpen={Boolean(chart)}
    onClose={onClose}
    title={chart ? `${chart.title} · 详细视图` : ''}
    size="large"
    className="chart-detail-modal"
  >
    {chart && <DetailContent chart={chart} />}
  </Modal>
)

export default ChartDetailModal
