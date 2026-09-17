/**
 * 地块表单字段组（纯受控组件）
 * 只负责渲染与回填，校验与提交由外层页面持有。
 */
const FieldFormFields = ({ value, onChange, errors = {}, disabled = false }) => {
  const set = (key) => (e) => onChange({ [key]: e.target.value })

  return (
    <div className="field-form-fields">
      <div className="field-form-row">
        <label htmlFor="field-name">
          名称<span className="required">*</span>
        </label>
        <input
          id="field-name"
          type="text"
          value={value.name ?? ''}
          onChange={set('name')}
          disabled={disabled}
          placeholder="例如：示范田 A 区"
          className={errors.name ? 'input-error' : ''}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="field-form-row">
        <label htmlFor="field-crop">作物类型</label>
        <input
          id="field-crop"
          type="text"
          value={value.crop_type ?? ''}
          onChange={set('crop_type')}
          disabled={disabled}
          placeholder="例如：玉米"
        />
      </div>

      <div className="field-form-row">
        <label htmlFor="field-soil">土壤类型</label>
        <input
          id="field-soil"
          type="text"
          value={value.soil_type ?? ''}
          onChange={set('soil_type')}
          disabled={disabled}
          placeholder="例如：壤土"
        />
      </div>

      <div className="field-form-row">
        <label htmlFor="field-irrigation">灌溉方式</label>
        <input
          id="field-irrigation"
          type="text"
          value={value.irrigation_type ?? ''}
          onChange={set('irrigation_type')}
          disabled={disabled}
          placeholder="例如：滴灌"
        />
      </div>

      <div className="field-form-row">
        <label htmlFor="field-desc">描述</label>
        <textarea
          id="field-desc"
          rows={3}
          value={value.description ?? ''}
          onChange={set('description')}
          disabled={disabled}
          placeholder="补充说明（可选）"
        />
      </div>
    </div>
  )
}

export default FieldFormFields
