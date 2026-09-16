import FieldFormFields from './FieldFormFields'
import './FieldSidePanel.css'

const formatDate = (v) => (v ? new Date(v).toLocaleString() : '—')

const formatArea = (m2) => {
  if (m2 === null || m2 === undefined) return '未知'
  return `${m2.toFixed(0)} m²（${(m2 / 666.6667).toFixed(2)} 亩）`
}

/**
 * 地块侧栏（五态：empty / view / create / edit / confirmDelete）
 * 纯展示组件：所有数据与回调由页面持有，删除为侧栏内联二次确认（无弹窗）。
 */
const FieldSidePanel = ({
  mode,
  field,
  geometryLoading,
  draftAreaM2,
  draftVertexCount,
  form,
  errors,
  submitting,
  onFormChange,
  onStartEdit,
  onStartDelete,
  onConfirmDelete,
  onCancel,
  onSubmit,
  onStartRedraw,
  onCollapse,
}) => {
  const detail = field?.detail
  const isDetailMode = mode === 'view' || mode === 'edit' || mode === 'confirmDelete'
  const name = isDetailMode ? field?.name ?? '' : ''

  return (
    <aside className="field-side-panel">
      <header className="panel-header">
        <h2 className="panel-title">{mode === 'create' ? '新建地块' : name || '地块信息'}</h2>
        <button className="icon-btn" onClick={onCollapse} title="收起侧栏" aria-label="收起侧栏">
          ›
        </button>
      </header>

      <div className="panel-body">
        {mode === 'empty' && (
          <div className="panel-empty">
            <p className="empty-title">未选择地块</p>
            <p className="empty-hint">点击地图上的地块查看详情，或点顶部「新建」开始绘制。</p>
          </div>
        )}

        {mode === 'view' && (
          <>
            {geometryLoading && !detail ? (
              <div className="panel-skeleton">
                <span className="skeleton-line" />
                <span className="skeleton-line short" />
                <span className="skeleton-line" />
              </div>
            ) : (
              <dl className="panel-grid">
                <div className="panel-item">
                  <dt>面积</dt>
                  <dd>{formatArea(field?.area_m2)}</dd>
                </div>
                <div className="panel-item">
                  <dt>作物类型</dt>
                  <dd>{detail?.crop_type || '未设置'}</dd>
                </div>
                <div className="panel-item">
                  <dt>土壤类型</dt>
                  <dd>{detail?.soil_type || '未设置'}</dd>
                </div>
                <div className="panel-item">
                  <dt>灌溉方式</dt>
                  <dd>{detail?.irrigation_type || '未设置'}</dd>
                </div>
                <div className="panel-item full">
                  <dt>描述</dt>
                  <dd>{detail?.description || '无'}</dd>
                </div>
                <div className="panel-item">
                  <dt>创建时间</dt>
                  <dd>{formatDate(detail?.created_at)}</dd>
                </div>
                <div className="panel-item">
                  <dt>更新时间</dt>
                  <dd>{formatDate(detail?.updated_at)}</dd>
                </div>
              </dl>
            )}
          </>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <>
            {mode === 'create' && (
              <p className="panel-hint">
                {draftVertexCount
                  ? `已绘制 ${draftVertexCount} 个顶点，预览面积约 ${formatArea(draftAreaM2)}`
                  : '请在地图上绘制地块边界（点击落点，双击闭合）'}
              </p>
            )}
            <FieldFormFields
              value={form}
              onChange={onFormChange}
              errors={errors}
              disabled={submitting}
            />
            {mode === 'edit' && (
              <button className="ghost-btn" onClick={onStartRedraw} disabled={submitting}>
                重绘边界
              </button>
            )}
          </>
        )}

        {mode === 'confirmDelete' && (
          <div className="panel-danger">
            <p className="danger-title">删除地块「{name}」？</p>
            <p className="danger-hint">此操作不可恢复，地块的几何与全部属性将被永久删除。</p>
          </div>
        )}
      </div>

      <footer className="panel-footer">
        {mode === 'view' && (
          <>
            <button className="primary-btn" onClick={onStartEdit}>
              编辑
            </button>
            <button className="danger-btn" onClick={onStartDelete}>
              删除
            </button>
          </>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <>
            <button
              className="primary-btn"
              onClick={onSubmit}
              disabled={submitting || (mode === 'create' && !draftVertexCount)}
            >
              {submitting ? '保存中…' : '保存'}
            </button>
            <button className="secondary-btn" onClick={onCancel} disabled={submitting}>
              取消
            </button>
          </>
        )}

        {mode === 'confirmDelete' && (
          <>
            <button className="danger-btn" onClick={onConfirmDelete} disabled={submitting}>
              {submitting ? '删除中…' : '确认删除'}
            </button>
            <button className="secondary-btn" onClick={onCancel} disabled={submitting}>
              取消
            </button>
          </>
        )}
      </footer>
    </aside>
  )
}

export default FieldSidePanel
