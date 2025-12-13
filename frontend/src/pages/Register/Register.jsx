import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../hooks/auth/useAuth'
import { useRegisterForm } from '../../hooks/auth/useRegisterForm'
import { useState } from 'react'
import './Register.css'

const Register = () => {
  const navigate = useNavigate()
  const { register, loading, error: authError } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useRegisterForm(register)
  const [successMessage, setSuccessMessage] = useState('')
  
  // 注册成功后的处理
  const handleRegisterSuccess = async (e) => {
    console.log("🔍 [Register] 开始处理注册表单提交");
    try {
      const result = await handleSubmit(e);
      console.log("🔍 [Register] handleSubmit返回结果:", result);
      
      if (result.success) {
        console.log("✅ [Register] 注册成功，准备跳转到登录页");
        setSuccessMessage('注册成功！正在跳转到登录页面...')
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      } else {
        console.error("❌ [Register] 注册失败:", result.error);
      }
    } catch (error) {
      console.error("💥 [Register] 表单提交异常:", error);
    }
  }

  return (
    <>
      <Navbar />
      <div className="register-page-container">
        <div className="register-background"></div>
        <div className="register-inner-container">
          <div className="register-container">
            <form className="register-form" onSubmit={handleRegisterSuccess}>
              <h2>注册</h2>
              {(authError || errors.username || errors.email || errors.password || errors.confirmPassword) && (
                <div className="error-message">
                  {authError || errors.username || errors.email || errors.password || errors.confirmPassword}
                </div>
              )}
              {successMessage && <div className="success-message">{successMessage}</div>}
              
              <div className="form-group">
                <label>用户名</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="请输入用户名"
                  required
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
              
              <button type="submit" className="register-btn" disabled={loading}>
                {loading ? '注册中...' : '注册'}
              </button>
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