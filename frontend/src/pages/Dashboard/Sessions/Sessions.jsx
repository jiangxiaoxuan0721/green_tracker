import { useState, useEffect, useCallback } from 'react'
import { collectionSessionService } from '@/services/collectionSessionService'
import { fieldService } from '@/services/fieldService'
import { Button, Card } from '@/components/ui'
import { DataTable, FilterPanel, FilterSelect, StatusBadge } from '@/components/business'
import { useModal } from '@/hooks/common'
import { SessionDetail, SessionForm } from './components'
import './Sessions.css'

const Sessions = () => {
  const [sessions, setSessions] = useState([])
  const [fields, setFields] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
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
      const params = {
        page,
        page_size: pageSize
      }
      if (filterParams.status) params.status = filterParams.status
      if (filterParams.field) params.field_id = filterParams.field
      if (filterParams.missionType) params.mission_types = filterParams.missionType

      const response = await collectionSessionService.getSessions(params)
      setSessions(response.data || response.items || response)
      setTotal(response.total || response.count || (Array.isArray(response) ? response.length : 0))
      setCurrentPage(page)
      setError(null)
    } catch (err) {
      console.error('获取采集任务失败:', err)
      setError('获取采集任务失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setInitialLoading(false)
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

  useEffect(() => {
    if (!initialLoading) {
      debouncedFetchSessions(1, filters)
    }
  }, [filters.status, filters.field, filters.missionType, initialLoading])

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
      <div className="dashboard-header">
        <h1>任务管理</h1>
        <Button variant="primary" onClick={openCreate}>创建任务</Button>
      </div>

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
