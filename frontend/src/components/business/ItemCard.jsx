import { Card, Button } from '@/components/ui'
import StatusBadge from './StatusBadge'
import './ItemCard.css'

const ItemCard = ({
  item,
  type,
  onView,
  onEdit,
  onDelete,
  customInfo,
  className = ''
}) => {
  const getTitle = () => {
    if (type === 'device') return item.name || item.model || item.manufacturer || '未命名设备'
    if (type === 'field') return item.field_name || item.name || '未命名地块'
    return item.name || '未命名'
  }

  const getSubtitle = () => {
    if (type === 'device') return item.device_type || item.type
    if (type === 'field') return item.crop_type || item.type
    return item.type
  }

  const getStatus = () => {
    if (type === 'device') return item.status
    if (type === 'field') return item.status
    return null
  }

  const hasInfo = () => {
    return customInfo || (type === 'device' || type === 'field')
  }

  const renderDefaultInfo = () => {
    if (type === 'device') {
      return (
        <>
          <div className="item-info-row">
            <span>平台层级:</span>
            <span>{item.platform_tier || '-'}</span>
          </div>
        </>
      )
    }

    if (type === 'field') {
      return (
        <>
          <div className="item-info-row">
            <span>面积:</span>
            <span>{item.area ? `${item.area} 亩` : '-'}</span>
          </div>
        </>
      )
    }

    return null
  }

  return (
    <Card hoverable className={`item-card ${className}`}>
      <div className="item-card-header">
        <h3 className="item-card-title">{getTitle()}</h3>
        <span className="item-card-subtitle">{getSubtitle()}</span>
        {getStatus() && <StatusBadge status={getStatus()} />}
      </div>

      <div className="item-card-body">
        {customInfo ? customInfo(item) : renderDefaultInfo()}
      </div>

      <div className="item-card-actions">
        {onView && (
          <Button size="small" variant="outline" onClick={() => onView(item)}>
            详情
          </Button>
        )}
        {onEdit && (
          <Button size="small" variant="primary" onClick={() => onEdit(item)}>
            编辑
          </Button>
        )}
        {onDelete && (
          <Button size="small" variant="danger" onClick={() => onDelete(item)}>
            删除
          </Button>
        )}
      </div>
    </Card>
  )
}

export default ItemCard
