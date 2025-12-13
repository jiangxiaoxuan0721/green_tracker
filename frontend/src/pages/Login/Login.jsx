import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../hooks/auth/useAuth'
import { useLoginForm } from '../../hooks/auth/useLoginForm'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, loading, error } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useLoginForm(login)

  // 登录成功后跳转
  const handleLoginSuccess = async (e) => {
    const result = await handleSubmit(e)
    if (result.success) {
      console.log('登录成功，准备跳转到dashboard')
      navigate('/dashboard')
    }
  }

  return (
    <>
      <Navbar />
      <div className="login-page-container">
        <div className="login-background"></div>
        <div className="login-inner-container">
          <div className="login-container">
            <form className="login-form" onSubmit={handleLoginSuccess}>
              <h2>登录</h2>
              {(error || errors.username || errors.password) && (
                <div className="error-message">
                  {error || errors.username || errors.password}
                </div>
              )}
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
                <label>密码</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="请输入密码"
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </button>
              <div className="register-link">
                <span>没有账号？</span>
                <a href="#" onClick={() => navigate('/register')} className="register-btn-link">去注册</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login