import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/auth/useAuth'
import { rawDataService } from '../../../services/rawDataService'
import { deviceService } from '../../../services/deviceService'
import { fieldService } from '../../../services/fieldService'
import DataDetailModal from './DataDetailModal'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './DataView.css'

const DataView = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [fields, setFields] = useState([])
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    device: 'all',
    field: 'all',
    dataType: 'all',
    page: 1,
    pageSize: 20
  })

  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0
  })
  
  // 模态框状态
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDataId, setSelectedDataId] = useState(null)

  // 获取设备列表
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devicesData = await deviceService.getDevices({ owner_id: user?.id })
        setDevices(devicesData.data || [])
      } catch (err) {
        console.error('获取设备列表失败:', err)
      }
    }
    
    if (user?.id) {
      fetchDevices()
    }
  }, [user?.id])

  // 获取地块列表
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const fieldsData = await fieldService.getFields({ owner_id: user?.id })
        setFields(fieldsData.data || [])
      } catch (err) {
        console.error('获取地块列表失败:', err)
      }
    }
    
    if (user?.id) {
      fetchFields()
    }
  }, [user?.id])

  // 获取数据列表
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return
      
      setLoading(true)
      setError(null)
      
      try {
        const params = {
          user_id: user.id,
          page: filters.page,
          page_size: filters.pageSize,
          start_time: filters.startDate || undefined,
          end_time: filters.endDate || undefined,
          device_id: filters.device !== 'all' ? filters.device : undefined,
          field_id: filters.field !== 'all' ? filters.field : undefined,
          data_type: filters.dataType !== 'all' ? filters.dataType : undefined
        }
        
        const response = await rawDataService.getRawDataList(params)
        
        if (response.code === 200) {
          setData(response.data.items || [])
          setPagination(response.data.pagination || pagination)
        } else {
          setError(response.message || '获取数据失败')
        }
      } catch (err) {
        setError('获取数据失败，请稍后再试')
        console.error('获取数据列表失败:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [user?.id, filters.page, filters.pageSize])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value,
      // 重置页码
      page: name === 'page' ? value : 1
    }))
  }

  const handleSearch = () => {
    // 重置到第一页并重新获取数据
    setFilters(prev => ({
      ...prev,
      page: 1
    }))
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
        // 重新加载数据
        setFilters(prev => ({ ...prev, page: 1 }))
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

  // 处理分页
  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }))
  }

  // 处理查看详情
  const handleViewDetail = (id) => {
    setSelectedDataId(id)
    setIsModalOpen(true)
  }

  // 关闭模态框
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedDataId(null)
  }

  return (
    <div className="dashboard-data-view">
      <div className="dashboard-header">
        <h1>数据查看</h1>
        <button className="primary-btn" onClick={handleExport} disabled={loading}>导出数据</button>
      </div>
      
      <div className="filter-section">
        <div className="filter-group">
          <label>开始日期</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="filter-group">
          <label>结束日期</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="filter-group">
          <label>设备</label>
          <select
            name="device"
            value={filters.device}
            onChange={handleFilterChange}
          >
            <option value="all">全部设备</option>
            {devices.map(device => (
              <option key={device.id} value={device.id}>
                {device.model || `${device.device_type}-${device.id.substring(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>地块</label>
          <select
            name="field"
            value={filters.field}
            onChange={handleFilterChange}
          >
            <option value="all">全部地块</option>
            {fields.map(field => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>数据类型</label>
          <select
            name="dataType"
            value={filters.dataType}
            onChange={handleFilterChange}
          >
            <option value="all">全部类型</option>
            <option value="temperature">温度</option>
            <option value="humidity">湿度</option>
            <option value="soil_ph">土壤pH</option>
            <option value="light">光照</option>
            <option value="image">图像</option>
            <option value="ndvi">NDVI</option>
          </select>
        </div>
        
        <button className="secondary-btn" onClick={handleSearch} disabled={loading}>查询</button>
      </div>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      
      <div className="data-table-container">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <>
            {data.length > 0 ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>时间戳</th>
                      <th>设备名称</th>
                      <th>设备类型</th>
                      <th>位置</th>
                      <th>数据类型</th>
                      <th>数值</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(item => (
                      <tr key={item.id}>
                        <td>{formatDate(item.capture_time || item.created_at)}</td>
                        <td>{item.device_display_name || item.device_id?.substring(0, 8)}</td>
                        <td>{item.device_type}</td>
                        <td>{item.field_display_name || item.field_id?.substring(0, 8)}</td>
                        <td>{item.data_type}</td>
                        <td>{item.data_value} {item.data_unit || ''}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="secondary-btn" 
                              onClick={() => handleViewDetail(item.id)}
                            >
                              详情
                            </button>
                            <button 
                              className="danger-btn" 
                              onClick={() => handleDelete(item.id)}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* 分页控件 */}
                {pagination.totalPages > 1 && (
                  <div className="pagination">
                    <button 
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="secondary-btn"
                    >
                      上一页
                    </button>
                    <span className="page-info">
                      第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条记录
                    </span>
                    <button 
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="secondary-btn"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">暂无数据</div>
            )}
          </>
        )}
      </div>
    
      {/* 数据详情模态框 */}
      <DataDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        rawDataId={selectedDataId}
        userId={user?.id}
      />
    </div>
  )
}

export default DataView