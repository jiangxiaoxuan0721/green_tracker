import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  UserPlus, User, Mail, Lock, CheckCircle, 
  ArrowRight, Loader2, Sparkles, ShieldCheck, Leaf
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { useRegisterForm } from '@/hooks/auth/useRegisterForm'
import { Card, ToastContainer } from '@/components/ui'
import useToast from '@/hooks/useToast'
import { fadeInUp, scaleIn } from '@/utils/animations'
import { EnhancedLoading } from '@/components/ui/EnhancedLoading'
import './Register.css'

const Register = () => {
  const navigate = useNavigate()
  const { register, loading, authenticating, error: authError } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useRegisterForm(register)
  const { success: showSuccess, toasts, removeToast } = useToast()
  const [currentStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleRegisterSuccess = async (e) => {
    try {
      const result = await handleSubmit(e)
      if (result.success) {
        showSuccess('注册成功！正在跳转到登录页面...')
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    } catch (error) {
      console.error('注册异常:', error)
    }
  }

  const steps = [
    { number: 1, title: '基本信息', icon: User },
    { number: 2, title: '账号安全', icon: Lock },
    { number: 3, title: '完成注册', icon: CheckCircle }
  ]

  // 认证初始化时显示增强加载状态
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="register-modern-container">
          <div className="register-hero-section">
            <motion.div
              className="hero-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="hero-icon">
                <Leaf size={48} />
              </div>
              <h1>开始您的智慧农业之旅</h1>
              <p>创建账号，解锁空天地一体化监测能力</p>
            </motion.div>
          </div>
          <div className="register-form-section">
            <Card className="register-card">
              <EnhancedLoading 
                text="正在初始化注册系统..." 
                size="medium"
                color="primary"
              />
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
      <div className="register-modern-container">
        {/* 英雄区域 */}
        <motion.div 
          className="register-hero-section"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="hero-content">
            <motion.div 
              className="hero-badge"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles size={16} />
              免费注册
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              加入 Green Tracker
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              空天地一体化农作物智能监测平台
            </motion.p>
            
            <motion.div 
              className="hero-features"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="hero-feature">
                <ShieldCheck size={20} />
                <span>数据安全保障</span>
              </div>
              <div className="hero-feature">
                <Sparkles size={20} />
                <span>免费试用 30 天</span>
              </div>
              <div className="hero-feature">
                <Leaf size={20} />
                <span>全功能开放</span>
              </div>
            </motion.div>
          </div>
          
          <div className="hero-decoration">
            <div className="floating-card card-1">
              <span>🌾</span> 智能监测
            </div>
            <div className="floating-card card-2">
              <span>📡</span> 多源数据
            </div>
            <div className="floating-card card-3">
              <span>🤖</span> AI 分析
            </div>
          </div>
        </motion.div>

        {/* 注册表单区域 */}
        <motion.div 
          className="register-form-section"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="register-card">
            <div className="register-header">
              <motion.div 
                className="register-icon"
                variants={scaleIn}
                initial="hidden"
                animate="visible"
              >
                <UserPlus size={28} />
              </motion.div>
              <h2>创建账号</h2>
              <p>填写以下信息完成注册</p>
            </div>

            {/* 步骤指示器 */}
            <div className="steps-indicator">
              {steps.map((step, index) => (
                <motion.div 
                  key={step.number}
                  className={`step ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <div className="step-circle">
                    {currentStep > step.number ? (
                      <CheckCircle size={18} />
                    ) : (
                      <step.icon size={18} />
                    )}
                  </div>
                  <span className="step-title">{step.title}</span>
                  {index < steps.length - 1 && <div className="step-line" />}
                </motion.div>
              ))}
            </div>

            <motion.form 
              className="register-form" 
              onSubmit={handleRegisterSuccess}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
            >
              <AnimatePresence>
                {(authError || errors.username || errors.email || errors.password || errors.confirmPassword) && (
                  <motion.div 
                    className="error-message"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {authError || errors.username || errors.email || errors.password || errors.confirmPassword}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="input-group">
                {/* 用户名 */}
                <motion.div
                  className="input-item"
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.4 }}
                >
                  <label>用户名</label>
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
                  {errors.username && (
                    <span className="field-error">{errors.username}</span>
                  )}
                </motion.div>
                
                {/* 邮箱 */}
                <motion.div
                  className="input-item"
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.5 }}
                >
                  <label>邮箱</label>
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
                  {errors.email && (
                    <span className="field-error">{errors.email}</span>
                  )}
                </motion.div>
                
                {/* 密码 */}
                <motion.div
                  className="input-item"
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.6 }}
                >
                  <label>密码</label>
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
                      {showPassword ? '隐藏' : '显示'}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="field-error">{errors.password}</span>
                  )}
                </motion.div>
                
                {/* 确认密码 */}
                <motion.div
                  className="input-item"
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.7 }}
                >
                  <label>确认密码</label>
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
                      {showConfirmPassword ? '隐藏' : '显示'}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <span className="field-error">{errors.confirmPassword}</span>
                  )}
                </motion.div>
              </div>

              <motion.button
                type="submit"
                className="register-btn"
                disabled={authenticating}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.8 }}
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

              <div className="login-link">
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
              </div>
            </motion.form>

            <div className="register-footer">
              <p>注册即表示您同意我们的 <a href="#">服务条款</a> 和 <a href="#">隐私政策</a></p>
            </div>
          </Card>
        </motion.div>
      </div>
    </>
  )
}

export default Register
