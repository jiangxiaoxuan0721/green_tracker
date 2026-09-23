import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Lock, Mail, Eye, EyeOff, ArrowRight, Loader2, Key
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import AuthBrandPanel from '@/components/AuthBrandPanel'
import { useAuth } from '@/hooks/auth/useAuth'
import { useLoginForm } from '@/hooks/auth/useLoginForm'
import useToast from '@/hooks/useToast'
import { authService } from '@/services/authService'
import { Card } from '@/components/ui'
import { EnhancedLoading } from '@/components/ui/EnhancedLoading'
import { fadeInUp, scaleIn } from '@/utils/animations'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, loginByCode, loading, authenticating } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useLoginForm(login)
  const { error: showError, success: showSuccess } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loginMode, setLoginMode] = useState('password') // 'password' | 'code'

  // 验证码登录表单状态
  const [codeForm, setCodeForm] = useState({ email: '', code: '' })
  const [codeErrors, setCodeErrors] = useState({})
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(null)

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const handleLoginSuccess = async (e) => {
    e.preventDefault()
    const result = await handleSubmit(e)
    if (result.success) {
      navigate('/dashboard')
    } else if (result.error) {
      showError(result.error)
    }
  }

  const switchMode = (mode) => {
    setLoginMode(mode)
    setCodeErrors({})
  }

  const handleCodeFormChange = (e) => {
    const { name, value } = e.target
    setCodeForm(prev => ({ ...prev, [name]: value }))
    if (codeErrors[name]) {
      setCodeErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSendCode = async () => {
    if (!codeForm.email) {
      setCodeErrors(prev => ({ ...prev, email: '请先输入邮箱地址' }))
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(codeForm.email)) {
      setCodeErrors(prev => ({ ...prev, email: '请输入有效的邮箱地址' }))
      return
    }

    setSendingCode(true)
    try {
      await authService.sendVerificationCode(codeForm.email, 'login')
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

  const handleCodeLogin = async (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!codeForm.email) {
      newErrors.email = '请输入邮箱地址'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(codeForm.email)) {
        newErrors.email = '请输入有效的邮箱地址'
      }
    }
    if (!codeForm.code) {
      newErrors.code = '请输入验证码'
    } else if (!/^\d{6}$/.test(codeForm.code)) {
      newErrors.code = '请输入6位数字验证码'
    }

    if (Object.keys(newErrors).length > 0) {
      setCodeErrors(newErrors)
      showError(newErrors.email || newErrors.code)
      return
    }

    const result = await loginByCode(codeForm.email, codeForm.code)
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
        <div className="login-split-container">
          <AuthBrandPanel />
          <div className="login-form-panel">
            <div className="login-form-container">
              <Card className="login-card">
                <EnhancedLoading text="正在校验登录状态" size="small" color="primary" />
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
      <div className="login-split-container">
        <AuthBrandPanel />

        <div className="login-form-panel">
          <motion.div
            className="login-form-container"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="login-card">
              <motion.div
                className="login-header"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <div className="login-icon-wrapper">
                  {loginMode === 'password' ? <Lock size={18} /> : <Mail size={18} />}
                </div>
                <h2>登录</h2>
                <p>{loginMode === 'password' ? '使用账号密码登录' : '使用邮箱验证码登录'}</p>
              </motion.div>

              <div className="login-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'password'}
                  className={`login-tab ${loginMode === 'password' ? 'active' : ''}`}
                  onClick={() => switchMode('password')}
                >
                  账号密码
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'code'}
                  className={`login-tab ${loginMode === 'code' ? 'active' : ''}`}
                  onClick={() => switchMode('code')}
                >
                  邮箱验证码
                </button>
              </div>

              {loginMode === 'password' ? (
                <motion.form
                  className="login-form"
                  onSubmit={handleLoginSuccess}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="input-group">
                    <div>
                      <div className="input-label">用户名</div>
                      <div className={`input-wrapper ${errors.username ? 'invalid' : ''}`}>
                        <Mail className="input-icon" size={16} />
                        <input
                          name="username"
                          value={formData.username}
                          onChange={handleChange}
                          placeholder="请输入用户名"
                          disabled={authenticating}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="input-label">密码</div>
                      <div className={`input-wrapper ${errors.password ? 'invalid' : ''}`}>
                        <Lock className="input-icon" size={16} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="请输入密码"
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

                    </div>
                  </div>

                  <div className="login-options">
                    <label className="remember-me">
                      <input type="checkbox" />
                      <span>记住我</span>
                    </label>
                    <a
                      href="#"
                      className="forgot-password"
                      onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}
                    >
                      忘记密码？
                    </a>
                  </div>

                  <button type="submit" className="login-btn" disabled={authenticating}>
                    {authenticating ? (
                      <>
                        <Loader2 className="spinner" size={16} />
                        登录中...
                      </>
                    ) : (
                      <>
                        登录
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="register-link">
                    <span>还没有账号？</span>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>
                      立即注册
                    </a>
                  </div>
                </motion.form>
              ) : (
                <motion.form
                  className="login-form"
                  onSubmit={handleCodeLogin}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="input-group">
                    <div>
                      <div className="input-label">邮箱地址</div>
                      <div className={`input-wrapper input-with-btn ${codeErrors.email ? 'invalid' : ''}`}>
                        <Mail className="input-icon" size={16} />
                        <input
                          name="email"
                          type="email"
                          value={codeForm.email}
                          onChange={handleCodeFormChange}
                          placeholder="请输入邮箱地址"
                          disabled={authenticating}
                          required
                        />
                        <button
                          type="button"
                          className="send-code-btn"
                          onClick={handleSendCode}
                          disabled={sendingCode || countdown > 0 || authenticating}
                        >
                          {sendingCode ? (
                            <Loader2 className="spinner" size={14} />
                          ) : countdown > 0 ? (
                            `${countdown}s`
                          ) : (
                            '发送验证码'
                          )}
                        </button>
                      </div>

                    </div>

                    <div>
                      <div className="input-label">验证码</div>
                      <div className={`input-wrapper ${codeErrors.code ? 'invalid' : ''}`}>
                        <Key className="input-icon" size={16} />
                        <input
                          name="code"
                          value={codeForm.code}
                          onChange={handleCodeFormChange}
                          placeholder="请输入6位验证码"
                          maxLength={6}
                          disabled={authenticating}
                          required
                        />
                      </div>

                    </div>
                  </div>

                  <button type="submit" className="login-btn" disabled={authenticating}>
                    {authenticating ? (
                      <>
                        <Loader2 className="spinner" size={16} />
                        登录中...
                      </>
                    ) : (
                      <>
                        登录
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="register-link">
                    <span>还没有账号？</span>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>
                      立即注册
                    </a>
                  </div>
                </motion.form>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  )
}

export default Login
