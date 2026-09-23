import { useState, useEffect, useCallback, useRef } from 'react'
import { collectionSessionService } from '@/services/collectionSessionService'
import { fieldService } from '@/services/fieldService'
import { Button, Card, PageHeader } from '@/components/ui'
import { DataTable, FilterPanel, FilterSelect, StatusBadge } from '@/components/business'
import { useModal } from '@/hooks/common'
import { ListTodo, Plus } from 'lucide-react'
import { SessionDetail, SessionForm } from './components'
import './Sessions.css'
import '../AdditionalStyles.css'

const Sessions = () => {
  const [sessions, setSessions] = useState([])
  const [fields, setFields] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  // 筛选条件变更后、结果返回前的查询态，用于与「查无数据」区分
  const [querying, setQuerying] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const [filters, setFilters] = useState({
    status: '',
    field: '',
    missionType: ''
  })

  const { isOpen: isCreateOpen, openModal: openCreate, closeModal: closeCreate } = useModal()
  const { isOpen: isDetailOpen, modalData: selectedSession, openModal: openDetail, closeModal: closeDetail } = useModal()
  const { isOpen: isEditOpen, modalData: editSession, openModal: openEdit, closeModal: closeEdit } = useModal()

  // 防抖函数
  const debounce = (func, wait) => {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  const fetchSessions = async (page = currentPage, filterParams = filters) => {
    try {
      // 后端接口使用 limit/offset 分页，这里由页码换算
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize
      }
      if (filterParams.status) params.status = filterParams.status
      if (filterParams.field) params.field_id = filterParams.field
      if (filterParams.missionType) params.mission_types = filterParams.missionType

      const { items, total } = await collectionSessionService.getSessionsWithPagination(params)

      // 分页生效后可能出现页码越界（例如删掉了某页最后一条），回退到上一页
      if (items.length === 0 && total > 0 && page > 1) {
        fetchSessions(page - 1, filterParams)
        return
      }

      setSessions(items)
      setTotal(total)
      setCurrentPage(page)
      setError(null)
    } catch (err) {
      console.error('获取采集任务失败:', err)
      setError('获取采集任务失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setInitialLoading(false)
      setQuerying(false)
    }
  }

  // 创建防抖版本的 fetchSessions
  const debouncedFetchSessions = useCallback(
    debounce(fetchSessions, 300),
    []
  )
  
  const fetchFields = async () => {
    try {
      const data = await fieldService.getFields()
      setFields(data)
    } catch (err) {
      console.error('获取农田列表失败:', err)
    }
  }
  
  useEffect(() => {
    fetchSessions(1)
    fetchFields()
  }, [])

  // 记录上一次已提交的筛选条件，避免首屏加载完成后重复请求
  const appliedFiltersRef = useRef(filters)

  useEffect(() => {
    if (initialLoading) return

    const prev = appliedFiltersRef.current
    const changed =
      prev.status !== filters.status ||
      prev.field !== filters.field ||
      prev.missionType !== filters.missionType

    if (!changed) return

    appliedFiltersRef.current = filters
    // 防抖等待期间同样保持查询态，避免用户看到上一次的结果或「暂无数据」
    setQuerying(true)
    debouncedFetchSessions(1, filters)
  }, [filters.status, filters.field, filters.missionType, initialLoading])

  // 保存最新的刷新上下文，供定时轮询使用（避免闭包拿到过期的页码/筛选条件）
  const refreshContextRef = useRef({ fetchSessions, currentPage, filters })
  refreshContextRef.current = { fetchSessions, currentPage, filters }

  // 定时刷新：后端会把超过结束时间的任务自动置为已完成，这里让列表及时同步
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const { fetchSessions: fetch, currentPage: page, filters: latestFilters } = refreshContextRef.current
      fetch(page, latestFilters)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const handlePageChange = (page) => {
    if (page >= 1) {
      fetchSessions(page, filters)
    }
  }

  const handleViewSession = async (sessionId) => {
    try {
      const session = await collectionSessionService.getSessionById(sessionId)
      openDetail(session)
    } catch (err) {
      console.error('获取任务详情失败:', err)
    }
  }

  const handleUpdateSessionStatus = async (sessionId, newStatus) => {
    try {
      const updateData = { status: newStatus }
      if (newStatus === 'completed') {
        updateData.end_time = new Date().toISOString()
      }

      await collectionSessionService.updateSession(sessionId, updateData)
      fetchSessions(currentPage, filters)
    } catch (err) {
      console.error('更新任务状态失败:', err)
    }
  }

  const handleEditSession = async (sessionOrId) => {
    if (typeof sessionOrId === 'object') {
      openEdit(sessionOrId)
    } else {
      try {
        const session = await collectionSessionService.getSessionById(sessionOrId)
        openEdit(session)
      } catch (err) {
        console.error('获取任务详情失败:', err)
      }
    }
  }

  const handleUpdateSessionAfterEdit = async () => {
    try {
      await fetchSessions(currentPage, filters)
      closeEdit()
      if (selectedSession) {
        const updatedSession = await collectionSessionService.getSessionById(selectedSession.id)
        openDetail(updatedSession)
      }
    } catch (err) {
      console.error('刷新任务列表失败:', err)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    if (window.confirm('确定要删除这个任务吗？此操作不可恢复。')) {
      try {
        await collectionSessionService.deleteSession(sessionId)
        fetchSessions(currentPage, filters)
        closeDetail()
      } catch (err) {
        console.error('删除任务失败:', err)
        // 删除失败要让用户看得见，否则界面毫无变化会被误认为后端无响应
        setError('删除任务失败: ' + (err.response?.data?.detail || err.message))
      }
    }
  }

  const handleCreateSession = async () => {
    try {
      await fetchSessions(1, filters)
      closeCreate()
    } catch (err) {
      console.error('创建任务失败:', err)
    }
  }

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '-'
    const date = new Date(dateTimeString)
    return date.toLocaleString('zh-CN')
  }

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'planned', label: '计划中' },
    { value: 'running', label: '运行中' },
    { value: 'completed', label: '已完成' },
    { value: 'failed', label: '失败' }
  ]

  const fieldOptions = [
    { value: '', label: '全部农田' },
    ...fields.map(f => ({ value: f.id, label: f.name }))
  ]

  const missionTypeOptions = [
    { value: '', label: '全部类型' },
    { value: '巡检', label: '巡检' },
    { value: '定点', label: '定点' },
    { value: '路径', label: '路径' },
    { value: '应急', label: '应急' }
  ]

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'mission_name',
      render: (val) => val || '-'
    },
    {
      title: '农田',
      dataIndex: 'field_name',
      render: (val) => val || '-'
    },
    {
      title: '任务类型',
      dataIndex: 'mission_type',
      render: (val) => val || '-'
    },
    {
      title: '执行设备',
      dataIndex: 'device_name',
      render: (val) => val || '所有设备'
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => <StatusBadge status={status} />
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      render: formatDateTime
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      render: formatDateTime
    },
    {
      title: '操作',
      render: (_, record) => (
        <>
          <Button size="small" variant="outline" onClick={() => handleViewSession(record.id)}>
            查看
          </Button>
          {record.status === 'planned' && (
            <Button size="small" variant="success" onClick={() => handleUpdateSessionStatus(record.id, 'running')}>
              开始
            </Button>
          )}
          {record.status === 'running' && (
            <Button size="small" variant="warning" onClick={() => handleUpdateSessionStatus(record.id, 'completed')}>
              完成
            </Button>
          )}
          <Button size="small" variant="danger" onClick={() => handleDeleteSession(record.id)}>
            删除
          </Button>
        </>
      )
    }
  ]

  return (
    <div className="dashboard-sessions">
      <PageHeader
        icon={ListTodo}
        title="任务管理"
        description="创建和管理采集任务，追踪任务执行状态"
        actions={
          <Button variant="primary" onClick={openCreate} icon={Plus}>
            创建任务
          </Button>
        }
      />

      <FilterPanel>
        <FilterSelect
          label="状态"
          name="status"
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          options={statusOptions}
        />
        <FilterSelect
          label="农田"
          name="field"
          value={filters.field}
          onChange={(e) => handleFilterChange('field', e.target.value)}
          options={fieldOptions}
        />
        <FilterSelect
          label="任务类型"
          name="missionType"
          value={filters.missionType}
          onChange={(e) => handleFilterChange('missionType', e.target.value)}
          options={missionTypeOptions}
        />
      </FilterPanel>

      {error && (
        <Card className="error-card">
          <p>{error}</p>
          <Button variant="ghost" onClick={() => setError(null)}>×</Button>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={sessions}
        loading={initialLoading}
        querying={querying}
        emptyMessage="暂无数据"
        pagination={{
          total,
          currentPage,
          pageSize,
          onPageChange: handlePageChange
        }}
      />

      {isCreateOpen && (
        <SessionForm
          mode="create"
          isOpen={true}
          onClose={closeCreate}
          onSuccess={handleCreateSession}
        />
      )}

      {isDetailOpen && selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={closeDetail}
          onEdit={handleEditSession}
          onUpdateStatus={handleUpdateSessionStatus}
        />
      )}

      {isEditOpen && editSession && (
        <SessionForm
          mode="edit"
          session={editSession}
          isOpen={true}
          onClose={closeEdit}
          onSuccess={handleUpdateSessionAfterEdit}
        />
      )}
    </div>
  )
}

export default Sessions
