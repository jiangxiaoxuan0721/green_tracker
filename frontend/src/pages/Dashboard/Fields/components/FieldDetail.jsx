
import DetailModal, { renderDetailRow, renderStatusBadge, renderCodeBlock } from '../../../../components/common/DetailModal'

const FieldDetail = ({ field, onClose, onEdit }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  // 准备标签页
  const tabs = [
    { id: 'info', label: '基本信息' },
    { id: 'location', label: '位置信息' },
    { id: 'actions', label: '操作' }
  ]

  // 准备内容区块
  const sections = []

  // 基本信息区块
  const infoSection = {
    tab: 'info',
    title: '地块信息',
    content: (
      <div className="detail-grid">
        {renderDetailRow('地块ID', field.id)}
        {renderDetailRow('地块名称', field.name)}
        {renderDetailRow('描述', field.description || '无', true)}
        {renderDetailRow('面积', field.area_m2 ? `${field.area_m2.toFixed(2)} 平方米` : '未知')}
        {renderDetailRow('作物类型', field.crop_type || '未设置')}
        {renderDetailRow('土壤类型', field.soil_type || '未设置')}
        {renderDetailRow('灌溉方式', field.irrigation_type || '未设置')}
        {renderDetailRow('状态', '', false, renderStatusBadge(field.is_active ? '活跃' : '非活跃', field.is_active ? 'valid' : 'invalid'))}
        {renderDetailRow('所有者ID', field.owner_id)}
        {field.organization_id && renderDetailRow('组织ID', field.organization_id)}
        {renderDetailRow('创建时间', formatDate(field.created_at))}
        {field.updated_at && renderDetailRow('更新时间', formatDate(field.updated_at))}
      </div>
    )
  }

  // 位置信息区块
  const locationSection = {
    tab: 'location',
    title: '位置数据',
    content: (
      <div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h4>WKT格式位置数据</h4>
          {renderCodeBlock(field.location_wkt)}
        </div>
        <div className="detail-section" style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p>地图组件将在此显示</p>
          <small>将来可以集成地图库（如 Leaflet 或 Mapbox）来可视化地块位置</small>
        </div>
      </div>
    )
  }

  // 操作区块
  const actionsSection = {
    tab: 'actions',
    title: '地块操作',
    content: (
      <div>
        <p style={{ marginBottom: 'var(--spacing-md)' }}>在这里可以对地块执行各种操作</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <button className="secondary-btn">导出数据</button>
          <button className="secondary-btn">查看历史记录</button>
          <button className="secondary-btn">查看关联设备</button>
          <button className="secondary-btn">查看采集数据</button>
        </div>
      </div>
    )
  }

  // 添加所有区块
  sections.push(infoSection)
  sections.push(locationSection)
  sections.push(actionsSection)

  return (
    <DetailModal
      isOpen={true}
      onClose={onClose}
      title="地块详情"
      size="large"
      tabs={tabs}
      sections={sections}
      footer={
        <button className="primary-btn" onClick={onEdit}>
          编辑地块
        </button>
      }
    />
  )
}

export default FieldDetail