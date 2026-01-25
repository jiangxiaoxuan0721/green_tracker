import { useState, useEffect } from 'react'
import { rawDataService } from '@/services/rawDataService'
import './DataDetailModal.css'

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

  if (!isOpen) {
    return null
  }

  // 加载状态
  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h2>数据详情</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="loading">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h2>数据详情</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="error-message" style={{ color: 'red', padding: '20px' }}>{error}</div>
          </div>
          <div className="modal-footer">
            <button className="secondary-btn" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>数据详情</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-item">
            <span className="label">数据ID:</span>
            <span className="value">{data?.id}</span>
          </div>
          <div className="detail-item">
            <span className="label">采集时间:</span>
            <span className="value">{formatDate(data?.capture_time || data?.created_at)}</span>
          </div>
          <div className="detail-item">
            <span className="label">数据类型:</span>
            <span className="value">{data?.data_type}</span>
          </div>
          <div className="detail-item">
            <span className="label">数据值:</span>
            <span className="value">{`${data?.data_value} ${data?.data_unit || ''}`}</span>
          </div>
          <div className="detail-item">
            <span className="label">设备ID:</span>
            <span className="value">{data?.device_id}</span>
          </div>
          <div className="detail-item">
            <span className="label">设备名称:</span>
            <span className="value">{data?.device_display_name || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">设备类型:</span>
            <span className="value">{data?.device_type}</span>
          </div>
          <div className="detail-item">
            <span className="label">地块ID:</span>
            <span className="value">{data?.field_id || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">地块名称:</span>
            <span className="value">{data?.field_display_name || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">位置:</span>
            <span className="value">{data?.location_geom || '-'}</span>
          </div>
          {data?.altitude_m && (
            <div className="detail-item">
              <span className="label">高度:</span>
              <span className="value">{data.altitude_m}m</span>
            </div>
          )}
          <div className="detail-item">
            <span className="label">处理状态:</span>
            <span className="value">{data?.processing_status || '未处理'}</span>
          </div>
          <div className="detail-item">
            <span className="label">AI状态:</span>
            <span className="value">{data?.ai_status || '未处理'}</span>
          </div>
          <div className="detail-item">
            <span className="label">质量分数:</span>
            <span className="value">{data?.quality_score || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">是否有效:</span>
            <span className="value">
              <div className={`status-badge ${data?.is_valid ? 'status-completed' : 'status-failed'}`}>
                {data?.is_valid ? '是' : '否'}
              </div>
            </span>
          </div>
          {data?.validation_notes && (
            <div className="detail-item">
              <span className="label">验证备注:</span>
              <span className="value">{data.validation_notes}</span>
            </div>
          )}
          {data?.sensor_meta && (
            <div className="detail-item">
              <span className="label">传感器元数据:</span>
              <span className="value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {JSON.stringify(data.sensor_meta, null, 2)}
              </span>
            </div>
          )}
          {data?.acquisition_meta && (
            <div className="detail-item">
              <span className="label">采集元数据:</span>
              <span className="value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {JSON.stringify(data.acquisition_meta, null, 2)}
              </span>
            </div>
          )}
          {data?.file_meta && (
            <div className="detail-item">
              <span className="label">文件元数据:</span>
              <span className="value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {JSON.stringify(data.file_meta, null, 2)}
              </span>
            </div>
          )}
          {tags.length > 0 && (
            <div className="detail-item">
              <span className="label">标签:</span>
              <span className="value">
                {tags.map((tag, index) => (
                  <div key={index} className="tag-item">
                    <strong>{tag.tag_category}:</strong> {tag.tag_value}
                    {tag.confidence && ` (置信度: ${tag.confidence})`}
                  </div>
                ))}
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export default DataDetailModal