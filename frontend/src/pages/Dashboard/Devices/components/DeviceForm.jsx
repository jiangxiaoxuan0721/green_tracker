import { useState, useEffect } from 'react'
import { deviceService } from '../../../../services/deviceService'
import { Modal } from '../../components'

const DeviceForm = ({ mode, device, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    device_type: '',
    platform_level: '',
    model: '',
    manufacturer: '',
    description: '',
    sensors: {},
    actuators: {}
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 设备类型选项
  const deviceTypeOptions = [
    { value: 'satellite', label: '卫星' },
    { value: 'uav', label: '无人机' },
    { value: 'ugv', label: '地面车' },
    { value: 'robot', label: '机器人' },
    { value: 'sensor', label: '传感器' }
  ]

  // 平台层级选项
  const platformLevelOptions = [
    { value: '天', label: '天基' },
    { value: '空', label: '空基' },
    { value: '地', label: '地基' },
    { value: '具身', label: '具身智能' }
  ]

  // 传感器选项
  const sensorOptions = [
    { key: 'RGB', label: 'RGB相机' },
    { key: 'multispectral', label: '多光谱' },
    { key: 'thermal', label: '热成像' },
    { key: 'nir', label: '近红外' },
    { key: 'lidar', label: '激光雷达' },
    { key: 'soil_moisture', label: '土壤湿度' },
    { key: 'soil_temp', label: '土壤温度' },
    { key: 'air_temp', label: '空气温度' },
    { key: 'humidity', label: '湿度' }
  ]

  // 执行机构选项
  const actuatorOptions = [
    { key: 'flight', label: '飞行控制' },
    { key: 'wheels', label: '轮式移动' },
    { key: 'tracks', label: '履带移动' },
    { key: 'arm', label: '机械臂' },
    { key: 'spray', label: '喷洒系统' },
    { key: 'irrigation', label: '灌溉控制' }
  ]

  // 初始化表单数据
  useEffect(() => {
    if (mode === 'edit' && device) {
      setFormData({
        device_type: device.device_type || '',
        platform_level: device.platform_level || '',
        model: device.model || '',
        manufacturer: device.manufacturer || '',
        description: device.description || '',
        sensors: device.sensors || {},
        actuators: device.actuators || {}
      })
    }
  }, [mode, device])

  // 处理输入变化
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 处理传感器复选框变化
  const handleSensorChange = (sensorKey) => {
    setFormData(prev => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [sensorKey]: !prev.sensors[sensorKey]
      }
    }))
  }

  // 处理执行机构复选框变化
  const handleActuatorChange = (actuatorKey) => {
    setFormData(prev => ({
      ...prev,
      actuators: {
        ...prev.actuators,
        [actuatorKey]: !prev.actuators[actuatorKey]
      }
    }))
  }

  // 处理表单提交
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 简单验证
    if (!formData.device_type.trim()) {
      setError('设备类型不能为空')
      return
    }
    
    if (!formData.platform_level.trim()) {
      setError('平台层级不能为空')
      return
    }
    
    try {
      setLoading(true)
      setError('')
      
      // 准备提交数据
      const submitData = {
        ...formData,
        // 移除空值
        model: formData.model || undefined,
        manufacturer: formData.manufacturer || undefined,
        description: formData.description || undefined,
        // 只包含启用的传感器和执行机构
        sensors: Object.fromEntries(
          Object.entries(formData.sensors).filter(([_, enabled]) => enabled)
        ),
        actuators: Object.fromEntries(
          Object.entries(formData.actuators).filter(([_, enabled]) => enabled)
        )
      }

      if (mode === 'create') {
        await deviceService.createDevice(submitData)
      } else {
        await deviceService.updateDevice(device.id, submitData)
      }
      
      onSuccess()
    } catch (err) {
      setError(err.message || `${mode === 'create' ? '创建' : '更新'}设备失败`)
      console.error(`${mode === 'create' ? '创建' : '更新'}设备失败:`, err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`${mode === 'create' ? '添加' : '编辑'}设备`}
      onClose={onClose}
      className="device-form-modal"
    >
      <form className="device-form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="device_type">设备类型 *</label>
          <select
            id="device_type"
            name="device_type"
            value={formData.device_type}
            onChange={handleChange}
            required
          >
            <option value="">请选择设备类型</option>
            {deviceTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="platform_level">平台层级 *</label>
          <select
            id="platform_level"
            name="platform_level"
            value={formData.platform_level}
            onChange={handleChange}
            required
          >
            <option value="">请选择平台层级</option>
            {platformLevelOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="model">设备型号</label>
          <input
            id="model"
            name="model"
            type="text"
            value={formData.model}
            onChange={handleChange}
            placeholder="例如：DJI M300"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="manufacturer">制造商</label>
          <input
            id="manufacturer"
            name="manufacturer"
            type="text"
            value={formData.manufacturer}
            onChange={handleChange}
            placeholder="例如：大疆"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">设备说明</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            placeholder="设备的详细描述或用途"
          />
        </div>
        
        <div className="form-group">
          <label>传感器配置</label>
          <div className="checkbox-group">
            {sensorOptions.map(option => (
              <div key={option.key} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`sensor-${option.key}`}
                  checked={!!formData.sensors[option.key]}
                  onChange={() => handleSensorChange(option.key)}
                />
                <label htmlFor={`sensor-${option.key}`}>{option.label}</label>
              </div>
            ))}
          </div>
          <div className="form-help">选择设备具备的传感器类型</div>
        </div>
        
        <div className="form-group">
          <label>执行机构配置</label>
          <div className="checkbox-group">
            {actuatorOptions.map(option => (
              <div key={option.key} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`actuator-${option.key}`}
                  checked={!!formData.actuators[option.key]}
                  onChange={() => handleActuatorChange(option.key)}
                />
                <label htmlFor={`actuator-${option.key}`}>{option.label}</label>
              </div>
            ))}
          </div>
          <div className="form-help">选择设备具备的执行机构类型</div>
        </div>
        
        <div className="form-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading ? '保存中...' : mode === 'create' ? '添加' : '更新'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default DeviceForm