import './Table.css'

const Table = ({
  columns,
  data,
  loading = false,
  emptyMessage = '暂无数据',
  className = '',
  onRowClick,
  rowKey = 'id'
}) => {
  if (loading) {
    return (
      <div className={`table-container ${className}`}>
        <div className="table-loading">加载中...</div>
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
