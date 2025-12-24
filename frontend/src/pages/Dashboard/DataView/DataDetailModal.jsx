import { useState, useEffect } from 'react'
import { rawDataService } from '../../../services/rawDataService'
import DetailModal, { renderDetailRow, renderStatusBadge, renderCodeBlock, renderTag } from '../../../components/common/DetailModal'

const DataDetailModal = ({ isOpen, onClose, rawDataId, userId }) => {
  const [data, setData] = useState(null)
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!rawDataId || !userId) return
      
      setLoading(true)
      setError(null)
      
      try {
        // 获取数据详情
        const dataResponse = await rawDataService.getRawDataDetail(rawDataId, userId)
        if (dataResponse.code === 200) {
          setData(dataResponse.data)
        } else {
          setError(dataResponse.message || '获取数据详情失败')
          return
        }
        
        // 获取数据标签
        const tagsResponse = await rawDataService.getRawDataTags(rawDataId, userId)
        if (tagsResponse.code === 200) {
          setTags(tagsResponse.data.tags || [])
        }
      } catch (err) {
        setError('获取数据详情失败，请稍后再试')
        console.error('获取数据详情失败:', err)
      } finally {
        setLoading(false)
      }
    }
    
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, rawDataId, userId])

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  }

  // 准备标签页
  const tabs = [
    { id: 'details', label: '基本信息' },
    { id: 'metadata', label: '元数据' },
    { id: 'tags', label: '标签' }
  ]

  // 准备内容区块
  const sections = []

  // 基本信息区块
  const basicInfoSection = {
    tab: 'details',
    title: '基本信息',
    content: (
      <div className="detail-grid">
        {renderDetailRow('数据ID', data?.id)}
        {renderDetailRow('采集时间', formatDate(data?.capture_time || data?.created_at))}
        {renderDetailRow('数据类型', data?.data_type)}
        {renderDetailRow('数据值', `${data?.data_value} ${data?.data_unit || ''}`)}
      </div>
    )
  }

  // 设备信息区块
  const deviceInfoSection = {
    tab: 'details',
    title: '设备信息',
    content: (
      <div className="detail-grid">
        {renderDetailRow('设备ID', data?.device_id)}
        {renderDetailRow('设备名称', data?.device_display_name || '-')}
        {renderDetailRow('设备类型', data?.device_type)}
      </div>
    )
  }

  // 位置信息区块
  const locationInfoSection = {
    tab: 'details',
    title: '位置信息',
    content: (
      <div className="detail-grid">
        {renderDetailRow('地块ID', data?.field_id || '-')}
        {renderDetailRow('地块名称', data?.field_display_name || '-')}
        {renderDetailRow('位置', data?.location_geom || '-')}
        {renderDetailRow('高度', data?.altitude_m ? `${data.altitude_m}m` : '-')}
      </div>
    )
  }

  // 处理信息区块
  const processingInfoSection = {
    tab: 'details',
    title: '处理信息',
    content: (
      <div className="detail-grid">
        {renderDetailRow('处理状态', data?.processing_status || '未处理')}
        {renderDetailRow('AI状态', data?.ai_status || '未处理')}
        {renderDetailRow('质量分数', data?.quality_score || '-')}
        {renderDetailRow('是否有效', '', false, renderStatusBadge(data?.is_valid ? '是' : '否', data?.is_valid ? 'valid' : 'invalid'))}
        {data?.validation_notes && renderDetailRow('验证备注', data.validation_notes, true)}
      </div>
    )
  }

  // 元数据区块
  const metadataSections = []
  if (data?.sensor_meta) {
    metadataSections.push({
      tab: 'metadata',
      title: '传感器元数据',
      content: renderCodeBlock(JSON.stringify(data.sensor_meta, null, 2))
    })
  }
  if (data?.acquisition_meta) {
    metadataSections.push({
      tab: 'metadata',
      title: '采集元数据',
      content: renderCodeBlock(JSON.stringify(data.acquisition_meta, null, 2))
    })
  }
  if (data?.file_meta) {
    metadataSections.push({
      tab: 'metadata',
      title: '文件元数据',
      content: renderCodeBlock(JSON.stringify(data.file_meta, null, 2))
    })
  }

  // 标签区块
  const tagsSection = tags.length > 0 ? {
    tab: 'tags',
    content: (
      <div className="detail-tags-grid">
        {tags.map(tag => (
          renderTag(
            tag.tag_category,
            tag.tag_value,
            tag.confidence ? `置信度: ${tag.confidence} | 来源: ${tag.source}` : `来源: ${tag.source}`
          )
        ))}
      </div>
    )
  } : {
    tab: 'tags',
    content: <div>暂无标签</div>
  }

  // 添加所有区块
  sections.push(basicInfoSection)
  sections.push(deviceInfoSection)
  sections.push(locationInfoSection)
  sections.push(processingInfoSection)
  sections.push(...metadataSections)
  sections.push(tagsSection)

  // 加载和错误状态
  if (loading) {
    return (
      <DetailModal
        isOpen={isOpen}
        onClose={onClose}
        title="数据详情"
        sections={[{ content: <div className="loading">加载中...</div> }]}
      />
    )
  }

  if (error) {
    return (
      <DetailModal
        isOpen={isOpen}
        onClose={onClose}
        title="数据详情"
        sections={[{ content: <div className="error-message" style={{ color: 'red', padding: '20px' }}>{error}</div> }]}
      />
    )
  }

  if (!isOpen) {
    return null
  }

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="数据详情"
      tabs={tabs}
      sections={sections}
      footer={<button className="secondary-btn" onClick={onClose}>关闭</button>}
    />
  )
}

export default DataDetailModal