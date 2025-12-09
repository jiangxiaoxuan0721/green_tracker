import SensorDataTable from './SensorDataTable'

const DataTab = ({ sensorData }) => {
  return (
    <>
      <div className="tab-header">
        <h2>数据查看</h2>
        <div className="tab-buttons">
          <button className="tab-btn active">传感器数据</button>
          <button className="tab-btn">历史数据</button>
          <button className="tab-btn">数据导出</button>
        </div>
      </div>
      
      <SensorDataTable data={sensorData} />
    </>
  )
}

export default DataTab