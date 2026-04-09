import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { fadeInUp, scaleIn, listContainer, listItem } from '@/utils/animations'
import { Button } from '@/components/ui'
import './Home.css'

const Home = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const platformFeatures = [
    {
      icon: '🛰️',
      title: '卫星监测',
      description: '高分辨率遥感影像实时监测',
      color: 'var(--primary-color)',
      delay: 0.1
    },
    {
      icon: '🚁',
      title: '无人机巡检',
      description: '精细化作物健康评估',
      color: 'var(--info-color)',
      delay: 0.2
    },
    {
      icon: '📡',
      title: '地面传感',
      description: '实时数据采集网络',
      color: 'var(--success-color)',
      delay: 0.3
    },
    {
      icon: '🧠',
      title: '智能分析',
      description: 'AI算法驱动的决策支持',
      color: 'var(--warning-color)',
      delay: 0.4
    }
  ]

  return (
    <>
      <Navbar />
      <motion.div 
        className="home-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <section className="hero-section">
          <div className="hero-background-pattern"></div>
          <div className="page-container">
            <div className="hero-content">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={scaleIn}
              >
                <h1>空天地一体化农作物智能平台</h1>
              </motion.div>
              
              <motion.p 
                className="hero-subtitle"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.1 }}
              >
                集成卫星遥感、无人机监测和地面传感器网络，为农业生产提供全方位的数据支持和智能化决策服务
              </motion.p>
              
              <motion.div 
                className="hero-actions"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 }}
              >
                <Button 
                  variant="primary" 
                  size="large"
                  onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/login')}
                  icon="🚀"
                  animateHover
                >
                  {isAuthenticated ? '进入控制台' : '开始体验'}
                </Button>
                <Button 
                  variant="outline" 
                  size="large"
                  onClick={() => navigate('/about')}
                  icon="📚"
                  animateHover
                >
                  了解更多
                </Button>
              </motion.div>
              
              <motion.div 
                className="hero-statistics"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.3 }}
              >
                <div className="stat-item">
                  <div className="stat-number">99%</div>
                  <div className="stat-label">监测准确率</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">24/7</div>
                  <div className="stat-label">实时监控</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">50+</div>
                  <div className="stat-label">智能算法</div>
                </div>
              </motion.div>
            </div>
            
            <motion.div 
              className="platform-preview"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
              {platformFeatures.map((feature, index) => (
                <motion.div 
                  key={index}
                  className="preview-item"
                  variants={listItem}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.97 }}
                  custom={feature.delay}
                  style={{ 
                    '--feature-color': feature.color,
                    '--feature-delay': feature.delay
                  }}
                >
                  <div className="preview-icon-wrapper">
                    <div className="preview-icon" style={{ color: feature.color }}>
                      {feature.icon}
                    </div>
                    <div className="icon-glow" style={{ background: feature.color }}></div>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <div className="preview-hover-line" style={{ background: feature.color }}></div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
        
        <motion.section 
          className="features-section"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <div className="page-container">
            <div className="section-header">
              <h2>为什么选择智能农业平台？</h2>
              <p className="section-subtitle">将先进技术与农业生产相结合，提升效率与产量</p>
            </div>
            
            <div className="features-grid">
              <motion.div
                className="feature-card"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <div className="feature-icon">📊</div>
                <h3>数据驱动决策</h3>
                <p>基于海量数据和多维度分析，提供科学的种植决策建议</p>
              </motion.div>
              
              <motion.div
                className="feature-card"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className="feature-icon">⚡</div>
                <h3>自动预警系统</h3>
                <p>实时监测异常情况，自动预警病虫害和自然灾害</p>
              </motion.div>
              
              <motion.div
                className="feature-card"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <div className="feature-icon">🌱</div>
                <h3>精准农业管理</h3>
                <p>根据作物需求精确调控灌溉、施肥和病虫害防治</p>
              </motion.div>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </>
  )
}

export default Home