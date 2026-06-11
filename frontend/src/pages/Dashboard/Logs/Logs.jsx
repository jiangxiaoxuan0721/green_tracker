import { useState, useEffect, useCallback } from 'react'
import { FileText, Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import logService from '@/services/logService'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const PAGE_SIZE = 20

const levelTextMap = {
  error: '错误',
  warning: '警告',
  info: '信息',
  success: '成功',
}

const levelClassMap = {
  error: 'log-error',
  warning: 'log-warning',
  info: 'log-info',
  success: 'log-success',
}

const Logs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [filter, setFilter] = useState({
    level: 'all',
    source: 'all',
    dateFrom: '',
    dateTo: '',
  })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        level: filter.level !== 'all' ? filter.level : undefined,
        source: filter.source !== 'all' ? filter.source : undefined,
        date_from: filter.dateFrom || undefined,
        date_to: filter.dateTo || undefined,
      }
      const result = await logService.getLogs(params)
      setLogs(result.items)
      setTotal(result.total)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setError('加载日志失败，请检查后端服务是否运行')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [filter])

  const handleFilterChange = (field, value) => {
    setFilter(prev => ({ ...prev, [field]: value }))
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await logService.exportLogs({
        level: filter.level !== 'all' ? filter.level : undefined,
        date_from: filter.dateFrom || undefined,
        date_to: filter.dateTo || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `system_logs_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="dashboard-logs">
      <PageHeader
        icon={FileText}
        title="日志查看"
        description="查看系统操作日志，追踪设备状态和任务执行记录"
        actions={
          <Button
            variant="primary"
            icon={Download}
            onClick={handleExport}
            loading={exporting}
            disabled={loading || logs.length === 0}
          >
            导出日志
          </Button>
        }
      />

      <div className="log-filters">
        <div className="filter-group">
          <label>日志级别</label>
          <select
            value={filter.level}
            onChange={(e) => handleFilterChange('level', e.target.value)}
          >
            <option value="all">全部级别</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
            <option value="success">成功</option>
          </select>
        </div>

        <div className="filter-group">
          <label>来源</label>
          <input
            type="text"
            value={filter.source === 'all' ? '' : filter.source}
            onChange={(e) => handleFilterChange('source', e.target.value || 'all')}
            placeholder="输入来源关键词"
          />
        </div>

        <div className="filter-group">
          <label>开始日期</label>
          <input
            type="date"
            value={filter.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>结束日期</label>
          <input
            type="date"
            value={filter.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="log-empty-state">
          <AlertCircle size={40} strokeWidth={1.5} />
          <p>{error}</p>
        </div>
      )}

      {!error && (
        <div className="log-container">
          <div className="log-table">
            <div className="log-header">
              <div className="log-cell">时间</div>
              <div className="log-cell">级别</div>
              <div className="log-cell">来源</div>
              <div className="log-cell">消息</div>
            </div>

            {loading ? (
              <div className="log-empty-state">
                <p>加载中...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="log-empty-state">
                <FileText size={40} strokeWidth={1} />
                <p>暂无日志记录</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="log-row">
                  <div className="log-cell">{log.timestamp}</div>
                  <div className={`log-cell ${levelClassMap[log.level] || ''}`}>
                    {levelTextMap[log.level] || log.level}
                  </div>
                  <div className="log-cell">{log.source}</div>
                  <div className="log-cell">{log.message}</div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="log-pagination">
              <Button
                variant="outline"
                size="small"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                icon={ChevronLeft}
              >
                上一页
              </Button>
              <span className="log-page-info">
                第 {page} / {totalPages} 页，共 {total} 条
              </span>
              <Button
                variant="outline"
                size="small"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                icon={ChevronRight}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Logs
