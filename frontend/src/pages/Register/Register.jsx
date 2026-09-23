import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Key
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import AuthBrandPanel from '@/components/AuthBrandPanel'
import { useAuth } from '@/hooks/auth/useAuth'
import { useRegisterForm } from '@/hooks/auth/useRegisterForm'
import { Card, ToastContainer } from '@/components/ui'
import useToast from '@/hooks/useToast'
import { authService } from '@/services/authService'
import { fadeInUp, scaleIn } from '@/utils/animations'
import { EnhancedLoading } from '@/components/ui/EnhancedLoading'
import './Register.css'

const Register = () => {
  const navigate = useNavigate()
  const { register, loading, authenticating, error: authError } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useRegisterForm(register)
  const { success: showSuccess, error: showError } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(null)

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const handleRegisterSuccess = async (e) => {
    e.preventDefault()
    const result = await handleSubmit(e)
    if (result.success) {
      showSuccess('注册成功！正在跳转到登录页面...')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } else if (result.error) {
      showError(result.error)
    }
  }

  const handleSendCode = async () => {
    if (!formData.email) {
      showError('请先输入邮箱地址')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      showError('请输入有效的邮箱地址')
      return
    }

    setSendingCode(true)
    try {
      await authService.sendVerificationCode(formData.email)
      showSuccess('验证码已发送到您的邮箱')
      setCountdown(60)
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      showError(err?.response?.data?.detail || '验证码发送失败')
    } finally {
      setSendingCode(false)
    }
  }

  const renderFieldError = (message) => (
    <div className="error-message">{message}</div>
  )

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="register-split-container">
          <AuthBrandPanel />
          <div className="register-form-panel">
            <div className="register-form-container">
              <Card className="register-card">
                <EnhancedLoading text="正在初始化注册系统" size="small" color="primary" />
              </Card>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <ToastContainer />
      <div className="register-split-container">
        <AuthBrandPanel />

        <div className="register-form-panel">
          <motion.div
            className="register-form-container"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="register-card">
              <motion.div
                className="register-header"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <div className="register-icon-wrapper">
                  <User size={18} />
                </div>
                <h2>创建账号</h2>
                <p>填写以下信息完成注册</p>
              </motion.div>

              <motion.form
                className="register-form"
                onSubmit={handleRegisterSuccess}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
              >
                {authError && <div className="error-message">{authError}</div>}

                <div className="register-field-grid">
                  <div>
                    <div className="input-label">用户名</div>
                    <div className="input-wrapper">
                      <User className="input-icon" size={16} />
                      <input
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="请输入用户名"
                        disabled={authenticating}
                        required
                      />
                    </div>
                    {errors.username && renderFieldError(errors.username)}
                  </div>

                  <div>
                    <div className="input-label">邮箱</div>
                    <div className="input-wrapper">
                      <Mail className="input-icon" size={16} />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="请输入邮箱地址"
                        disabled={authenticating}
                        required
                      />
                    </div>
                    {errors.email && renderFieldError(errors.email)}
                  </div>

                  <div className="field-full">
                    <div className="input-label">邮箱验证码</div>
                    <div className="input-wrapper">
                      <Key className="input-icon" size={16} />
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleChange}
                        placeholder="请输入6位验证码"
                        maxLength={6}
                        disabled={authenticating}
                        required
                        className="code-input"
                      />
                      <button
                        type="button"
                        className={`send-code-btn ${countdown > 0 ? 'counting' : ''}`}
                        onClick={handleSendCode}
                        disabled={sendingCode || countdown > 0 || authenticating}
                      >
                        {sendingCode ? (
                          <><Loader2 className="spinner" size={14} /> 发送中</>
                        ) : countdown > 0 ? (
                          `${countdown}s`
                        ) : (
                          '发送验证码'
                        )}
                      </button>
                    </div>
                    {errors.code && renderFieldError(errors.code)}
                  </div>

                  <div>
                    <div className="input-label">密码</div>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="至少6位"
                        disabled={authenticating}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && renderFieldError(errors.password)}
                  </div>

                  <div>
                    <div className="input-label">确认密码</div>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={16} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="请再次输入密码"
                        disabled={authenticating}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirmPassword && renderFieldError(errors.confirmPassword)}
                  </div>
                </div>

                <button type="submit" className="register-btn" disabled={authenticating}>
                  {authenticating ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      注册中...
                    </>
                  ) : (
                    <>
                      立即注册
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="login-link">
                  <span>已有账号？</span>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
                    去登录
                  </a>
                </div>
              </motion.form>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  )
}

export default Register
