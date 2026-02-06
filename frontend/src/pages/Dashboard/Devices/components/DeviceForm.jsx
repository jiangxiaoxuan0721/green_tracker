import { useState, useEffect } from 'react'
import { deviceService } from '@/services/deviceService'
import { Select, Input, Textarea, Checkbox } from '@/components/ui'
import { FormContainer } from '@/components/business'
import './DeviceForm.css'

const DeviceForm = ({ mode, device, onClose, onSuccess, isOpen }) => {
  const [formData, setFormData] = useState({
    name: '',
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

  const deviceTypeOptions = [
    { value: 'satellite', label: '卫星' },
    { value: 'uav', label: '无人机' },
    { value: 'ugv', label: '地面车' },
    { value: 'robot', label: '机器人' },
    { value: 'sensor', label: '传感器' }
  ]

  const platformLevelOptions = [
    { value: '天', label: '天基' },
    { value: '空', label: '空基' },
    { value: '地', label: '地基' },
    { value: '具身', label: '具身智能' }
  ]

  const sensorOptions = [
    { key: 'RGB', label: 'RGB相机' },
    { key: 'multispectral', label: '多光谱' },
    { key: 'thermal', label: '热成像' },
    { key: 'nir', label: '近红外' },
    { key: 'lidar', label: '激光雷达' },
    { key: 'soil_moisture', label: '土壤湿度' },
    { key: 'soil_temp', label: '土壤温度' },
    { key: 'air_temp', label: '空气温度' },
    { key: 'humidity', label: '空气湿度' }
  ]

  const actuatorOptions = [
    { key: 'flight', label: '飞行控制' },
    { key: 'wheels', label: '轮式移动' },
    { key: 'tracks', label: '履带移动' },
    { key: 'arm', label: '机械臂' },
    { key: 'spray', label: '喷洒系统' },
    { key: 'irrigation', label: '灌溉控制' }
  ]

  useEffect(() => {
    if (mode === 'edit' && device) {
      setFormData({
        name: device.name || '',
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSensorChange = (sensorKey) => {
    setFormData(prev => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [sensorKey]: !prev.sensors[sensorKey]
      }
    }))
  }

  const handleActuatorChange = (actuatorKey) => {
    setFormData(prev => ({
      ...prev,
      actuators: {
        ...prev.actuators,
        [actuatorKey]: !prev.actuators[actuatorKey]
      }
    }))
  }

  const handleSubmit = async (e) => {
    if (!formData.name.trim()) {
      setError('设备名称不能为空')
      return
    }

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

      const submitData = {
        ...formData,
        model: formData.model || undefined,
        manufacturer: formData.manufacturer || undefined,
        description: formData.description || undefined,
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormContainer
      isOpen={isOpen}
      onClose={onClose}
      title={`${mode === 'create' ? '添加' : '编辑'}设备`}
      onSubmit={handleSubmit}
      loading={loading}
      size="medium"
      cancelText="取消"
      submitText={mode === 'create' ? '添加' : '更新'}
    >
      {error && (
        <div className="form-error-message">
          {error}
        </div>
      )}

      <Input
        label="设备名称"
        id="name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
        placeholder="例如：多光谱巡检无人机01"
      />

      <Select
        label="设备类型"
        id="device_type"
        name="device_type"
        value={formData.device_type}
        onChange={handleChange}
        options={deviceTypeOptions}
        required
      />

      <Select
        label="平台层级"
        id="platform_level"
        name="platform_level"
        value={formData.platform_level}
        onChange={handleChange}
        options={platformLevelOptions}
        required
      />

      <Input
        label="设备型号"
        id="model"
        name="model"
        value={formData.model}
        onChange={handleChange}
        placeholder="例如：DJI M300"
      />

      <Input
        label="制造商"
        id="manufacturer"
        name="manufacturer"
        value={formData.manufacturer}
        onChange={handleChange}
        placeholder="例如：大疆"
      />

      <Textarea
        label="设备说明"
        id="description"
        name="description"
        value={formData.description}
        onChange={handleChange}
        rows={3}
        placeholder="设备的详细描述或用途"
      />

      <div className="checkbox-section">
        <label className="section-title">传感器配置</label>
        <div className="checkbox-grid">
          {sensorOptions.map(option => (
            <Checkbox
              key={option.key}
              id={`sensor-${option.key}`}
              checked={!!formData.sensors[option.key]}
              onChange={() => handleSensorChange(option.key)}
              label={option.label}
              className="checkbox-card"
            />
          ))}
        </div>
        <div className="form-help">选择设备具备的传感器类型</div>
      </div>

      <div className="checkbox-section">
        <label className="section-title">执行机构配置</label>
        <div className="checkbox-grid">
          {actuatorOptions.map(option => (
            <Checkbox
              key={option.key}
              id={`actuator-${option.key}`}
              checked={!!formData.actuators[option.key]}
              onChange={() => handleActuatorChange(option.key)}
              label={option.label}
              className="checkbox-card"
            />
          ))}
        </div>
        <div className="form-help">选择设备具备的执行机构类型</div>
      </div>
    </FormContainer>
  )
}

export default DeviceForm