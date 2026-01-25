import './About.css'
import Navbar from '@/components/Navbar'
const About = () => {
  return (
    <><Navbar />
    <div className="about-container">
      <div className="about-content">
        <h1>关于我们</h1>
        <p>
          空天地一体化农作物智能平台是一个集卫星遥感、无人机监测和地面传感于一体的
          现代化农业智能管理系统，旨在为农业生产提供全方位的数据支持和决策服务。
        </p>
        <h2>核心功能</h2>
        <ul>
          <li>卫星遥感监测</li>
          <li>无人机精准巡检</li>
          <li>地面传感器网络</li>
          <li>作物生长分析</li>
          <li>病虫害预警</li>
          <li>精准灌溉决策</li>
          <li>产量预测评估</li>
        </ul>
        <h2>技术架构</h2>
        <p>
          平台采用多层次的技术架构，集成卫星数据处理、AI图像识别、物联网传感、
          大数据分析和云计算等先进技术，实现农作物全生命周期的智能化管理。
        </p>
        <h2>愿景使命</h2>
        <p>
          以科技创新推动农业现代化，通过空天地一体化监测体系，
          实现农业生产的精准化、智能化和可持续发展，助力农业数字化转型。
        </p>
      </div>
    </div></>
  )
}

export default About