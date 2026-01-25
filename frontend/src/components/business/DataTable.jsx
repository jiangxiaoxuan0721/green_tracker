import { Table, Button } from '@/components/ui'
import './DataTable.css'

const DataTable = ({
  columns,
  data,
  loading = false,
  emptyMessage = '暂无数据',
  pagination = null,
  onRowClick,
  onRefresh,
  rowKey = 'id',
  className = ''
}) => {
  return (
    <div className={`data-table ${className}`}>
      <div className="data-table-header">
        {onRefresh && (
          <Button size="small" variant="outline" onClick={onRefresh}>
            刷新
          </Button>
        )}
      </div>
      <Table
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        rowKey={rowKey}
      />
      {pagination && (
        <div className="data-table-footer">
          <div className="data-table-pagination">
            <span>共 {pagination.total} 条记录</span>
            <div className="pagination-controls">
              <Button
                size="small"
                variant="ghost"
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
              >
                上一页
              </Button>
              <span className="pagination-info">
                第 {pagination.currentPage} / {Math.ceil(pagination.total / pagination.pageSize)} 页
              </span>
              <Button
                size="small"
                variant="ghost"
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= Math.ceil(pagination.total / pagination.pageSize)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable
