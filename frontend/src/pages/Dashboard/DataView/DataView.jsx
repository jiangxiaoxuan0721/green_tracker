import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/auth/useAuth'
import { rawDataService } from '@/services/rawDataService'
import { deviceService } from '@/services/deviceService'
import { fieldService } from '@/services/fieldService'
import { Button, Card } from '@/components/ui'
import { DataTable, FilterPanel, FilterInput, FilterSelect, StatusBadge } from '@/components/business'
import './DataView.css'

const DataView = () => {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [fields, setFields] = useState([])
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    device: 'all',
    field: 'all',
    dataType: 'all'
  })
  
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devicesData = await deviceService.getDevices({ owner_id: user?.id })
        setDevices(devicesData.data || devicesData || [])
      } catch (err) {
        console.error('获取设备列表失败:', err)
      }
    }
    
    const fetchFields = async () => {
      try {
        const fieldsData = await fieldService.getFields({ owner_id: user?.id })
        setFields(fieldsData.data || fieldsData || [])
      } catch (err) {
        console.error('获取地块列表失败:', err)
      }
    }
    
    if (user?.id) {
      fetchDevices()
      fetchFields()
    }
  }, [user?.id])

  const fetchData = async (page = currentPage) => {
    if (!user?.id) return

    setLoading(true)
    setError(null)
    
    try {
      const params = {
        user_id: user.id,
        page,
        page_size: 20,
        start_time: filters.startDate || undefined,
        end_time: filters.endDate || undefined,
        device_id: filters.device !== 'all' ? filters.device : undefined,
        field_id: filters.field !== 'all' ? filters.field : undefined,
        data_type: filters.dataType !== 'all' ? filters.dataType : undefined
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
        start_time: filters.startDate || undefined,
        end_time: filters.endDate || undefined,
        device_id: filters.device !== 'all' ? filters.device : undefined,
        field_id: filters.field !== 'all' ? filters.field : undefined,
        data_type: filters.dataType !== 'all' ? filters.dataType : undefined,
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

  const deviceOptions = [
    { value: 'all', label: '全部设备' },
    ...devices.map(d => ({ value: d.id, label: d.device_name || d.name }))
  ]

  const fieldOptions = [
    { value: 'all', label: '全部地块' },
    ...fields.map(f => ({ value: f.id, label: f.field_name || f.name }))
  ]

  const dataTypeOptions = [
    { value: 'all', label: '全部类型' },
    { value: 'image', label: '图像' },
    { value: 'sensor', label: '传感器数据' },
    { value: 'gps', label: 'GPS数据' }
  ]

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      style: { width: '80px' }
    },
    {
      title: '采集时间',
      dataIndex: 'timestamp',
      render: (timestamp) => formatDate(timestamp)
    },
    {
      title: '设备',
      dataIndex: 'device_name'
    },
    {
      title: '地块',
      dataIndex: 'field_name'
    },
    {
      title: '数据类型',
      dataIndex: 'data_type'
    },
    {
      title: '状态',
      dataIndex: 'processing_status',
      render: (status) => <StatusBadge status={status} />
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
        <FilterInput
          label="开始日期"
          name="startDate"
          type="date"
          value={filters.startDate}
          onChange={(e) => handleFilterChange({ startDate: e.target.value })}
        />
        <FilterInput
          label="结束日期"
          name="endDate"
          type="date"
          value={filters.endDate}
          onChange={(e) => handleFilterChange({ endDate: e.target.value })}
        />
        <FilterSelect
          label="设备"
          name="device"
          value={filters.device}
          onChange={(e) => handleFilterChange({ device: e.target.value })}
          options={deviceOptions}
        />
        <FilterSelect
          label="地块"
          name="field"
          value={filters.field}
          onChange={(e) => handleFilterChange({ field: e.target.value })}
          options={fieldOptions}
        />
        <FilterSelect
          label="数据类型"
          name="dataType"
          value={filters.dataType}
          onChange={(e) => handleFilterChange({ dataType: e.target.value })}
          options={dataTypeOptions}
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
