import { useState, useEffect } from 'react'
import { fieldService } from '@/services/fieldService'
import { FormContainer } from '@/components/business'
import { Input, Select, Textarea } from '@/components/ui'

const FieldForm = ({ mode, field, onClose, onSuccess, isOpen }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location_wkt: '',
    area_m2: '',
    crop_type: '',
    soil_type: '',
    irrigation_type: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode === 'edit' && field) {
      setFormData({
        name: field.name || '',
        description: field.description || '',
        location_wkt: field.location_wkt || '',
        area_m2: field.area_m2 ? field.area_m2.toString() : '',
        crop_type: field.crop_type || '',
        soil_type: field.soil_type || '',
        irrigation_type: field.irrigation_type || ''
      })
    }
  }, [mode, field])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('地块名称不能为空')
      return
    }

    if (!formData.location_wkt.trim()) {
      setError('地块位置信息不能为空')
      return
    }

    try {
      setLoading(true)
      setError('')

      const submitData = {
        name: formData.name,
        description: formData.description || undefined,
        location_wkt: formData.location_wkt,
        area_m2: formData.area_m2 ? parseFloat(formData.area_m2) : undefined,
        crop_type: formData.crop_type || undefined,
        soil_type: formData.soil_type || undefined,
        irrigation_type: formData.irrigation_type || undefined
      }

      if (mode === 'create') {
        await fieldService.createField(submitData)
      } else {
        await fieldService.updateField(field.id, submitData)
      }

      onSuccess()
    } catch (err) {
      setError(err.message || `${mode === 'create' ? '创建' : '更新'}地块失败`)
    } finally {
      setLoading(false)
    }
  }

  const cropTypeOptions = [
    { value: '水稻', label: '水稻' },
    { value: '小麦', label: '小麦' },
    { value: '玉米', label: '玉米' },
    { value: '大豆', label: '大豆' },
    { value: '棉花', label: '棉花' },
    { value: '蔬菜', label: '蔬菜' },
    { value: '水果', label: '水果' },
    { value: '其他', label: '其他' }
  ]

  const soilTypeOptions = [
    { value: '沙土', label: '沙土' },
    { value: '壤土', label: '壤土' },
    { value: '黏土', label: '黏土' },
    { value: '砂壤土', label: '砂壤土' },
    { value: '其他', label: '其他' }
  ]

  const irrigationTypeOptions = [
    { value: '喷灌', label: '喷灌' },
    { value: '滴灌', label: '滴灌' },
    { value: '漫灌', label: '漫灌' },
    { value: '无', label: '无' }
  ]

  return (
    <FormContainer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? '创建地块' : '编辑地块'}
      onSubmit={handleSubmit}
      loading={loading}
      size="medium"
      cancelText="取消"
      submitText="提交"
    >
      {error && <div className="form-error-message">{error}</div>}

      <Input
        label="地块名称 *"
        id="name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />

      <Textarea
        label="描述"
        id="description"
        name="description"
        value={formData.description}
        onChange={handleChange}
        rows={3}
      />

      <Textarea
        label="位置信息 (WKT格式) *"
        id="location_wkt"
        name="location_wkt"
        value={formData.location_wkt}
        onChange={handleChange}
        rows={4}
        placeholder="POLYGON((经度1 纬度1, 经度2 纬度2, ...))"
        required
      />

      <Input
        label="面积 (平方米)"
        id="area_m2"
        name="area_m2"
        type="number"
        value={formData.area_m2}
        onChange={handleChange}
        step="0.01"
        min="0"
      />

      <Select
        label="作物类型"
        id="crop_type"
        name="crop_type"
        value={formData.crop_type}
        onChange={handleChange}
        options={cropTypeOptions}
      />

      <Select
        label="土壤类型"
        id="soil_type"
        name="soil_type"
        value={formData.soil_type}
        onChange={handleChange}
        options={soilTypeOptions}
      />

      <Select
        label="灌溉类型"
        id="irrigation_type"
        name="irrigation_type"
        value={formData.irrigation_type}
        onChange={handleChange}
        options={irrigationTypeOptions}
      />
    </FormContainer>
  )
}

export default FieldForm
