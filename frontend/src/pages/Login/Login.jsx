import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sprout, Lock, Mail, Eye, EyeOff, ArrowRight, 
  Zap, Cloud, Radio, Loader2, Key, Send
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { useLoginForm } from '@/hooks/auth/useLoginForm'
import useToast from '@/hooks/useToast'
import { authService } from '@/services/authService'
import { Card, ToastContainer } from '@/components/ui'
import { EnhancedLoading } from '@/components/ui/EnhancedLoading'
import { fadeInUp, scaleIn } from '@/utils/animations'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, loginByCode, loading, authenticating } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useLoginForm(login)
  const { toasts, removeToast, error: showError, success: showSuccess } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loginMode, setLoginMode] = useState('password') // 'password' | 'code'

  // 验证码登录表单状态
  const [codeForm, setCodeForm] = useState({ email: '', code: '' })
  const [codeErrors, setCodeErrors] = useState({})
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(null)

  const handleLoginSuccess = async (e) => {
    e.preventDefault()
    const result = await handleSubmit(e)
    if (result.success) {
      navigate('/dashboard')
    } else if (result.error) {
      showError(result.error)
    }
  }

  // 切换登录模式
  const switchToCodeMode = () => {
    setLoginMode('code')
    setCodeErrors({})
  }

  const switchToPasswordMode = () => {
    setLoginMode('password')
    setCodeErrors({})
  }

  // 验证码表单变更
  const handleCodeFormChange = (e) => {
    const { name, value } = e.target
    setCodeForm(prev => ({ ...prev, [name]: value }))
    // 清除对应字段错误
    if (codeErrors[name]) {
      setCodeErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // 发送验证码
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

  // 验证码登录提交
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
      return
    }

    const result = await loginByCode(codeForm.email, codeForm.code)
    if (result.success) {
      navigate('/dashboard')
    } else if (result.error) {
      showError(result.error)
    }
  }

  // 认证初始化时显示增强加载状态
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="login-split-container">
          <div className="login-brand-panel">
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
              <motion.div 
                className="feature-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="feature-icon"><Radio /></div>
                <div>
                  <h4>多源感知</h4>
                  <p>卫星、无人机、地面传感器全覆盖</p>
                </div>
              </motion.div>
              <motion.div 
                className="feature-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="feature-icon"><Cloud /></div>
                <div>
                  <h4>智能分析</h4>
                  <p>AI 算法实时病虫害识别</p>
                </div>
              </motion.div>
              <motion.div 
                className="feature-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="feature-icon"><Zap /></div>
                <div>
                  <h4>高效决策</h4>
                  <p>科学指导农业生产管理</p>
                </div>
              </motion.div>
            </div>
          </div>
          <div className="login-form-panel">
            <motion.div
              className="login-form-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
            <Card className="login-card">
              <motion.div 
                className="login-header"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <div className="login-icon-wrapper">
                  {loginMode === 'password' ? <Lock size={20} /> : <Mail size={20} />}
                </div>
                <h2>欢迎回来</h2>
                <p>{loginMode === 'password' ? '登录您的账户继续使用' : '使用邮箱验证码快速登录'}</p>
              </motion.div>
              
              {/* 密码登录表单 */}
              {loginMode === 'password' && (
                <motion.form 
                  className="login-form" 
                  onSubmit={handleLoginSuccess}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1 }}
                >
                  <div className="input-group">
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.2 }}
                    >
                      <div className="input-label">用户名</div>
                      <div className="input-wrapper">
                        <Mail className="input-icon" size={18} />
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
                    
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.3 }}
                    >
                      <div className="input-label">密码</div>
                      <div className="input-wrapper">
                        <Lock className="input-icon" size={18} />
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
                  </div>

                  <div className="login-options">
                    <label className="remember-me">
                      <input type="checkbox" />
                      <span>记住我</span>
                    </label>
                    <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>忘记密码？</a>
                  </div>

                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.4 }}
                  >
                    <motion.button
                      type="submit"
                      className="login-btn"
                      disabled={authenticating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {authenticating ? (
                        <>
                          <Loader2 className="spinner" size={20} />
                          登录中...
                        </>
                      ) : (
                        <>
                          登录
                          <ArrowRight size={16} />
                        </>
                      )}
                    </motion.button>
                  </motion.div>

                  <motion.div 
                    className="login-divider"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.5 }}
                  >
                    <span>或</span>
                  </motion.div>

                  <motion.button
                    type="button"
                    className="social-login-btn"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={switchToCodeMode}
                  >
                    <Send size={16} />
                    邮箱验证码登录
                  </motion.button>

                  <motion.div 
                    className="register-link"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.7 }}
                  >
                    <span>还没有账号？</span>
                    <motion.a 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/register');
                      }} 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      立即注册
                    </motion.a>
                  </motion.div>
                </motion.form>
              )}

              {/* 邮箱验证码登录表单 */}
              {loginMode === 'code' && (
                <motion.form 
                  className="login-form" 
                  onSubmit={handleCodeLogin}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1 }}
                >
                  <div className="input-group">
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.2 }}
                    >
                      <div className="input-label">邮箱地址</div>
                      <div className="input-wrapper input-with-btn">
                        <Mail className="input-icon" size={18} />
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
                      <AnimatePresence>
                        {codeErrors.email && (
                          <motion.div
                            className="error-message"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            {codeErrors.email}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.3 }}
                    >
                      <div className="input-label">验证码</div>
                      <div className="input-wrapper">
                        <Key className="input-icon" size={18} />
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
                      <AnimatePresence>
                        {codeErrors.code && (
                          <motion.div
                            className="error-message"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            {codeErrors.code}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.4 }}
                  >
                    <motion.button
                      type="submit"
                      className="login-btn"
                      disabled={authenticating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {authenticating ? (
                        <>
                          <Loader2 className="spinner" size={20} />
                          登录中...
                        </>
                      ) : (
                        <>
                          登录
                          <ArrowRight size={16} />
                        </>
                      )}
                    </motion.button>
                  </motion.div>

                  <motion.div 
                    className="login-divider"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.5 }}
                  >
                    <span>或</span>
                  </motion.div>

                  <motion.button
                    type="button"
                    className="social-login-btn"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={switchToPasswordMode}
                  >
                    <Lock size={16} />
                    账号密码登录
                  </motion.button>

                  <motion.div 
                    className="register-link"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.7 }}
                  >
                    <span>还没有账号？</span>
                    <motion.a 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/register');
                      }} 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      立即注册
                    </motion.a>
                  </motion.div>
                </motion.form>
              )}
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
      <div className="login-split-container">
        {/* 品牌展示区域 */}
        <motion.div 
          className="login-brand-panel"
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
          
          {/* 动态背景装饰 */}
          <div className="brand-decoration">
            <div className="decoration-circle circle-1"></div>
            <div className="decoration-circle circle-2"></div>
            <div className="decoration-circle circle-3"></div>
          </div>
        </motion.div>

        {/* 登录表单区域 */}
        <motion.div 
          className="login-form-panel"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.div
            className="login-form-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="login-card">
              <motion.div 
                className="login-header"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <div className="login-icon-wrapper">
                  {loginMode === 'password' ? <Lock size={24} /> : <Mail size={24} />}
                </div>
                <h2>欢迎回来</h2>
                <p>{loginMode === 'password' ? '登录您的账户继续使用' : '使用邮箱验证码快速登录'}</p>
              </motion.div>
              
              {/* 密码登录表单 */}
              {loginMode === 'password' && (
                <motion.form 
                  className="login-form" 
                  onSubmit={handleLoginSuccess}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.4 }}
                >
                  <div className="input-group">
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.5 }}
                    >
                      <div className="input-label">用户名</div>
                      <div className="input-wrapper">
                        <Mail className="input-icon" size={18} />
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
                    
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.6 }}
                    >
                      <div className="input-label">密码</div>
                      <div className="input-wrapper">
                        <Lock className="input-icon" size={18} />
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
                  </div>

                  <div className="login-options">
                    <label className="remember-me">
                      <input type="checkbox" />
                      <span>记住我</span>
                    </label>
                    <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>忘记密码？</a>
                  </div>

                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.7 }}
                  >
                    <motion.button
                      type="submit"
                      className="login-btn"
                      disabled={authenticating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {authenticating ? (
                        <>
                          <Loader2 className="spinner" size={20} />
                          登录中...
                        </>
                      ) : (
                        <>
                          登录
                          <ArrowRight size={18} />
                        </>
                      )}
                    </motion.button>
                  </motion.div>

                  <motion.div 
                    className="login-divider"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.8 }}
                  >
                    <span>或</span>
                  </motion.div>

                  <motion.button
                    type="button"
                    className="social-login-btn"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={switchToCodeMode}
                  >
                    <Send size={18} />
                    邮箱验证码登录
                  </motion.button>

                  <motion.div 
                    className="register-link"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 1.0 }}
                  >
                    <span>还没有账号？</span>
                    <motion.a 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/register');
                      }} 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      立即注册
                    </motion.a>
                  </motion.div>
                </motion.form>
              )}

              {/* 邮箱验证码登录表单 */}
              {loginMode === 'code' && (
                <motion.form 
                  className="login-form" 
                  onSubmit={handleCodeLogin}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.4 }}
                >
                  <div className="input-group">
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.5 }}
                    >
                      <div className="input-label">邮箱地址</div>
                      <div className="input-wrapper input-with-btn">
                        <Mail className="input-icon" size={18} />
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
                      <AnimatePresence>
                        {codeErrors.email && (
                          <motion.div
                            className="error-message"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            {codeErrors.email}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.6 }}
                    >
                      <div className="input-label">验证码</div>
                      <div className="input-wrapper">
                        <Key className="input-icon" size={18} />
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
                      <AnimatePresence>
                        {codeErrors.code && (
                          <motion.div
                            className="error-message"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            {codeErrors.code}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.7 }}
                  >
                    <motion.button
                      type="submit"
                      className="login-btn"
                      disabled={authenticating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {authenticating ? (
                        <>
                          <Loader2 className="spinner" size={20} />
                          登录中...
                        </>
                      ) : (
                        <>
                          登录
                          <ArrowRight size={18} />
                        </>
                      )}
                    </motion.button>
                  </motion.div>

                  <motion.div 
                    className="login-divider"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.8 }}
                  >
                    <span>或</span>
                  </motion.div>

                  <motion.button
                    type="button"
                    className="social-login-btn"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={switchToPasswordMode}
                  >
                    <Lock size={18} />
                    账号密码登录
                  </motion.button>

                  <motion.div 
                    className="register-link"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 1.0 }}
                  >
                    <span>还没有账号？</span>
                    <motion.a 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/register');
                      }} 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      立即注册
                    </motion.a>
                  </motion.div>
                </motion.form>
              )}
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default Login
