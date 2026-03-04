import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/auth/useAuth'
import { rawDataService } from '@/services/rawDataService'
import { collectionSessionService } from '@/services/collectionSessionService'
import { Button } from '@/components/ui'
import { DataTable, FilterPanel, FilterSelect } from '@/components/business'
import './DataView.css'

const DataView = () => {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [availableDataTypes, setAvailableDataTypes] = useState([])
  const [availableDataSubtypes, setAvailableDataSubtypes] = useState([])
  
  const [filters, setFilters] = useState({
    sessionId: 'all',
    dataType: 'all',
    dataSubtype: 'all'
  })
  
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionsData = await collectionSessionService.getSessions({
          limit: 100
        })
        setSessions(sessionsData || [])
      } catch (err) {
        console.error('获取采集任务列表失败:', err)
      }
    }

    if (user?.id) {
      fetchSessions()
    }
  }, [user?.id])

  // 当选择任务时，获取该任务的数据类型和子类型选项
  useEffect(() => {
    const fetchSessionDataTypes = async () => {
      if (!filters.sessionId || filters.sessionId === 'all') {
        setAvailableDataTypes(getDefaultDataTypes())
        setAvailableDataSubtypes([])
        return
      }

      try {
        const response = await rawDataService.getSessionDataTypes(filters.sessionId)
        setAvailableDataTypes(response.data?.dataTypes || getDefaultDataTypes())
        setAvailableDataSubtypes(response.data?.dataSubtypes || [])
      } catch (err) {
        console.error('获取任务数据类型失败:', err)
        setAvailableDataTypes(getDefaultDataTypes())
        setAvailableDataSubtypes([])
      }
    }

    fetchSessionDataTypes()
  }, [filters.sessionId])

  // 当数据类型变化时，重新获取子类型选项
  useEffect(() => {
    const fetchSessionSubtypes = async () => {
      // 如果没有选择任务或数据类型为"全部"
      if (!filters.sessionId || filters.sessionId === 'all') {
        if (!filters.dataType || filters.dataType === 'all') {
          setAvailableDataSubtypes([])
        } else {
          // 显示默认的子类型选项
          setAvailableDataSubtypes(getDefaultDataSubtypes(filters.dataType))
        }
        return
      }

      // 如果数据类型为"全部"，获取该任务的所有子类型
      if (!filters.dataType || filters.dataType === 'all') {
        try {
          const response = await rawDataService.getSessionDataTypes(filters.sessionId)
          setAvailableDataSubtypes(response.data?.dataSubtypes || [])
        } catch (err) {
          console.error('获取任务子类型失败:', err)
          setAvailableDataSubtypes([])
        }
        return
      }

      // 获取指定数据类型的子类型
      try {
        const response = await rawDataService.getSessionDataTypes(filters.sessionId, filters.dataType)
        setAvailableDataSubtypes(response.data?.dataSubtypes || getDefaultDataSubtypes(filters.dataType))
      } catch (err) {
        console.error('获取任务子类型失败:', err)
        setAvailableDataSubtypes(getDefaultDataSubtypes(filters.dataType))
      }
    }

    fetchSessionSubtypes()
  }, [filters.sessionId, filters.dataType])

  const getDefaultDataTypes = () => [
    { value: 'image', label: '图像' },
    { value: 'video', label: '视频' },
    { value: 'environmental', label: '环境数据' },
    { value: 'soil', label: '土壤数据' },
    { value: 'spectral', label: '光谱数据' },
    { value: 'multispectral', label: '多光谱数据' },
    { value: 'thermal', label: '热成像数据' }
  ]

  const getDefaultDataSubtypes = (dataType) => {
    const subtypes = {
      image: [
        { value: 'rgb', label: 'RGB图像' },
        { value: 'nir', label: '近红外图像' },
        { value: 'red_edge', label: '红边图像' }
      ],
      video: [
        { value: 'rgb', label: 'RGB视频' },
        { value: 'thermal', label: '热成像视频' }
      ],
      environmental: [
        { value: 'temperature', label: '温度' },
        { value: 'humidity', label: '湿度' },
        { value: 'pressure', label: '气压' },
        { value: 'wind_speed', label: '风速' }
      ],
      soil: [
        { value: 'ph', label: 'pH值' },
        { value: 'moisture', label: '土壤湿度' },
        { value: 'temperature', label: '土壤温度' },
        { value: 'nutrients', label: '土壤养分' }
      ],
      spectral: [
        { value: 'ndvi', label: 'NDVI' },
        { value: 'evi', label: 'EVI' },
        { value: 'ndre', label: 'NDRE' }
      ],
      multispectral: [
        { value: 'blue', label: '蓝光波段' },
        { value: 'green', label: '绿光波段' },
        { value: 'red', label: '红光波段' },
        { value: 'nir', label: '近红外波段' },
        { value: 'red_edge', label: '红边波段' }
      ],
      thermal: [
        { value: 'temperature', label: '温度' },
        { value: 'thermal_image', label: '热成像' }
      ]
    }
    
    return dataType ? (subtypes[dataType] || []) : []
  }

  

  const fetchData = async (page = currentPage) => {
    if (!user?.id) return

    setLoading(true)
    
    try {
      const params = {
        page,
        page_size: 20,
        session_id: filters.sessionId !== 'all' ? filters.sessionId : undefined,
        data_type: filters.dataType !== 'all' ? filters.dataType : undefined,
        data_subtype: filters.dataSubtype !== 'all' ? filters.dataSubtype : undefined,
        user_id: user.id
      }
      
      const response = await rawDataService.getRawDataList(params)
      
      if (response.code === 200) {
        setData(response.data.items || [])
        setTotal(response.data.pagination?.total || response.data.total || 0)
      }
    } catch (err) {
      console.error('获取数据列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(1)
  }, [user?.id])

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
    
    // 如果改变了任务ID，重置数据类型和子类型
    if (newFilters.sessionId && newFilters.sessionId !== filters.sessionId) {
      setFilters(prev => ({ 
        ...prev, 
        ...newFilters,
        dataType: 'all',
        dataSubtype: 'all'
      }))
    }
    
    // 如果改变了数据类型，重置子类型
    if (newFilters.dataType && newFilters.dataType !== filters.dataType) {
      setFilters(prev => ({ 
        ...prev, 
        ...newFilters,
        dataSubtype: 'all'
      }))
    }
    
    fetchData(1)
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    fetchData(newPage)
  }

  const handleExport = async () => {
    if (!user?.id) return
    
    try {
      await rawDataService.exportRawData({
        user_id: user.id,
        session_id: filters.sessionId !== 'all' ? filters.sessionId : undefined,
        data_type: filters.dataType !== 'all' ? filters.dataType : undefined,
        data_subtype: filters.dataSubtype !== 'all' ? filters.dataSubtype : undefined,
        format: 'csv'
      })
    } catch (err) {
      console.error('导出数据失败:', err)
      alert('导出失败，请稍后再试')
    }
  }

  const handleDelete = async (id) => {
    if (!user?.id) return
    
    if (window.confirm('确定要删除这条数据吗？此操作不可撤销。')) {
      try {
        await rawDataService.deleteRawData(id, user.id)
        fetchData(currentPage)
      } catch (err) {
        console.error('删除数据失败:', err)
        alert('删除失败，请稍后再试')
      }
    }
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  }

  const sessionOptions = [
    { value: 'all', label: '全部任务' },
    ...sessions.map(s => ({ 
      value: s.id, 
      label: s.mission_name || s.mission_type || '未知任务'
    }))
  ]

  const dataTypeOptions = [
    { value: 'all', label: '全部类型' },
    ...availableDataTypes
  ]

  const dataSubtypeOptions = [
    { value: 'all', label: '全部子类型' },
    ...availableDataSubtypes
  ]

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      style: { width: '80px' }
    },
    {
      title: '采集时间',
      dataIndex: 'capture_time',
      render: (timestamp) => formatDate(timestamp)
    },
    {
      title: '任务名称',
      dataIndex: ['session', 'mission_name'],
      render: (_, record) => record.session?.mission_name || record.session?.mission_type || '未知任务'
    },
    {
      title: '数据类型',
      dataIndex: 'data_type',
      render: (type, record) => `${type}${record.data_subtype ? `/${record.data_subtype}` : ''}`
    },
    {
      title: '数据格式',
      dataIndex: 'data_format'
    },
    {
      title: '质量评分',
      dataIndex: 'quality_score',
      render: (score) => score ? `${(score * 100).toFixed(1)}%` : '-'
    },
    {
      title: '操作',
      render: (_, record) => (
        <Button size="small" variant="danger" onClick={() => handleDelete(record.id)}>
          删除
        </Button>
      )
    }
  ]

  return (
    <div className="dashboard-data-view">
      <div className="dashboard-header">
        <h1>数据查看</h1>
        <Button variant="primary" onClick={handleExport} disabled={loading}>
          导出数据
        </Button>
      </div>

      <FilterPanel>
        <FilterSelect
          label="采集任务"
          name="sessionId"
          value={filters.sessionId}
          onChange={(e) => handleFilterChange({ sessionId: e.target.value })}
          options={sessionOptions}
        />
        <FilterSelect
          label="数据类型"
          name="dataType"
          value={filters.dataType}
          onChange={(e) => handleFilterChange({ dataType: e.target.value })}
          options={dataTypeOptions}
        />
        <FilterSelect
          label="数据子类型"
          name="dataSubtype"
          value={filters.dataSubtype}
          onChange={(e) => handleFilterChange({ dataSubtype: e.target.value })}
          options={dataSubtypeOptions}
          disabled={!filters.sessionId || filters.sessionId === 'all'}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="暂无数据"
        pagination={{
          total,
          currentPage,
          pageSize: 20,
          onPageChange: handlePageChange
        }}
      />

    </div>
  )
}

export default DataView
