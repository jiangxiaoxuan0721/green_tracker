import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sprout, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  Shield, Zap, Cloud, Radio, Loader2, Key
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import useToast from '@/hooks/useToast'
import { Card, ToastContainer } from '@/components/ui'
import { authService } from '@/services/authService'
import { scaleIn } from '@/utils/animations'
import './ForgotPassword.css'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const { toasts, removeToast, success: showSuccess, error: showError } = useToast()
  
  const [step, setStep] = useState(1) // 1: enter email, 2: enter code + new password
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [countdown])

  const handleSendCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      showError('请输入邮箱地址')
      return
    }
    if (!emailRegex.test(email)) {
      showError('请输入有效的邮箱地址')
      return
    }

    setSendingCode(true)
    try {
      await authService.forgotPassword(email)
      showSuccess('验证码已发送，请查收邮件')
      setCountdown(60)
      setStep(2)
    } catch (err) {
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        showError('请求超时，请检查网络后重试')
      } else {
        showError(err?.response?.data?.detail || '验证码发送失败，请稍后重试')
      }
    } finally {
      setSendingCode(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown > 0) return
    setSendingCode(true)
    try {
      await authService.forgotPassword(email)
      showSuccess('验证码已重新发送')
      setCountdown(60)
    } catch (err) {
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        showError('请求超时，请检查网络后重试')
      } else {
        showError(err?.response?.data?.detail || '验证码发送失败，请稍后重试')
      }
    } finally {
      setSendingCode(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()

    if (!code || code.length !== 6) {
      showError('请输入6位验证码')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      showError('密码长度不能少于6位')
      return
    }
    if (newPassword !== confirmPassword) {
      showError('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      await authService.resetPassword({ email, code, new_password: newPassword })
      showSuccess('密码重置成功！即将跳转到登录页...')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      showError(err?.response?.data?.detail || '重置密码失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="forgot-split-container">
        {/* 品牌展示区域 */}
        <motion.div 
          className="forgot-brand-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="brand-content">
            <motion.div 
              className="brand-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Sprout size={48} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Green Tracker
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              空天地一体化农作物智能监测平台
            </motion.p>
          </div>
          
          <motion.div 
            className="brand-features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div 
              className="feature-item"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="feature-icon"><Radio /></div>
              <div>
                <h4>多源感知</h4>
                <p>卫星、无人机、地面传感器全覆盖</p>
              </div>
            </motion.div>
            <motion.div 
              className="feature-item"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <div className="feature-icon"><Cloud /></div>
              <div>
                <h4>智能分析</h4>
                <p>AI 算法实时病虫害识别</p>
              </div>
            </motion.div>
            <motion.div 
              className="feature-item"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="feature-icon"><Zap /></div>
              <div>
                <h4>高效决策</h4>
                <p>科学指导农业生产管理</p>
              </div>
            </motion.div>
          </motion.div>
          
          <div className="brand-decoration">
            <div className="decoration-circle circle-1"></div>
            <div className="decoration-circle circle-2"></div>
            <div className="decoration-circle circle-3"></div>
          </div>
        </motion.div>

        {/* 表单区域 */}
        <motion.div 
          className="forgot-form-panel"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.div
            className="forgot-form-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="forgot-card">
              {/* 步骤指示器 */}
              <div className="steps-bar">
                <div className={`step-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
                  {step > 1 ? '✓' : '1'}
                </div>
                <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
                <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
              </div>

              <motion.div 
                className="forgot-header"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <div className="forgot-icon-wrapper">
                  <Shield size={24} />
                </div>
                <h2>重置密码</h2>
                <p>{step === 1 ? '请输入您的注册邮箱' : '请输入验证码和新密码'}</p>
              </motion.div>

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="input-group">
                      <div>
                        <div className="input-label">注册邮箱</div>
                        <div className="input-wrapper">
                          <Mail className="input-icon" size={18} />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="请输入注册时使用的邮箱"
                            disabled={sendingCode}
                          />
                        </div>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      className="forgot-btn"
                      onClick={handleSendCode}
                      disabled={sendingCode}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {sendingCode ? (
                        <>
                          <Loader2 className="spinner" size={20} />
                          发送中...
                        </>
                      ) : (
                        <>
                          获取验证码
                          <ArrowRight size={18} />
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="step2"
                    className="forgot-form"
                    onSubmit={handleResetPassword}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="input-group">
                      <div>
                        <div className="input-label">验证码</div>
                        <div className="input-wrapper code-input-wrapper">
                          <Key className="input-icon" size={18} />
                          <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="请输入6位验证码"
                            maxLength={6}
                            disabled={submitting}
                            className="code-input"
                          />
                          <button
                            type="button"
                            className={`send-code-btn ${countdown > 0 ? 'counting' : ''}`}
                            onClick={handleResendCode}
                            disabled={sendingCode || countdown > 0}
                          >
                            {sendingCode ? (
                              <><Loader2 className="spinner" size={14} /> 发送中</>
                            ) : countdown > 0 ? (
                              `${countdown}s`
                            ) : (
                              '重新发送'
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="input-label">新密码</div>
                        <div className="input-wrapper">
                          <Lock className="input-icon" size={18} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="请输入新密码（至少6位）"
                            disabled={submitting}
                          />
                          <button 
                            type="button" 
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="input-label">确认密码</div>
                        <div className="input-wrapper">
                          <Lock className="input-icon" size={18} />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="请再次输入新密码"
                            disabled={submitting}
                          />
                          <button 
                            type="button" 
                            className="password-toggle"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      className="forgot-btn"
                      disabled={submitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="spinner" size={20} />
                          重置中...
                        </>
                      ) : (
                        <>
                          重置密码
                          <ArrowRight size={18} />
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="forgot-back-link">
                <motion.a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault()
                    if (step === 2) {
                      setStep(1)
                    } else {
                      navigate('/login')
                    }
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft size={16} />
                  返回登录
                </motion.a>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default ForgotPassword
