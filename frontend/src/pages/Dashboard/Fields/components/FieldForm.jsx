import { useState, useEffect } from 'react'
import { fieldService } from '@/services/fieldService'
import useToast from '@/hooks/useToast'
import { FormContainer } from '@/components/business'
import { Input, Select, Textarea, ToastContainer } from '@/components/ui'
import { FieldMapPicker } from '@/components/map'
import './FieldForm.css'

const FieldForm = ({ mode, field, onClose, onSuccess, isOpen }) => {
  const { toasts, removeToast, error: showError, success: showSuccess } = useToast()
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
  const [showMap, setShowMap] = useState(false)

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
      // 如果有位置数据，自动展开地图
      if (field.location_wkt) {
        setShowMap(true)
      }
    }
  }, [mode, field])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleMapChange = (wkt) => {
    setFormData(prev => ({ ...prev, location_wkt: wkt }))
  }

  const handleSubmit = async (e) => {
    console.log('[FieldForm] handleSubmit 被调用')
    console.log('[FieldForm] 表单数据:', formData)

    if (!formData.name.trim()) {
      showError('地块名称不能为空')
      return
    }

    if (!formData.location_wkt.trim()) {
      showError('请在地图上选择地块位置')
      return
    }

    try {
      setLoading(true)
      console.log('[FieldForm] 开始调用 API...')

      const submitData = {
        name: formData.name,
        description: formData.description || undefined,
        location_wkt: formData.location_wkt,
        area_m2: formData.area_m2 ? parseFloat(formData.area_m2) : undefined,
        crop_type: formData.crop_type || undefined,
        soil_type: formData.soil_type || undefined,
        irrigation_type: formData.irrigation_type || undefined
      }
      console.log('[FieldForm] 提交数据:', submitData)

      if (mode === 'create') {
        console.log('[FieldForm] 调用 createField...')
        await fieldService.createField(submitData)
        console.log('[FieldForm] createField 成功')
        showSuccess('地块创建成功')
      } else {
        console.log('[FieldForm] 调用 updateField...')
        await fieldService.updateField(field.id, submitData)
        console.log('[FieldForm] updateField 成功')
        showSuccess('地块更新成功')
      }

      console.log('[FieldForm] 调用 onSuccess...')
      onSuccess()
      console.log('[FieldForm] handleSubmit 完成')
    } catch (err) {
      console.error('[FieldForm] 错误:', err)
      showError(err.message || `${mode === 'create' ? '创建' : '更新'}地块失败`)
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
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FormContainer
        isOpen={isOpen}
        onClose={onClose}
        title={mode === 'create' ? '创建地块' : '编辑地块'}
        onSubmit={handleSubmit}
        loading={loading}
        size="large"
        cancelText="取消"
        submitText="提交"
      >

      <Input
        label="地块名称"
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
        rows={2}
      />

      {/* 地图选择器 - 替换原来的WKT输入 */}
      <div className="form-field-group">
        <label className="form-label">
          地块位置 <span className="required">*</span>
        </label>
        <div className="map-toggle">
          <button
            type="button"
            className={`toggle-btn ${showMap ? 'active' : ''}`}
            onClick={() => setShowMap(!showMap)}
          >
            {showMap ? '收起地图' : '在地图上选择位置'}
          </button>
        </div>
        
        {showMap && (
          <div className="map-picker-wrapper">
            <FieldMapPicker
              value={formData.location_wkt}
              onChange={handleMapChange}
              height={350}
            />
          </div>
        )}
        
        {formData.location_wkt && (
          <div className="location-info">
            <span className="location-badge">已设置位置</span>
            <span className="location-type">
              {formData.location_wkt.toUpperCase().startsWith('POLYGON') ? '多边形区域' : '单点位置'}
            </span>
          </div>
        )}
      </div>

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
    </>
  )
}

export default FieldForm
