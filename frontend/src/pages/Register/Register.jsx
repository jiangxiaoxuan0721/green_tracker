import { useNavigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { useRegisterForm } from '@/hooks/auth/useRegisterForm'
import { useState } from 'react'
import { Card, Input, Button } from '@/components/ui'
import './Register.css'

const Register = () => {
  const navigate = useNavigate()
  const { register, loading, error: authError } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useRegisterForm(register)
  const [successMessage, setSuccessMessage] = useState('')
  
  const handleRegisterSuccess = async (e) => {
    try {
      const result = await handleSubmit(e)
      
      if (result.success) {
        setSuccessMessage('注册成功！正在跳转到登录页面...')
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    } catch (error) {
      console.error('注册异常:', error)
    }
  }

  return (
    <>
      <Navbar />
      <div className="register-page-container">
        <div className="register-background"></div>
        <div className="register-inner-container">
          <Card className="register-container">
            <form className="register-form" onSubmit={handleRegisterSuccess}>
              <h2>注册</h2>
              {(authError || errors.username || errors.email || errors.password || errors.confirmPassword) && (
                <div className="error-message">
                  {authError || errors.username || errors.email || errors.password || errors.confirmPassword}
                </div>
              )}
              {successMessage && <div className="success-message">{successMessage}</div>}
              
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
                label="邮箱"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="请输入邮箱地址"
                disabled={loading}
                required
              />
              
              <Input
                label="密码"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="请输入密码（至少6位）"
                disabled={loading}
                required
              />
              
              <Input
                label="确认密码"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="请再次输入密码"
                disabled={loading}
                required
              />
              
              <Button type="submit" variant="primary" loading={loading} className="register-btn">
                注册
              </Button>
              <div className="login-link">
                <span>已有账号？</span>
                <a href="#" onClick={() => navigate('/login')} className="login-btn-link">去登录</a>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}

export default Register