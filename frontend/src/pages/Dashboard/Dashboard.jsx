import { useNavigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/auth/useAuth'
import './Dashboard.css'
import './AdditionalStyles.css'

const Dashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  
  // 检查用户是否已登录
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])
  
  // 菜单项数据
  const menuItems = [
    { id: 'overview', label: '概览', path: '/dashboard' },
    { id: 'fields', label: '地块管理', path: '/dashboard/fields' },
    { id: 'devices', label: '设备管理', path: '/dashboard/devices' },
    { id: 'sessions', label: '任务管理', path: '/dashboard/sessions' },
    { id: 'data-view', label: '数据查看', path: '/dashboard/data-view' },
    { id: 'data-analyze', label: '数据分析', path: '/dashboard/data-analyze' },
    { id: 'system', label: '系统设置', path: '/dashboard/system' },
    { id: 'logs', label: '日志查看', path: '/dashboard/logs' }
  ]
  


  const handleLogout = () => {
    // 清除登录状态
    localStorage.removeItem('token')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('user_id')
    navigate('/')
  }

  const getActiveTab = () => {
    // 根据当前路径确定激活的菜单项
    const currentPath = location.pathname
    
    if (currentPath === '/dashboard') {
      return 'overview'
    }
    
    // 从路径中提取菜单ID
    const pathSegments = currentPath.split('/')
    if (pathSegments.length > 2) {
      return pathSegments[2] // /dashboard/xxx 中的 xxx
    }
    
    return ''
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
            <li key={item.id}>
              <Link 
                to={item.path}
                className={`menu-link ${getActiveTab() === item.id ? 'active' : ''}`}
              >
                <span className="menu-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="dashboard-content">
        <div className="content-section">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Dashboard