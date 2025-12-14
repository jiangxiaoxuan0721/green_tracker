import { useState } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const Fields = () => {
  const [fields] = useState([
    {
      id: 1,
      name: '东区地块A',
      area: '1200 亩',
      crop: '小麦',
      lastUpdate: '2023-06-15 09:30:00',
      health: '良好',
      irrigation: '自动'
    },
    {
      id: 2,
      name: '东区地块B',
      area: '950 亩',
      crop: '玉米',
      lastUpdate: '2023-06-15 09:15:00',
      health: '一般',
      irrigation: '手动'
    },
    {
      id: 3,
      name: '西区地块A',
      area: '2100 亩',
      crop: '水稻',
      lastUpdate: '2023-06-15 09:45:00',
      health: '良好',
      irrigation: '自动'
    }
  ])

  return (
    <div className="dashboard-fields">
      <div className="dashboard-header">
        <h1>地块管理</h1>
        <button className="primary-btn">添加地块</button>
      </div>
      
      <div className="fields-grid">
        {fields.map(field => (
          <div key={field.id} className="field-card">
            <div className="field-header">
              <h3>{field.name}</h3>
              <div className={`health-badge ${field.health === '良好' ? 'good' : field.health === '一般' ? 'average' : 'poor'}`}>
                {field.health}
              </div>
            </div>
            
            <div className="field-info">
              <div className="info-item">
                <span className="info-label">面积</span>
                <span className="info-value">{field.area}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">作物</span>
                <span className="info-value">{field.crop}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">灌溉</span>
                <span className="info-value">{field.irrigation}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">最后更新</span>
                <span className="info-value">{field.lastUpdate}</span>
              </div>
            </div>
            
            <div className="field-actions">
              <button className="secondary-btn">详情</button>
              <button className="secondary-btn">编辑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Fields