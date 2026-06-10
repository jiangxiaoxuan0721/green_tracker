import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sprout, User, Mail, Lock, Eye, EyeOff,
  ArrowRight, Loader2, Radio, Cloud, Zap, Key
} from 'lucide-react'
import Navbar from '@/components/Navbar'
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
  const { success: showSuccess, error: showError, toasts, removeToast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

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
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
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

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="register-split-container">
          <div className="register-brand-panel">
            <motion.div 
              className="brand-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="brand-icon">
                <Sprout size={48} />
              </div>
              <h1>Green Tracker</h1>
              <p>空天地一体化农作物智能监测平台</p>
            </motion.div>
            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-icon"><Radio /></div>
                <div><h4>多源感知</h4><p>卫星、无人机、地面传感器全覆盖</p></div>
              </div>
              <div className="feature-item">
                <div className="feature-icon"><Cloud /></div>
                <div><h4>智能分析</h4><p>AI 算法实时病虫害识别</p></div>
              </div>
              <div className="feature-item">
                <div className="feature-icon"><Zap /></div>
                <div><h4>高效决策</h4><p>科学指导农业生产管理</p></div>
              </div>
            </div>
          </div>
          <div className="register-form-panel">
            <motion.div
              className="register-form-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="register-card">
                <EnhancedLoading 
                  text="正在初始化注册系统..." 
                  size="medium"
                  color="primary"
                />
              </Card>
            </motion.div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="register-split-container">
        {/* 品牌展示区域 - 与登录页一致 */}
        <motion.div 
          className="register-brand-panel"
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

        {/* 注册表单区域 */}
        <motion.div 
          className="register-form-panel"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.div
            className="register-form-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="register-card">
              <motion.div 
                className="register-header"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <div className="register-icon-wrapper">
                  <User size={24} />
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
                transition={{ delay: 0.4 }}
              >
                <AnimatePresence>
                  {authError && (
                    <motion.div 
                      className="error-message"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {authError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="input-group">
                  {/* 用户名 */}
                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.5 }}
                  >
                    <div className="input-label">用户名</div>
                    <div className="input-wrapper">
                      <User className="input-icon" size={18} />
                      <input
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="请输入用户名"
                        disabled={authenticating}
                        required
                      />
                    </div>
                    <AnimatePresence>
                      {errors.username && (
                        <motion.div
                          className="error-message"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {errors.username}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  {/* 邮箱 */}
                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.55 }}
                  >
                    <div className="input-label">邮箱</div>
                    <div className="input-wrapper">
                      <Mail className="input-icon" size={18} />
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
                    <AnimatePresence>
                      {errors.email && (
                        <motion.div
                          className="error-message"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {errors.email}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* 验证码 */}
                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.6 }}
                  >
                    <div className="input-label">邮箱验证码</div>
                    <div className="input-wrapper code-input-wrapper">
                      <Key className="input-icon" size={18} />
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
                    <AnimatePresence>
                      {errors.code && (
                        <motion.div
                          className="error-message"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {errors.code}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  {/* 密码 */}
                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.65 }}
                  >
                    <div className="input-label">密码</div>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="请输入密码（至少6位）"
                        disabled={authenticating}
                        required
                      />
                      <button 
                        type="button" 
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {errors.password && (
                        <motion.div
                          className="error-message"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {errors.password}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  {/* 确认密码 */}
                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.7 }}
                  >
                    <div className="input-label">确认密码</div>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
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
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {errors.confirmPassword && (
                        <motion.div
                          className="error-message"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {errors.confirmPassword}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                <motion.div
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.75 }}
                >
                  <motion.button
                    type="submit"
                    className="register-btn"
                    disabled={authenticating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {authenticating ? (
                      <>
                        <Loader2 className="spinner" size={20} />
                        注册中...
                      </>
                    ) : (
                      <>
                        立即注册
                        <ArrowRight size={18} />
                      </>
                    )}
                  </motion.button>
                </motion.div>

                <motion.div 
                  className="login-link"
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.8 }}
                >
                  <span>已有账号？</span>
                  <motion.a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/login');
                    }} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    去登录
                  </motion.a>
                </motion.div>
              </motion.form>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default Register
