const Checkbox = ({ id, checked, onChange, label, className = '' }) => {
  return (
    <div className={`checkbox-wrapper ${className}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="checkbox-input"
      />
      <label htmlFor={id} className="checkbox-label">
        <span className="checkmark"></span>
        <span className="checkbox-text">{label}</span>
      </label>
    </div>
  )
}

export default Checkbox
