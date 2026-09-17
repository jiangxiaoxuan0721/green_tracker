import './FieldToolbar.css'

/**
 * 地块工具栏（顶部）
 * 纯展示组件：selectedId / collapsed / drawing 等状态均由页面持有。
 */
const FieldToolbar = ({
  options,
  value,
  onSelect,
  onCreate,
  disabled,
  collapsed,
  onToggleCollapse,
}) => (
  <div className="field-toolbar">
    <select
      className="toolbar-select"
      value={value}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      aria-label="选择地块"
    >
      <option value="">— 选择地块 —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>

    <button className="primary-btn" onClick={onCreate} disabled={disabled}>
      + 新建
    </button>

    <div className="toolbar-spacer" />

    <button
      className="icon-btn"
      onClick={onToggleCollapse}
      title={collapsed ? '展开侧栏' : '收起侧栏'}
      aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
    >
      {collapsed ? '‹' : '›'}
    </button>
  </div>
)

export default FieldToolbar
