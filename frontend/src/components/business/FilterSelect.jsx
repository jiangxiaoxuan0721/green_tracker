import { Select } from '@/components/ui'

const FilterSelect = ({ label, name, value, onChange, options, ...props }) => {
  return (
    <div className="filter-select-group">
      {label && <label>{label}</label>}
      <Select
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        placeholder=""  // 不显示默认占位符选项
        {...props}
      />
    </div>
  )
}

export default FilterSelect
