import { Link } from 'react-router-dom'
import './Navbar.css'

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          空天地一体化农作物智能平台
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/" className="nav-link">
              首页
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/login" className="nav-link">
              登录
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/about" className="nav-link">
              关于
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/contact" className="nav-link">
              联系
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navbar