// 传感器数据表格组件
const SensorDataTable = ({ data }) => {
  return (
    <div className="sensor-data-container">
      <div className="data-table-wrapper">
        <table className="sensor-data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>时间戳</th>
              <th>经度</th>
              <th>纬度</th>
              <th>温度(°C)</th>
              <th>湿度(%)</th>
              <th>pH值</th>
              <th>光照强度</th>
              <th>图片</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{item.id}</td>
                <td>{item.timestamp}</td>
                <td>{item.location.longitude}</td>
                <td>{item.location.latitude}</td>
                <td>{item.temperature}</td>
                <td>{item.humidity}</td>
                <td>{item.ph}</td>
                <td>{item.lightIntensity}</td>
                <td className="image-cell">
                  <a href={item.imagePath} target="_blank" rel="noopener noreferrer" className="image-link">
                    查看图片
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SensorDataTable