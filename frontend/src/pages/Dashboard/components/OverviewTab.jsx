import StatusCard from './StatusCard'
import ChartPlaceholder from './ChartPlaceholder'

const OverviewTab = () => {
  return (
    <>
      <div className="tab-header">
        <h2>系统概览</h2>
        <div className="tab-buttons">
          <button className="tab-btn active">系统状态</button>
          <button className="tab-btn">数据趋势</button>
          <button className="tab-btn">告警分析</button>
        </div>
      </div>
      
      <div className="overview-cards">
        <StatusCard 
          title="在线设备" 
          value="24" 
          status="正常运行" 
        />
        <StatusCard 
          title="数据传输" 
          value="1.2GB" 
          status="今日" 
        />
        <StatusCard 
          title="系统负载" 
          value="32%" 
          status="健康" 
        />
        <StatusCard 
          title="告警数量" 
          value="3" 
          status="需要关注" 
          statusType="warning" 
        />
      </div>
      
      <ChartPlaceholder 
        title="设备状态趋势图" 
        description="数据图表将在此显示" 
      />
    </>
  )
}

export default OverviewTab