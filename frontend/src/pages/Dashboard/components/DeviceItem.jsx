// 通用设备项组件
const DeviceItem = ({ device }) => {
  return (
    <div className="device-item">
      <div className="device-info">
        <h3>{device.name}</h3>
        <p>位置: {device.location}</p>
        <p>最后更新: {device.lastUpdate}</p>
      </div>
      <div className={`device-status ${device.status}`}>
        {device.status === 'online' ? '在线' : '离线'}
      </div>
    </div>
  )
}

export default DeviceItem