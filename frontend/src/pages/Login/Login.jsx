import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sprout, Lock, Mail, Eye, EyeOff, ArrowRight, 
  Shield, Zap, Cloud, Radio, Loader2
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { useLoginForm } from '@/hooks/auth/useLoginForm'
import useToast from '@/hooks/useToast'
import { Card, ToastContainer } from '@/components/ui'
import { EnhancedLoading } from '@/components/ui/EnhancedLoading'
import { fadeInUp, scaleIn } from '@/utils/animations'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, loading, authenticating } = useAuth()
  const { formData, errors, handleChange, handleSubmit } = useLoginForm(login)
  const { toasts, removeToast, error: showError } = useToast()
  const [showPassword, setShowPassword] = useState(false)

  const handleLoginSuccess = async (e) => {
    e.preventDefault()
    const result = await handleSubmit(e)
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
                <Sprout size={64} />
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
                    <Lock size={24} />
                  </div>
                  <h2>欢迎回来</h2>
                  <p>登录您的账户继续使用</p>
                </motion.div>
                
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
                    <a href="#" className="forgot-password">忘记密码？</a>
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
                  >
                    <Shield size={18} />
                    其他方式登录
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
              <Sprout size={64} />
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
                  <Lock size={24} />
                </div>
                <h2>欢迎回来</h2>
                <p>登录您的账户继续使用</p>
              </motion.div>
              
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
                  <a href="#" className="forgot-password">忘记密码？</a>
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
                >
                  <Shield size={18} />
                  其他方式登录
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
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default Login
