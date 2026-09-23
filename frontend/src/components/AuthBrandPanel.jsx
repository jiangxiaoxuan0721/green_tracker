import { Sprout, Radio, Cpu, Database } from 'lucide-react'
import './AuthBrandPanel.css'

// 仅描述平台实际提供的能力，避免无来源的夸大表述
const brandFeatures = [
  { icon: Radio, title: '多源数据接入', desc: '卫星、无人机与地面传感数据统一管理' },
  { icon: Cpu, title: '算法分析', desc: '按任务调用内置算法执行分析' },
  { icon: Database, title: '数据管理', desc: '采集数据查询、统计与导出' }
]

const AuthBrandPanel = () => (
  <aside className="auth-brand-panel">
    <div className="auth-brand-content">
      <div className="auth-brand-icon">
        <Sprout size={26} />
      </div>
      <h1>Green Tracker</h1>
      <p>空天地一体化农作物监测平台</p>
    </div>

    <div className="auth-brand-features">
      {brandFeatures.map(({ icon: Icon, title, desc }) => (
        <div className="auth-feature-item" key={title}>
          <div className="auth-feature-icon">
            <Icon size={16} />
          </div>
          <div>
            <h4>{title}</h4>
            <p>{desc}</p>
          </div>
        </div>
      ))}
    </div>
  </aside>
)

export default AuthBrandPanel
