import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import './Login.css'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    
    // 硬编码用户名和密码
    const defaultUsername = 'admin'
    const defaultPassword = '123456'
    
    // 验证用户输入
    if (!username || !password) {
      setError('请填写所有必填项')
      return
    }
    
    // 验证用户名和密码是否匹配
    if (username === defaultUsername && password === defaultPassword) {
      // 登录成功，保存登录状态
      localStorage.setItem('isLoggedIn', 'true')
      console.log('登录成功，准备跳转到dashboard')
      navigate('/dashboard')
    } else {
      console.log('登录失败')
      setError('用户名或密码错误')
    }
  }

  return (
    <><Navbar />
    <div className="login-page-container">
      <div className="login-background"></div>
      <div className="login-inner-container">
        <div className="login-container">
          <form className="login-form" onSubmit={handleSubmit}>
            <h2>登录</h2>
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="form-group">
              <label>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
            <button type="submit" className="login-btn">登录</button>
            <div className="register-link">
              <span>没有账号？</span>
              <a href="#" onClick={() => navigate('/register')} className="register-btn-link">去注册</a>
            </div>
          </form>
        </div>
      </div>
    </div></>
  )
}

export default Login