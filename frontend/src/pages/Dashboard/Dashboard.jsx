import { useNavigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/auth/useAuth'
import { 
  LayoutDashboard, Grid3X3, Radio, ListTodo, Upload, Eye, BarChart3, 
  Cpu, Settings, FileText, LogOut 
} from 'lucide-react'
import { motion } from 'framer-motion'
import './Dashboard.css'
import './AdditionalStyles.css'

const Dashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading } = useAuth()

  // 检查用户是否已登录
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, loading, navigate])

  // 如果正在验证身份，显示加载状态
  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-content">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontSize: '1.2rem',
            color: '#666'
          }}>
            正在验证身份...
          </div>
        </div>
      </div>
    )
  }
  
  // 菜单项数据 - 包含图标
  const menuItems = [
    { id: 'overview', label: '概览', path: '/dashboard', icon: LayoutDashboard },
    { id: 'fields', label: '地块管理', path: '/dashboard/fields', icon: Grid3X3 },
    { id: 'devices', label: '设备管理', path: '/dashboard/devices', icon: Radio },
    { id: 'sessions', label: '任务管理', path: '/dashboard/sessions', icon: ListTodo },
    { id: 'data-upload', label: '数据上传', path: '/dashboard/data-upload', icon: Upload },
    { id: 'data-view', label: '数据查看', path: '/dashboard/data-view', icon: Eye },
    { id: 'data-analyze', label: '数据分析', path: '/dashboard/data-analyze', icon: BarChart3 },
    { id: 'algorithm-square', label: '算法广场', path: '/dashboard/algorithm-square', icon: Cpu },
    { id: 'system', label: '系统设置', path: '/dashboard/system', icon: Settings },
    { id: 'logs', label: '日志查看', path: '/dashboard/logs', icon: FileText }
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
          <div className="sidebar-logo">
            <div className="logo-icon">
              <Cpu size={24} />
            </div>
            <h2>控制面板</h2>
          </div>
          <motion.button 
            className="logout-btn" 
            onClick={handleLogout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={16} />
            退出
          </motion.button>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const isActive = getActiveTab() === item.id
            return (
              <motion.li 
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link 
                  to={item.path}
                  className={`menu-link ${isActive ? 'active' : ''}`}
                >
                  <span className="menu-icon-wrapper">
                    <Icon size={18} className="menu-icon" />
                    {isActive && <span className="active-indicator"></span>}
                  </span>
                  <span className="menu-label">{item.label}</span>
                </Link>
              </motion.li>
            )
          })}
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