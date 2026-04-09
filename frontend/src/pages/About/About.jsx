import { motion } from 'framer-motion'
import { 
  Satellite, Plane, Radio, Brain, Sprout, AlertTriangle, 
  Droplets, TrendingUp, Cloud, Database, Cpu, Wifi 
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { fadeInUp, listContainer, listItem } from '@/utils/animations'
import './About.css'

const About = () => {
  const coreFeatures = [
    { icon: Satellite, text: '卫星遥感监测', color: 'var(--primary-color)' },
    { icon: Plane, text: '无人机精准巡检', color: 'var(--info-color)' },
    { icon: Radio, text: '地面传感器网络', color: 'var(--success-color)' },
    { icon: Brain, text: '作物生长分析', color: 'var(--warning-color)' },
    { icon: AlertTriangle, text: '病虫害预警', color: 'var(--error-color)' },
    { icon: Droplets, text: '精准灌溉决策', color: 'var(--primary-color)' },
    { icon: TrendingUp, text: '产量预测评估', color: 'var(--success-color)' }
  ]

  const techStack = [
    { icon: Cloud, label: '卫星数据处理' },
    { icon: Cpu, label: 'AI图像识别' },
    { icon: Wifi, label: '物联网传感' },
    { icon: Database, label: '大数据分析' },
    { icon: Cloud, label: '云计算' }
  ]

  return (
    <>
      <Navbar />
      <div className="about-container">
        <div className="about-background-pattern"></div>
        <motion.div 
          className="about-content"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <motion.div className="about-header" variants={fadeInUp}>
            <div className="about-logo">
              <Sprout size={48} />
            </div>
            <h1>关于平台</h1>
            <p className="about-intro">
              空天地一体化农作物智能平台是一个集卫星遥感、无人机监测和地面传感于一体的
              现代化农业智能管理系统，旨在为农业生产提供全方位的数据支持和决策服务。
            </p>
          </motion.div>

          <motion.div className="about-section" variants={fadeInUp}>
            <h2><Brain size={24} /> 核心功能</h2>
            <motion.div 
              className="features-grid"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
              {coreFeatures.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <motion.div 
                    key={index}
                    className="feature-item"
                    variants={listItem}
                    whileHover={{ y: -5, scale: 1.02 }}
                  >
                    <div className="feature-icon-wrapper" style={{ '--feature-color': feature.color }}>
                      <Icon size={24} />
                    </div>
                    <span className="feature-text">{feature.text}</span>
                  </motion.div>
                )
              })}
            </motion.div>
          </motion.div>

          <motion.div className="about-section" variants={fadeInUp}>
            <h2><Cpu size={24} /> 技术架构</h2>
            <p className="tech-description">
              平台采用多层次的技术架构，集成卫星数据处理、AI图像识别、物联网传感、
              大数据分析和云计算等先进技术，实现农作物全生命周期的智能化管理。
            </p>
            <motion.div 
              className="tech-stack"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
              {techStack.map((tech, index) => {
                const Icon = tech.icon
                return (
                  <motion.div 
                    key={index}
                    className="tech-item"
                    variants={listItem}
                    whileHover={{ y: -3 }}
                  >
                    <Icon size={20} />
                    <span>{tech.label}</span>
                  </motion.div>
                )
              })}
            </motion.div>
          </motion.div>

          <motion.div className="about-section vision-section" variants={fadeInUp}>
            <div className="vision-icon">
              <TrendingUp size={32} />
            </div>
            <h2>愿景使命</h2>
            <p>
              以科技创新推动农业现代化，通过空天地一体化监测体系，
              实现农业生产的精准化、智能化和可持续发展，助力农业数字化转型。
            </p>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default About