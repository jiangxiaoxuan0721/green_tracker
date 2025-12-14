import { useState } from 'react'
import '../Dashboard.css'
import '../AdditionalStyles.css'

const DataAnalyze = () => {
  const [analysisType, setAnalysisType] = useState('trend')
  const [timeRange, setTimeRange] = useState('month')
  const [selectedFields, setSelectedFields] = useState(['1', '3'])
  
  const handleAnalysisTypeChange = (e) => {
    setAnalysisType(e.target.value)
  }
  
  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value)
  }
  
  const handleFieldChange = (fieldId) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(id => id !== fieldId))
    } else {
      setSelectedFields([...selectedFields, fieldId])
    }
  }
  
  return (
    <div className="dashboard-data-analyze">
      <div className="dashboard-header">
        <h1>数据分析</h1>
        <button className="primary-btn">生成报告</button>
      </div>
      
      <div className="analysis-controls">
        <div className="control-group">
          <label>分析类型</label>
          <select value={analysisType} onChange={handleAnalysisTypeChange}>
            <option value="trend">趋势分析</option>
            <option value="comparison">对比分析</option>
            <option value="correlation">相关性分析</option>
            <option value="prediction">预测分析</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>时间范围</label>
          <select value={timeRange} onChange={handleTimeRangeChange}>
            <option value="week">最近一周</option>
            <option value="month">最近一月</option>
            <option value="quarter">最近一季</option>
            <option value="year">最近一年</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>选择地块</label>
          <div className="field-selector">
            <div className="field-checkbox">
              <input 
                type="checkbox" 
                id="field1" 
                checked={selectedFields.includes('1')}
                onChange={() => handleFieldChange('1')}
              />
              <label htmlFor="field1">东区地块A</label>
            </div>
            
            <div className="field-checkbox">
              <input 
                type="checkbox" 
                id="field2" 
                checked={selectedFields.includes('2')}
                onChange={() => handleFieldChange('2')}
              />
              <label htmlFor="field2">东区地块B</label>
            </div>
            
            <div className="field-checkbox">
              <input 
                type="checkbox" 
                id="field3" 
                checked={selectedFields.includes('3')}
                onChange={() => handleFieldChange('3')}
              />
              <label htmlFor="field3">西区地块A</label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="analysis-results">
        <div className="chart-container">
          <h3>温度变化趋势</h3>
          <div className="chart-placeholder">
            <p>图表区域 - 这里将显示温度变化趋势</p>
          </div>
        </div>
        
        <div className="chart-container">
          <h3>湿度变化趋势</h3>
          <div className="chart-placeholder">
            <p>图表区域 - 这里将显示湿度变化趋势</p>
          </div>
        </div>
        
        <div className="chart-container">
          <h3>土壤pH值变化趋势</h3>
          <div className="chart-placeholder">
            <p>图表区域 - 这里将显示土壤pH值变化趋势</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataAnalyze