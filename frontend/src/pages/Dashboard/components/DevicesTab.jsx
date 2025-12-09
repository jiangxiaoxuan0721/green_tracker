import DeviceItem from './DeviceItem'

const DevicesTab = ({ devices }) => {
  return (
    <>
      <div className="tab-header">
        <h2>设备管理</h2>
        <div className="tab-buttons">
          <button className="tab-btn active">设备列表</button>
          <button className="tab-btn">设备分组</button>
          <button className="tab-btn">添加设备</button>
        </div>
      </div>
      
      <div className="device-list">
        {devices.map(device => (
          <DeviceItem key={device.id} device={device} />
        ))}
      </div>
    </>
  )
}

export default DevicesTab