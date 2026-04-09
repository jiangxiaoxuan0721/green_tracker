import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/auth/useAuth'
import { rawDataService } from '@/services/rawDataService'
import { collectionSessionService } from '@/services/collectionSessionService'
import { Button } from '@/components/ui'
import { DataTable, FilterPanel, FilterSelect } from '@/components/business'
import ImageThumbnail from '@/components/ui/ImageThumbnail'
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
  const [exporting, setExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // 翻译映射：将英文value翻译为中文label
  const dataTypeTranslations = {
    'image': '图像',
    'video': '视频',
    'environmental': '环境数据',
    'soil': '土壤数据',
    'spectral': '光谱数据',
    'multispectral': '多光谱数据',
    'thermal': '热成像数据'
  }

  const dataSubtypeTranslations = {
    'rgb': 'RGB图像',
    'nir': '近红外图像',
    'red_edge': '红边图像',
    'multispectral': '多光谱图像',
    'thermal': '热成像',
    'video': '视频',
    'temperature': '温度',
    'humidity': '湿度',
    'pressure': '气压',
    'wind_speed': '风速',
    'co2': 'CO2浓度',
    'light': '光照强度',
    'ph': 'pH值',
    'moisture': '土壤湿度',
    'ec': '电导率',
    'temperature_soil': '土壤温度',
    'nutrients': '土壤养分',
    'ndvi': 'NDVI',
    'evi': 'EVI',
    'ndre': 'NDRE',
    'blue': '蓝光波段',
    'green': '绿光波段',
    'red': '红光波段',
    'thermal_image': '热成像'
  }

  // 翻译数据类型标签
  const translateDataType = (type) => {
    return dataTypeTranslations[type] || type
  }

  // 翻译数据子类型标签
  const translateDataSubtype = (subtype) => {
    return dataSubtypeTranslations[subtype] || subtype
  }

  const getDefaultDataTypes = () => [
    { value: 'image', label: translateDataType('image') },
    { value: 'video', label: translateDataType('video') },
    { value: 'environmental', label: translateDataType('environmental') },
    { value: 'soil', label: translateDataType('soil') },
    { value: 'spectral', label: translateDataType('spectral') },
    { value: 'multispectral', label: translateDataType('multispectral') },
    { value: 'thermal', label: translateDataType('thermal') }
  ]

  const getDefaultDataSubtypes = (dataType) => {
    const subtypes = {
      image: ['rgb', 'nir', 'red_edge'],
      video: ['rgb', 'thermal'],
      environmental: ['temperature', 'humidity', 'pressure', 'wind_speed'],
      soil: ['ph', 'moisture', 'temperature', 'nutrients'],
      spectral: ['ndvi', 'evi', 'ndre'],
      multispectral: ['blue', 'green', 'red', 'nir', 'red_edge'],
      thermal: ['temperature', 'thermal_image']
    }
    
    const subtypeValues = dataType ? (subtypes[dataType] || []) : []
    return subtypeValues.map(value => ({
      value: value,
      label: translateDataSubtype(value)
    }))
  }

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

  // 当选择任务时，获取该任务的数据类型选项
  useEffect(() => {
    const fetchSessionDataTypes = async () => {
      if (!filters.sessionId || filters.sessionId === 'all') {
        setAvailableDataTypes(getDefaultDataTypes())
        return
      }

      try {
        const response = await rawDataService.getSessionDataTypes(filters.sessionId)
        // 翻译API返回的数据类型
        const translatedDataTypes = (response.data?.dataTypes || getDefaultDataTypes()).map(item => ({
          value: item.value,
          label: translateDataType(item.value)
        }))
        
        setAvailableDataTypes(translatedDataTypes)
        // 注意：子类型现在由数据类型的useEffect处理
      } catch (err) {
        console.error('获取任务数据类型失败:', err)
        setAvailableDataTypes(getDefaultDataTypes())
      }
    }

    fetchSessionDataTypes()
  }, [filters.sessionId])

  // 当数据类型变化时，重新获取子类型选项
  useEffect(() => {
    // 如果数据类型为"全部"或未选择，清空子类型
    if (!filters.dataType || filters.dataType === 'all') {
      setAvailableDataSubtypes([])
      return
    }

    // 总是先设置默认子类型
    let defaultSubtypes = getDefaultDataSubtypes(filters.dataType)
    
    // 如果选择了具体任务，异步获取任务中的实际子类型并合并
    if (filters.sessionId && filters.sessionId !== 'all') {
      const fetchActualSubtypes = async () => {
        try {
          const response = await rawDataService.getSessionDataTypes(filters.sessionId, filters.dataType)
          const actualSubtypes = (response.data?.dataSubtypes || []).map(item => {
            const value = typeof item === 'string' ? item : (item.value || item)
            return {
              value: value,
              label: translateDataSubtype(value)
            }
          })
          
          // 合并默认和实际子类型，去重
          const allSubtypes = [...defaultSubtypes]
          actualSubtypes.forEach(actual => {
            if (!allSubtypes.some(d => d.value === actual.value)) {
              allSubtypes.push(actual)
            }
          })
          
          setAvailableDataSubtypes(allSubtypes)
        } catch (err) {
          console.error('获取任务子类型失败:', err)
          // 失败时保持默认子类型
          setAvailableDataSubtypes(defaultSubtypes)
        }
      }
      
      fetchActualSubtypes()
    } else {
      // 没有选择任务时，直接显示默认子类型
      setAvailableDataSubtypes(defaultSubtypes)
    }
  }, [filters.dataType, filters.sessionId])

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
        setTotal(response.data.pagination?.total_count || response.data.total || 0)
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

  // 监听filters变化，自动获取数据
  useEffect(() => {
    if (user?.id) {
      fetchData(1)
    }
  }, [filters, user?.id])

  const handleFilterChange = (newFilters) => {
    setCurrentPage(1)
    
    // 使用函数式更新确保基于最新状态计算
    setFilters(prev => {
      let updatedFilters = { ...prev, ...newFilters }
      
      // 如果改变了任务ID，重置数据类型和子类型
      if (newFilters.sessionId && newFilters.sessionId !== prev.sessionId) {
        updatedFilters = {
          ...updatedFilters,
          dataType: 'all',
          dataSubtype: 'all'
        }
      }
      
      // 如果改变了数据类型，重置子类型
      if (newFilters.dataType && newFilters.dataType !== prev.dataType) {
        updatedFilters = {
          ...updatedFilters,
          dataSubtype: 'all'
        }
      }
      
      return updatedFilters
    })
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    fetchData(newPage)
  }

  const handleExport = async (format) => {
    if (!user?.id) return

    setExporting(true)
    setShowExportMenu(false)

    try {
      await rawDataService.exportRawData({
        user_id: user.id,
        session_id: filters.sessionId !== 'all' ? filters.sessionId : undefined,
        data_type: filters.dataType !== 'all' ? filters.dataType : undefined,
        data_subtype: filters.dataSubtype !== 'all' ? filters.dataSubtype : undefined,
        format
      })
    } catch (err) {
      console.error('导出数据失败:', err)
      alert(`导出失败: ${err.message || '请稍后再试'}`)
    } finally {
      setExporting(false)
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
      render: (id) => id ? `${id.slice(0, 6)}...` : '-',
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
      title: '数据值',
      dataIndex: 'data_value',
      render: (value, record) => {
        // 如果是图像类型或文件类型，显示文字链接
        if (record.data_type === 'image' || record.data_type === 'file') {
          return (
            <ImageThumbnail 
              record={record}
              userId={user?.id}
            />
          )
        }

        // 非图像/文件类型的普通显示
        return value || '-'
      }
    },
    {
      title: '数据格式',
      dataIndex: 'data_format'
    },
    {
      title: '质量评分',
      dataIndex: 'quality_score',
      render: (score) => score ? `${(score * 100).toFixed(1)}%` : '-'
    }
  ]

  return (
    <div className="dashboard-data-view">
      <div className="dashboard-header">
        <h1>数据查看</h1>
        <div className="export-wrapper">
          <Button
            variant="primary"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={loading || exporting}
          >
            {exporting ? '导出中...' : '导出数据 ▼'}
          </Button>
          {showExportMenu && (
            <div className="export-menu">
              <div className="export-menu-item" onClick={() => handleExport('csv')}>
                <span className="export-icon">📊</span>
                <div className="export-info">
                  <span className="export-title">CSV 表格</span>
                  <span className="export-desc">适合Excel分析，包含所有数值数据</span>
                </div>
              </div>
              <div className="export-menu-item" onClick={() => handleExport('json')}>
                <span className="export-icon">📋</span>
                <div className="export-info">
                  <span className="export-title">JSON 数据</span>
                  <span className="export-desc">完整数据格式，包含元数据</span>
                </div>
              </div>
              <div className="export-menu-item" onClick={() => handleExport('zip')}>
                <span className="export-icon">📦</span>
                <div className="export-info">
                  <span className="export-title">ZIP 压缩包</span>
                  <span className="export-desc">图片/视频文件 + CSV元数据</span>
                </div>
              </div>
            </div>
          )}
        </div>
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
          disabled={!filters.dataType || filters.dataType === 'all'}
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
