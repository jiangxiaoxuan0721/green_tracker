import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, LogIn, Info, MessageSquare, Send } from 'lucide-react'
import './Navbar.css'

const Navbar = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '首页', icon: Home },
    { path: '/login', label: '登录', icon: LogIn },
    { path: '/about', label: '关于', icon: Info },
    { path: '/contact', label: '联系', icon: MessageSquare },
    { path: '/feedback', label: '反馈', icon: Send }
  ]

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <div className="logo-icon">
            <span className="logo-emoji">🌾</span>
          </div>
          <span className="logo-text">空天地智能平台</span>
        </Link>
        <ul className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <li key={item.path} className="nav-item">
                <Link 
                  to={item.path} 
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} className="nav-icon" />
                  <span>{item.label}</span>
                  {isActive && <motion.div className="nav-link-indicator" layoutId="nav-indicator" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

export default Navbar