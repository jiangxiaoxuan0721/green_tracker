import { useState } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const DataView = () => {
  const [filters] = useState({
    startDate: '2023-06-01',
    endDate: '2023-06-15',
    device: 'all',
    dataType: 'all'
  })

  const [data, setData] = useState([
    {
      id: 1,
      timestamp: '2023-06-15 10:25:33',
      deviceId: '温度传感器-001',
      deviceType: '温度传感器',
      location: '东区A地块',
      value: 24.5,
      unit: '°C'
    },
    {
      id: 2,
      timestamp: '2023-06-15 10:25:28',
      deviceId: '湿度传感器-002',
      deviceType: '湿度传感器',
      location: '东区B地块',
      value: 65.2,
      unit: '%'
    },
    {
      id: 3,
      timestamp: '2023-06-15 10:25:25',
      deviceId: '土壤监测器-003',
      deviceType: '土壤监测器',
      location: '西区A地块',
      value: 7.3,
      unit: 'pH'
    },
    {
      id: 4,
      timestamp: '2023-06-15 10:25:22',
      deviceId: '光照传感器-004',
      deviceType: '光照传感器',
      location: '东区A地块',
      value: 1250,
      unit: 'lux'
    }
  ])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSearch = () => {
    console.log('查询条件:', filters)
    // 这里可以调用API获取数据
  }

  const handleExport = () => {
    console.log('导出数据')
    // 这里可以实现数据导出功能
  }

  return (
    <div className="dashboard-data-view">
      <div className="dashboard-header">
        <h1>数据查看</h1>
        <button className="primary-btn" onClick={handleExport}>导出数据</button>
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
            <option value="温度传感器-001">温度传感器-001</option>
            <option value="湿度传感器-002">湿度传感器-002</option>
            <option value="土壤监测器-003">土壤监测器-003</option>
            <option value="光照传感器-004">光照传感器-004</option>
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
            <option value="ph">pH值</option>
            <option value="light">光照</option>
          </select>
        </div>
        
        <button className="secondary-btn" onClick={handleSearch}>查询</button>
      </div>
      
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>时间戳</th>
              <th>设备名称</th>
              <th>设备类型</th>
              <th>位置</th>
              <th>数值</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id}>
                <td>{item.timestamp}</td>
                <td>{item.deviceId}</td>
                <td>{item.deviceType}</td>
                <td>{item.location}</td>
                <td>{item.value} {item.unit}</td>
                <td>
                  <div className="action-buttons">
                    <button className="secondary-btn">详情</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataView