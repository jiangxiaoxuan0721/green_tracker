import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/auth/useAuth'
import { rawDataService } from '../../../services/rawDataService'
import { fieldService } from '../../../services/fieldService'
import { deviceService } from '../../../services/deviceService'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './DataAnalyze.css'

const DataAnalyze = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState([])
  const [devices, setDevices] = useState([])
  const [rawData, setRawData] = useState([])
  
  const [analysisType, setAnalysisType] = useState('trend')
  const [timeRange, setTimeRange] = useState('month')
  const [selectedFields, setSelectedFields] = useState([])
  const [selectedDevices, setSelectedDevices] = useState([])
  const [dataType, setDataType] = useState('all')
  
  // 获取用户的地块列表
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const fieldsData = await fieldService.getFields({ owner_id: user?.id })
        setFields(fieldsData.data || [])
        // 默认选择所有地块
        if (fieldsData.data && fieldsData.data.length > 0) {
          setSelectedFields(fieldsData.data.map(field => field.id))
        }
      } catch (err) {
        console.error('获取地块列表失败:', err)
      }
    }
    
    if (user?.id) {
      fetchFields()
    }
  }, [user?.id])

  // 获取用户的设备列表
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devicesData = await deviceService.getDevices({ owner_id: user?.id })
        setDevices(devicesData.data || [])
        // 默认选择所有设备
        if (devicesData.data && devicesData.data.length > 0) {
          setSelectedDevices(devicesData.data.map(device => device.id))
        }
      } catch (err) {
        console.error('获取设备列表失败:', err)
      }
    }
    
    if (user?.id) {
      fetchDevices()
    }
  }, [user?.id])

  // 获取原始数据用于分析
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id || selectedFields.length === 0) return
      
      setLoading(true)
      setError(null)
      
      try {
        // 计算时间范围
        const endDate = new Date()
        const startDate = new Date()
        
        switch (timeRange) {
          case 'week':
            startDate.setDate(endDate.getDate() - 7)
            break
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1)
            break
          case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3)
            break
          case 'year':
            startDate.setFullYear(endDate.getFullYear() - 1)
            break
        }
        
        const params = {
          user_id: user.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          page: 1,
          page_size: 1000 // 获取足够的数据用于分析
        }
        
        // 如果选择了特定设备，添加设备过滤
        if (selectedDevices.length > 0 && selectedDevices.length !== devices.length) {
          params.device_id = selectedDevices.join(',')
        }
        
        // 如果选择了特定地块，添加地块过滤
        if (selectedFields.length > 0 && selectedFields.length !== fields.length) {
          params.field_id = selectedFields.join(',')
        }
        
        // 如果选择了特定数据类型，添加数据类型过滤
        if (dataType !== 'all') {
          params.data_type = dataType
        }
        
        const response = await rawDataService.getRawDataList(params)
        
        if (response.code === 200) {
          setRawData(response.data.data || [])
        } else {
          setError(response.message || '获取分析数据失败')
        }
      } catch (err) {
        setError('获取分析数据失败，请稍后再试')
        console.error('获取分析数据失败:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [user?.id, timeRange, selectedFields, selectedDevices, dataType])
  
  const handleAnalysisTypeChange = (e) => {
    setAnalysisType(e.target.value)
  }
  
  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value)
  }
  
  const handleDataTypeChange = (e) => {
    setDataType(e.target.value)
  }
  
  const handleFieldChange = (fieldId) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(id => id !== fieldId))
    } else {
      setSelectedFields([...selectedFields, fieldId])
    }
  }
  
  const handleDeviceChange = (deviceId) => {
    if (selectedDevices.includes(deviceId)) {
      setSelectedDevices(selectedDevices.filter(id => id !== deviceId))
    } else {
      setSelectedDevices([...selectedDevices, deviceId])
    }
  }

  const handleGenerateReport = () => {
    // 这里可以实现报告生成逻辑
    alert('报告生成功能正在开发中')
  }

  const getChartData = (dataType) => {
    // 根据数据类型和选择的时间范围过滤数据
    const filteredData = rawData.filter(item => 
      item.data_type === dataType || dataType === 'all'
    )
    
    // 这里可以根据分析类型进一步处理数据
    // 例如趋势分析、对比分析等
    
    return filteredData
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN')
  }
  
  return (
    <div className="dashboard-data-analyze">
      <div className="dashboard-header">
        <h1>数据分析</h1>
        <button className="primary-btn" onClick={handleGenerateReport} disabled={loading}>
          生成报告
        </button>
      </div>
      
      <div className="analysis-controls">
        <div className="control-group">
          <label>分析类型</label>
          <select value={analysisType} onChange={handleAnalysisTypeChange}>
            <option value="trend">趋势分析</option>
            <option value="comparison">对比分析</option>
            <option value="correlation">相关性分析</option>
            <option value="prediction">预测分析</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>时间范围</label>
          <select value={timeRange} onChange={handleTimeRangeChange}>
            <option value="week">最近一周</option>
            <option value="month">最近一月</option>
            <option value="quarter">最近一季</option>
            <option value="year">最近一年</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>数据类型</label>
          <select value={dataType} onChange={handleDataTypeChange}>
            <option value="all">全部类型</option>
            <option value="temperature">温度</option>
            <option value="humidity">湿度</option>
            <option value="soil_ph">土壤pH</option>
            <option value="light">光照</option>
            <option value="image">图像</option>
            <option value="ndvi">NDVI</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>选择地块</label>
          <div className="field-selector">
            {fields.map(field => (
              <div key={field.id} className="field-checkbox">
                <input 
                  type="checkbox" 
                  id={`field-${field.id}`} 
                  checked={selectedFields.includes(field.id)}
                  onChange={() => handleFieldChange(field.id)}
                />
                <label htmlFor={`field-${field.id}`}>{field.name}</label>
              </div>
            ))}
          </div>
        </div>
        
        <div className="control-group">
          <label>选择设备</label>
          <div className="device-selector">
            {devices.map(device => (
              <div key={device.id} className="device-checkbox">
                <input 
                  type="checkbox" 
                  id={`device-${device.id}`} 
                  checked={selectedDevices.includes(device.id)}
                  onChange={() => handleDeviceChange(device.id)}
                />
                <label htmlFor={`device-${device.id}`}>
                  {device.model || `${device.device_type}-${device.id.substring(0, 8)}`}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      
      <div className="analysis-results">
        {loading ? (
          <div className="loading">加载数据中...</div>
        ) : (
          <>
            <div className="data-summary">
              <h3>数据概览</h3>
              <p>在选定的时间范围内，共有 {rawData.length} 条数据记录</p>
              <p>涉及 {selectedFields.length} 个地块，{selectedDevices.length} 个设备</p>
            </div>
            
            <div className="chart-container">
              <h3>数据分布</h3>
              <div className="chart-placeholder">
                <p>图表区域 - 这里将显示数据分布情况</p>
                {rawData.slice(0, 5).map(item => (
                  <div key={item.id}>
                    {formatDate(item.capture_time || item.created_at)} - 
                    {item.data_type}: {item.data_value} {item.data_unit || ''}
                  </div>
                ))}
              </div>
            </div>
            
            {dataType === 'all' ? (
              <>
                {['temperature', 'humidity', 'soil_ph', 'light'].map(type => {
                  const typeData = getChartData(type)
                  if (typeData.length === 0) return null
                  
                  const typeNames = {
                    temperature: '温度',
                    humidity: '湿度',
                    soil_ph: '土壤pH值',
                    light: '光照'
                  }
                  
                  return (
                    <div key={type} className="chart-container">
                      <h3>{typeNames[type]}变化趋势</h3>
                      <div className="chart-placeholder">
                        <p>图表区域 - 这里将显示{typeNames[type]}变化趋势</p>
                        <p>共 {typeData.length} 条{typeNames[type]}数据</p>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="chart-container">
                <h3>数据分析</h3>
                <div className="chart-placeholder">
                  <p>图表区域 - 这里将显示{dataType}数据的详细分析</p>
                  <p>共 {getChartData(dataType).length} 条数据</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default DataAnalyze