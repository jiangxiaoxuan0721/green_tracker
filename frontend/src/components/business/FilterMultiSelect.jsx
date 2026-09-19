import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import './FilterMultiSelect.css'

/**
 * 筛选面板内的多选下拉控件（select_group 风格）
 *
 * 约定：空数组表示「不限」，等价于全选，这样未做任何选择时不过滤任何数据。
 *
 * @param {string} label - 分组标题
 * @param {Array} value - 已选 value 列表
 * @param {Array<{value: string, label: string}>} options - 可选项
 * @param {(next: string[]) => void} onChange - 选中项变化回调
 */
const FilterMultiSelect = ({
  label,
  value = [],
  options = [],
  onChange,
  disabled = false,
  className = ''
}) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // 点击外部 / Esc 关闭下拉
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const total = options.length
  const selectedCount = value.filter(v => options.some(o => o.value === v)).length
  // 空选与全选等价，统一展示为「不限」
  const unlimited = selectedCount === 0 || selectedCount === total

  const summary = total === 0
    ? '暂无可选项'
    : unlimited
      ? `不限（${total} 项）`
      : `已选 ${selectedCount}/${total}`

  const toggleValue = (target) => {
    if (!onChange) return
    onChange(value.includes(target) ? value.filter(v => v !== target) : [...value, target])
  }

  return (
    <div
      className={`filter-multiselect ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      ref={rootRef}
    >
      {label && <span className="filter-multiselect-label">{label}</span>}

      <button
        type="button"
        className={`filter-multiselect-trigger ${open ? 'is-open' : ''}`}
        disabled={disabled || total === 0}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="filter-multiselect-summary">{summary}</span>
        <ChevronDown size={14} className="filter-multiselect-caret" />
      </button>

      {open && total > 0 && (
        <div className="filter-multiselect-panel" role="listbox">
          <div className="filter-multiselect-actions">
            <button
              type="button"
              className="filter-multiselect-action"
              onClick={() => onChange && onChange(options.map(o => o.value))}
            >
              全选
            </button>
            <button
              type="button"
              className="filter-multiselect-action"
              onClick={() => onChange && onChange([])}
            >
              不限
            </button>
          </div>
          <div className="filter-multiselect-list">
            {options.map(option => (
              <label key={option.value} className="filter-multiselect-option">
                <input
                  type="checkbox"
                  checked={value.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                />
                <span className="filter-multiselect-option-text" title={option.label}>
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterMultiSelect
