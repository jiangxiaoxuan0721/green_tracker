import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './Dashboard.css'

// 导入子组件
import OverviewTab from './components/OverviewTab'
import DevicesTab from './components/DevicesTab'
import DataTab from './components/DataTab'
import AnalyticsTab from './components/AnalyticsTab'
import SettingsTab from './components/SettingsTab'
import LogsTab from './components/LogsTab'

const Dashboard = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  
  // 菜单项数据
  const menuItems = [
    { id: 'overview', label: '概览' },
    { id: 'devices', label: '设备管理' },
    { id: 'data', label: '数据查看' },
    { id: 'analytics', label: '数据分析' },
    { id: 'settings', label: '系统设置' },
    { id: 'logs', label: '日志查看' }
  ]
  
  // 设备数据
  const devices = [
    { id: 1, name: '温度传感器-001', location: '机房A', status: 'online', lastUpdate: '2023-06-15 10:25:30' },
    { id: 2, name: '湿度传感器-002', location: '机房A', status: 'online', lastUpdate: '2023-06-15 10:25:28' },
    { id: 3, name: '烟雾探测器-003', location: '走廊B', status: 'offline', lastUpdate: '2023-06-15 09:15:12' },
    { id: 4, name: '门禁控制器-004', location: '主入口', status: 'online', lastUpdate: '2023-06-15 10:25:31' },
    { id: 5, name: '照明控制器-005', location: '办公区', status: 'online', lastUpdate: '2023-06-15 10:22:45' }
  ]
  
  // 日志数据
  const logs = [
    { time: '2023-06-15 10:25:33', level: 'info', message: '温度传感器-001 数据采集完成' },
    { time: '2023-06-15 10:25:28', level: 'info', message: '湿度传感器-002 数据采集完成' },
    { time: '2023-06-15 09:48:12', level: 'warning', message: '烟雾探测器-003 连接超时' },
    { time: '2023-06-15 09:15:12', level: 'error', message: '烟雾探测器-003 离线' },
    { time: '2023-06-15 08:30:05', level: 'info', message: '系统启动完成' },
    { time: '2023-06-15 08:29:58', level: 'success', message: '数据库连接成功' }
  ]
  
  // 传感器数据
  const sensorData = [
    { 
      id: 'SENS-001', 
      timestamp: '2023-06-15 10:25:33', 
      location: { longitude: 120.1552, latitude: 30.2741 }, 
      temperature: 23.5, 
      humidity: 65.2, 
      ph: 7.3, 
      lightIntensity: 850, 
      imagePath: '/uploads/images/sensor_001_20230615.jpg' 
    },
    { 
      id: 'SENS-002', 
      timestamp: '2023-06-15 10:25:28', 
      location: { longitude: 120.1555, latitude: 30.2745 }, 
      temperature: 24.1, 
      humidity: 62.8, 
      ph: 7.1, 
      lightIntensity: 920, 
      imagePath: '/uploads/images/sensor_002_20230615.jpg' 
    },
    { 
      id: 'SENS-003', 
      timestamp: '2023-06-15 10:25:25', 
      location: { longitude: 120.1558, latitude: 30.2742 }, 
      temperature: 23.8, 
      humidity: 67.4, 
      ph: 7.4, 
      lightIntensity: 780, 
      imagePath: '/uploads/images/sensor_003_20230615.jpg' 
    },
    { 
      id: 'SENS-004', 
      timestamp: '2023-06-15 10:25:22', 
      location: { longitude: 120.1561, latitude: 30.2746 }, 
      temperature: 25.2, 
      humidity: 60.5, 
      ph: 6.9, 
      lightIntensity: 1050, 
      imagePath: '/uploads/images/sensor_004_20230615.jpg' 
    },
    { 
      id: 'SENS-005', 
      timestamp: '2023-06-15 10:25:18', 
      location: { longitude: 120.1564, latitude: 30.2749 }, 
      temperature: 22.9, 
      humidity: 68.1, 
      ph: 7.2, 
      lightIntensity: 750, 
      imagePath: '/uploads/images/sensor_005_20230615.jpg' 
    }
  ]

  const handleLogout = () => {
    // 清除登录状态
    localStorage.removeItem('isLoggedIn')
    navigate('/')
  }

  const handleMenuClick = (menuId) => {
    setActiveTab(menuId)
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'overview':
        return <OverviewTab />
      case 'devices':
        return <DevicesTab devices={devices} />
      case 'data':
        return <DataTab sensorData={sensorData} />
      case 'analytics':
        return <AnalyticsTab />
      case 'settings':
        return <SettingsTab />
      case 'logs':
        return <LogsTab logs={logs} />
      default:
        return null
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>控制面板</h2>
          <button className="logout-btn" onClick={handleLogout}>退出</button>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map(item => (
            <li 
              className={`menu-item ${activeTab === item.id ? 'active' : ''}`} 
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
            >
              <span className="menu-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="dashboard-content">
        <div className="content-section">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default Dashboard