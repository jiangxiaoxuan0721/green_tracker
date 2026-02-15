import { useNavigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { useLoginForm } from '@/hooks/auth/useLoginForm'
import useToast from '@/hooks/useToast'
import { Card, Input, Button, ToastContainer } from '@/components/ui'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, loading, authenticating } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useLoginForm(login)
  const { toasts, removeToast, error: showError } = useToast()

  const handleLoginSuccess = async (e) => {
    e.preventDefault()
    const result = await handleSubmit(e)
    if (result.success) {
      navigate('/dashboard')
    } else if (result.error) {
      showError(result.error)
    }
  }

  // 认证初始化时显示加载状态
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="login-page-container">
          <div className="login-background"></div>
          <div className="login-inner-container">
            <Card className="login-container">
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '300px',
                fontSize: '1.2rem',
                color: '#666'
              }}>
                正在加载...
              </div>
            </Card>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="login-page-container">
        <div className="login-background"></div>
        <div className="login-inner-container">
          <Card className="login-container">
            <form className="login-form" onSubmit={handleLoginSuccess}>
              <h2>登录</h2>
              <Input
                label="用户名"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="请输入用户名"
                disabled={authenticating}
                required
              />
              <Input
                label="密码"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="请输入密码"
                disabled={authenticating}
                required
              />
              <Button type="submit" variant="primary" loading={authenticating} className="login-btn">
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