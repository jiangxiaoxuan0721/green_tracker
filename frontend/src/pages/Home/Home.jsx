import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Satellite, Plane, Radio, Map, Database, ClipboardList,
  Cpu, BarChart3, ArrowRight, Layers, ShieldCheck
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/auth/useAuth'
import { fadeInUp, scaleIn, listContainer, listItem } from '@/utils/animations'
import { Button } from '@/components/ui'
import './Home.css'

// 平台能力：均对应系统已实现的模块，未实现的功能不列入
const capabilities = [
  {
    icon: Radio,
    title: '设备接入与状态监控',
    desc: '设备注册与 MQTT 接入，覆盖卫星、无人机、传感器三类设备，支持在线状态查看与启停管理'
  },
  {
    icon: Map,
    title: '地块空间建库',
    desc: '基于 PostGIS 的地块管理，支持地图绘制、坐标纠偏，维护作物类型与面积信息'
  },
  {
    icon: Database,
    title: '多源数据入库',
    desc: 'RGB、近红外、红边、热成像、多光谱图像与视频、环境、土壤数据统一存储与检索'
  },
  {
    icon: ClipboardList,
    title: '采集会话管理',
    desc: '采集任务创建、执行进度监控与归档，关联设备与地块'
  },
  {
    icon: Cpu,
    title: '算法部署与推理',
    desc: '算法包上传、Docker 镜像构建与部署，支持 PyTorch、ONNX 等框架的在线推理'
  },
  {
    icon: BarChart3,
    title: '统计分析与导出',
    desc: '多维度数据检索、趋势图表分析与查询结果导出'
  }
]

const pipeline = [
  { icon: Satellite, label: '空天地采集', items: '卫星 · 无人机 · 地面传感' },
  { icon: Layers, label: '统一数据层', items: 'PostgreSQL + PostGIS 元数据库 · MinIO 对象存储' },
  { icon: ShieldCheck, label: '处理与审计', items: '容器化算法推理 · 图表分析 · 全链路日志' }
]

const Home = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  return (
    <>
      <Navbar />
      <div className="home-page">
        <div className="home-bg-layer" aria-hidden="true" />
        <div className="home-bg-mask" aria-hidden="true" />

        {/* 页面边缘字幕 */}
        <div className="home-edge-caption home-edge-left" aria-hidden="true">云农情监测系统</div>
        <div className="home-edge-caption home-edge-right" aria-hidden="true">云农情监测系统</div>

        {/* 边角装饰线 */}
        <div className="home-frame" aria-hidden="true">
          <span className="frame-corner tl" />
          <span className="frame-corner tr" />
          <span className="frame-corner bl" />
          <span className="frame-corner br" />
        </div>

        <motion.div
          className="home-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          <motion.header
            className="home-hero"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
          >
            <span className="home-eyebrow">设备接入 · 数据管理 · 算法部署 · 审计追溯</span>
            <h1 className="home-title">空天地一体化农作物监测</h1>
            <motion.p
              className="home-subtitle"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
            >
              统一管理卫星、无人机与地面传感设备的数据，覆盖地块建库、采集会话、算法部署与统计分析
            </motion.p>
            <motion.div
              className="home-actions"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.16 }}
            >
              <Button
                variant="primary"
                size="large"
                icon={ArrowRight}
                onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/login')}
              >
                {isAuthenticated ? '进入控制台' : '账号登录'}
              </Button>
              <Button
                variant="outline"
                size="large"
                onClick={() => navigate('/about')}
              >
                平台说明
              </Button>
            </motion.div>
          </motion.header>

          <motion.section
            className="home-section"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            <div className="home-capability-grid">
              {capabilities.map(({ icon: Icon, title, desc }) => (
                <motion.div key={title} className="capability-card" variants={listItem}>
                  <div className="capability-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="home-pipeline"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            {pipeline.map(({ icon: Icon, label, items }) => (
              <motion.div key={label} className="pipeline-item" variants={listItem}>
                <div className="pipeline-head">
                  <Icon size={16} />
                  <span>{label}</span>
                </div>
                <p>{items}</p>
              </motion.div>
            ))}
          </motion.section>

          <motion.footer
            className="home-footer"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            <span>JWT 认证</span>
            <i />
            <span>每用户独立数据库</span>
            <i />
            <span>MQTT 实时回传</span>
            <i />
            <span>审计日志可导出</span>
          </motion.footer>
        </motion.div>
      </div>
    </>
  )
}

export default Home
