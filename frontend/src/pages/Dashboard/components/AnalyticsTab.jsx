import ChartPlaceholder from './ChartPlaceholder'

const AnalyticsTab = () => {
  return (
    <>
      <div className="tab-header">
        <h2>数据分析</h2>
        <div className="tab-buttons">
          <button className="tab-btn active">数据概览</button>
          <button className="tab-btn">趋势分析</button>
          <button className="tab-btn">自定义报表</button>
        </div>
      </div>
      
      <ChartPlaceholder 
        title="数据分析图表" 
        description="数据分析可视化图表将在此显示" 
      />
    </>
  )
}

export default AnalyticsTab