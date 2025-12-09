import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import './Home.css'

const Home = () => {
  const navigate = useNavigate()

  return (
    <><Navbar />
    <div className="home-page">
      <section className="hero-section">
        <div className="page-container">
          <div className="hero-content">
            <h1>空天地一体化农作物智能平台</h1>
            <p className="hero-subtitle">
              集成卫星遥感、无人机监测和地面传感器网络，为农业生产提供全方位的数据支持和智能化决策服务
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate('/login')}>
                开始体验
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/about')}>
                了解更多
              </button>
            </div>
          </div>
          <div className="platform-preview">
            <div className="preview-item">
              <div className="preview-icon">🛰️</div>
              <h3>卫星监测</h3>
              <p>高分辨率遥感影像实时监测</p>
            </div>
            <div className="preview-item">
              <div className="preview-icon">🚁</div>
              <h3>无人机巡检</h3>
              <p>精细化作物健康评估</p>
            </div>
            <div className="preview-item">
              <div className="preview-icon">📡</div>
              <h3>地面传感</h3>
              <p>实时数据采集网络</p>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="page-container">
          <div className="section-header">
            <h2>核心功能</h2>
            <p>全方位的智能化农业管理解决方案</p>
          </div>
          <div className="features-grid">
            <div className="card feature-card">
              <div className="feature-icon">🛰️</div>
              <h3>卫星遥感监测</h3>
              <p>利用高分辨率卫星影像，实时监测作物生长状况、土壤湿度和植被覆盖度</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">🚁</div>
              <h3>无人机精准巡检</h3>
              <p>搭载多光谱相机的无人机，进行精细化作物健康评估和病虫害检测</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">📡</div>
              <h3>地面传感器网络</h3>
              <p>部署在农田的各类传感器，实时采集土壤、气象和作物生长数据</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">📊</div>
              <h3>作物生长分析</h3>
              <p>基于AI算法的作物生长模型，提供科学的生长预测和管理建议</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">⚠️</div>
              <h3>病虫害预警</h3>
              <p>智能识别病虫害特征，提前预警并提供防治方案建议</p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">💧</div>
              <h3>精准灌溉决策</h3>
              <p>根据土壤湿度、天气预报和作物需水量，制定最优灌溉方案</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="page-container">
          <div className="section-header">
            <h2>平台数据</h2>
            <p>实时监测数据一目了然</p>
          </div>
          <div className="stats-grid">
            <div className="card stat-card">
              <div className="stat-number">2,456</div>
              <div className="stat-label">监测点位</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">98.5%</div>
              <div className="stat-label">在线率</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">15.2K</div>
              <div className="stat-label">日处理数据</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">24/7</div>
              <div className="stat-label">全天候监控</div>
            </div>
          </div>
        </div>
      </section>

      <section className="technology-section">
        <div className="page-container">
          <div className="section-header">
            <h2>技术架构</h2>
            <p>先进的技术体系支撑智能化农业管理</p>
          </div>
          <div className="tech-layers">
            <div className="card tech-layer">
              <h4>数据采集层</h4>
              <div className="tech-items">
                <span className="tech-tag">卫星数据</span>
                <span className="tech-tag">无人机影像</span>
                <span className="tech-tag">传感器数据</span>
                <span className="tech-tag">气象数据</span>
              </div>
            </div>
            <div className="card tech-layer">
              <h4>数据处理层</h4>
              <div className="tech-items">
                <span className="tech-tag">图像识别</span>
                <span className="tech-tag">数据融合</span>
                <span className="tech-tag">实时分析</span>
                <span className="tech-tag">质量控制</span>
              </div>
            </div>
            <div className="card tech-layer">
              <h4>智能分析层</h4>
              <div className="tech-items">
                <span className="tech-tag">机器学习</span>
                <span className="tech-tag">深度学习</span>
                <span className="tech-tag">预测模型</span>
                <span className="tech-tag">决策支持</span>
              </div>
            </div>
            <div className="card tech-layer">
              <h4>应用服务层</h4>
              <div className="tech-items">
                <span className="tech-tag">Web平台</span>
                <span className="tech-tag">移动应用</span>
                <span className="tech-tag">API接口</span>
                <span className="tech-tag">数据可视化</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div></>
  )
}

export default Home