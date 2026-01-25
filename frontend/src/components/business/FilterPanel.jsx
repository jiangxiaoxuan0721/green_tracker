import { Button, Input, Select } from '@/components/ui'
import './FilterPanel.css'

const FilterPanel = ({ onReset, children, className = '' }) => {
  const handleReset = () => {
    if (onReset) {
      onReset()
    }
  }

  return (
    <div className={`filter-panel ${className}`}>
      {children}
      {onReset && (
        <div className="filter-actions">
          <Button size="small" variant="outline" onClick={handleReset}>
            重置
          </Button>
        </div>
      )}
    </div>
  )
}

export const FilterInput = ({ name, label, ...props }) => {
  return <Input name={name} label={label} {...props} />
}

export const FilterSelect = ({ name, label, options, ...props }) => {
  return <Select name={name} label={label} options={options} {...props} />
}

export default FilterPanel
