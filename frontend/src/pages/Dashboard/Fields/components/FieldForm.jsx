import { useState, useEffect } from 'react'
import { fieldService } from '../../../../services/fieldService'

const FieldForm = ({ mode, field, onClose, onSuccess }) => {
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

  // 初始化表单数据
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

  // 处理输入变化
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 处理表单提交
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 简单验证
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
      
      // 准备提交数据
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
        alert('地块创建成功')
      } else {
        await fieldService.updateField(field.id, submitData)
        alert('地块更新成功')
      }
      
      onSuccess()
    } catch (err) {
      setError(err.message || `${mode === 'create' ? '创建' : '更新'}地块失败`)
      console.error(`${mode === 'create' ? '创建' : '更新'}地块失败:`, err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{mode === 'create' ? '创建地块' : '编辑地块'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit} className="field-form">
            <div className="form-group">
              <label htmlFor="name">地块名称 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">描述</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="location_wkt">位置信息 (WKT格式) *</label>
              <textarea
                id="location_wkt"
                name="location_wkt"
                value={formData.location_wkt}
                onChange={handleChange}
                rows={4}
                placeholder="POLYGON((经度1 纬度1, 经度2 纬度2, ...))"
                required
              />
              <small className="form-help">
                请输入Well-Known Text (WKT)格式的地理信息，例如：POLYGON((116.3 39.9, 116.4 39.9, 116.4 40.0, 116.3 40.0, 116.3 39.9))
              </small>
            </div>
            
            <div className="form-group">
              <label htmlFor="area_m2">面积 (平方米)</label>
              <input
                type="number"
                id="area_m2"
                name="area_m2"
                value={formData.area_m2}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="crop_type">作物类型</label>
              <select
                id="crop_type"
                name="crop_type"
                value={formData.crop_type}
                onChange={handleChange}
              >
                <option value="">请选择</option>
                <option value="水稻">水稻</option>
                <option value="小麦">小麦</option>
                <option value="玉米">玉米</option>
                <option value="大豆">大豆</option>
                <option value="棉花">棉花</option>
                <option value="蔬菜">蔬菜</option>
                <option value="水果">水果</option>
                <option value="其他">其他</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="soil_type">土壤类型</label>
              <select
                id="soil_type"
                name="soil_type"
                value={formData.soil_type}
                onChange={handleChange}
              >
                <option value="">请选择</option>
                <option value="沙土">沙土</option>
                <option value="壤土">壤土</option>
                <option value="黏土">黏土</option>
                <option value="砂壤土">砂壤土</option>
                <option value="其他">其他</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="irrigation_type">灌溉方式</label>
              <select
                id="irrigation_type"
                name="irrigation_type"
                value={formData.irrigation_type}
                onChange={handleChange}
              >
                <option value="">请选择</option>
                <option value="自动灌溉">自动灌溉</option>
                <option value="手动灌溉">手动灌溉</option>
                <option value="滴灌">滴灌</option>
                <option value="喷灌">喷灌</option>
                <option value="漫灌">漫灌</option>
                <option value="无">无</option>
              </select>
            </div>
            
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? '处理中...' : (mode === 'create' ? '创建' : '更新')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default FieldForm