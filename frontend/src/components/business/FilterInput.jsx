import { Input } from '@/components/ui'

const FilterInput = ({ label, name, type = 'text', value, onChange, placeholder, ...props }) => {
  return (
    <div className="filter-input-group">
      {label && <label>{label}</label>}
      <Input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
    </div>
  )
}

export default FilterInput
