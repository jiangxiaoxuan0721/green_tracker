import './Select.css'

const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = '请选择',
  required = false,
  disabled = false,
  error = '',
  className = '',
  ...props
}) => {
  const selectId = id || name

  return (
    <div className={`select-group ${className}`}>
      {label && (
        <label htmlFor={selectId} className="select-label">
          {label}
          {required && <span className="select-required">*</span>}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`select-field ${error ? 'select-error' : ''}`}
        {...props}
      >
        {!required && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="select-error-message">{error}</span>}
    </div>
  )
}

export default Select
