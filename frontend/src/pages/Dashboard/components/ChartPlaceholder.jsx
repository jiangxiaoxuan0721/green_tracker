// 通用图表占位符组件
const ChartPlaceholder = ({ title, description }) => {
  return (
    <div className="chart-container">
      <div className="chart-placeholder">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default ChartPlaceholder