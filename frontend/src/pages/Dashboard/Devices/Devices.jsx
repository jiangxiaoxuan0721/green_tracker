import { useState, useEffect } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const Devices = () => {
  const [devices, setDevices] = useState([
    {
      id: 1,
      name: '温度传感器-001',
      location: '东区A地块',
      status: 'online',
      lastUpdate: '2023-06-15 10:25:30',
      battery: '85%'
    },
    {
      id: 2,
      name: '湿度传感器-002',
      location: '东区B地块',
      status: 'online',
      lastUpdate: '2023-06-15 10:25:28',
      battery: '92%'
    },
    {
      id: 3,
      name: '土壤监测器-003',
      location: '西区A地块',
      status: 'offline',
      lastUpdate: '2023-06-15 09:15:12',
      battery: '15%'
    },
    {
      id: 4,
      name: '灌溉控制器-004',
      location: '东区A地块',
      status: 'online',
      lastUpdate: '2023-06-15 10:25:31',
      battery: '78%'
    }
  ])

  const getStatusClass = (status) => {
    return status === 'online' ? 'status-online' : 'status-offline'
  }

  return (
    <div className="dashboard-devices">
      <div className="dashboard-header">
        <h1>设备管理</h1>
        <button className="primary-btn">添加设备</button>
      </div>
      
      <div className="devices-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>设备名称</th>
              <th>位置</th>
              <th>状态</th>
              <th>电量</th>
              <th>最后更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id}>
                <td>{device.name}</td>
                <td>{device.location}</td>
                <td>
                  <div className={`status-indicator ${getStatusClass(device.status)}`}>
                    {device.status === 'online' ? '在线' : '离线'}
                  </div>
                </td>
                <td>{device.battery}</td>
                <td>{device.lastUpdate}</td>
                <td>
                  <div className="action-buttons">
                    <button className="secondary-btn">查看</button>
                    <button className="secondary-btn">配置</button>
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

export default Devices