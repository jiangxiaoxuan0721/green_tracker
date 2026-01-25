import './Textarea.css'

const Textarea = ({
  label,
  id,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error = '',
  rows = 4,
  className = '',
  ...props
}) => {
  const textareaId = id || name

  return (
    <div className={`textarea-group ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="textarea-label">
          {label}
          {required && <span className="textarea-required">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={`textarea-field ${error ? 'textarea-error' : ''}`}
        {...props}
      />
      {error && <span className="textarea-error-message">{error}</span>}
    </div>
  )
}

export default Textarea
