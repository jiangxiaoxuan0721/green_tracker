import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import './Register.css'

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    // 验证表单
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('请填写所有必填项')
      return
    }
    
    if (formData.password.length < 6) {
      setError('密码长度至少6位')
      return
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('请输入有效的邮箱地址')
      return
    }
    
    // 模拟注册成功
    console.log('注册数据:', formData)
    setSuccess('注册成功！正在跳转到登录页面...')
    
    // 2秒后跳转到登录页面
    setTimeout(() => {
      navigate('/login')
    }, 2000)
  }

  return (
    <>
      <Navbar />
      <div className="register-page-container">
        <div className="register-background"></div>
        <div className="register-inner-container">
          <div className="register-container">
            <form className="register-form" onSubmit={handleSubmit}>
              <h2>注册</h2>
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
              
              <div className="form-group">
                <label>用户名</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="请输入用户名"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>邮箱</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="请输入邮箱地址"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>密码</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="请输入密码（至少6位）"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>确认密码</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="请再次输入密码"
                  required
                />
              </div>
              
              <button type="submit" className="register-btn">注册</button>
              
              <div className="login-link">
                <span>已有账号？</span>
                <a href="#" onClick={() => navigate('/login')} className="login-btn-link">去登录</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default Register