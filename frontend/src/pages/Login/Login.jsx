import { useNavigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { useLoginForm } from '@/hooks/auth/useLoginForm'
import { Card, Input, Button } from '@/components/ui'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, loading, error } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useLoginForm(login)

  const handleLoginSuccess = async (e) => {
    const result = await handleSubmit(e)
    if (result.success) {
      navigate('/dashboard')
    }
  }

  return (
    <>
      <Navbar />
      <div className="login-page-container">
        <div className="login-background"></div>
        <div className="login-inner-container">
          <Card className="login-container">
            <form className="login-form" onSubmit={handleLoginSuccess}>
              <h2>登录</h2>
              {(error || errors.username || errors.password) && (
                <div className="error-message">
                  {error || errors.username || errors.password}
                </div>
              )}
              <Input
                label="用户名"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="请输入用户名"
                disabled={loading}
                required
              />
              <Input
                label="密码"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="请输入密码"
                disabled={loading}
                required
              />
              <Button type="submit" variant="primary" loading={loading} className="login-btn">
                登录
              </Button>
              <div className="register-link">
                <span>没有账号？</span>
                <a href="#" onClick={() => navigate('/register')} className="register-btn-link">去注册</a>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}

export default Login