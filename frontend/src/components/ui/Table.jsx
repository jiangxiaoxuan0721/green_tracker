import './Table.css'

const Table = ({
  columns,
  data,
  loading = false,
  querying = false,
  loadingText,
  emptyMessage = '暂无数据',
  className = '',
  onRowClick,
  rowKey = 'id'
}) => {
  // 查询中（筛选条件变更后等待结果）同样需要展示占位，避免被误读为「无数据」
  const showLoading = loading || querying
  const resolvedLoadingText =
    loadingText || (querying ? '正在查询...' : '正在加载...')

  if (showLoading) {
    return (
      <div
        className={`table-container ${querying ? 'table-querying' : ''} ${className}`.trim()}
        role="status"
        aria-busy="true"
      >
        <div className="table-loading">
          <div className="table-loading-dots">
            <div className="table-loading-dot"></div>
            <div className="table-loading-dot"></div>
            <div className="table-loading-dot"></div>
          </div>
          <div className="table-loading-text">{resolvedLoadingText}</div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`table-container ${className}`}>
        <div className="table-empty">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={`table-wrapper ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} style={column.style}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row[rowKey] || rowIndex}
              onClick={() => onRowClick && onRowClick(row)}
              className={onRowClick ? 'table-row-clickable' : ''}
            >
              {columns.map((column, colIndex) => (
                <td key={colIndex} style={column.style}>
                  {column.render
                    ? column.render(row[column.dataIndex], row, rowIndex)
                    : row[column.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Table
