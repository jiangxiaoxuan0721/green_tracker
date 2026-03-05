import { useCallback } from 'react'
import { getMinioUrl } from '@/config/environment'

/**
 * 简化的图片链接组件
 * 
 * 特性：
 * - 直接显示文字链接
 * - 点击查看原图
 * - 简洁明了
 */
const ImageThumbnail = ({ 
  record, 
  style = {}
}) => {
  const dataId = record?.id
  const minioPath = record?.object_key
  const dataValue = record?.data_value
  
  // 点击查看原图
  const handleViewFullImage = useCallback(() => {
    let fullImageUrl
    
    // 优先使用MinIO原图URL
    if (minioPath) {
      fullImageUrl = getMinioUrl(minioPath)
    } else if (dataValue && dataValue.startsWith('http')) {
      fullImageUrl = dataValue
    } else {
      fullImageUrl = '#'
    }
    
    if (fullImageUrl && fullImageUrl !== '#') {
      window.open(fullImageUrl, '_blank')
    }
  }, [minioPath, dataValue])
  
  // 获取文件名显示
  const getFileName = () => {
    if (minioPath) {
      return minioPath.split('/').pop()
    }
    if (dataValue) {
      return dataValue.startsWith('http') ? '外部图片' : dataValue
    }
    return dataId ? `ID:${dataId}` : '未知图片'
  }
  
  // 检查是否有有效的图片数据
  const hasValidImage = record?.data_type === 'image' && (minioPath || dataValue || dataId)
  
  if (!record) {
    return <div style={style}>无数据</div>
  }
  
  if (record.data_type !== 'image') {
    return <div style={style}>-</div>
  }
  
  if (!hasValidImage) {
    return <div style={style}>无图像</div>
  }
  
  return (
    <div style={{ ...style }}>
      <a 
        href="#"
        onClick={(e) => {
          e.preventDefault()
          handleViewFullImage()
        }}
        style={{
          color: '#007bff',
          textDecoration: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          borderBottom: '1px dotted #007bff'
        }}
        title={`数据ID: ${dataId}\n文件: ${getFileName()}\n\n点击查看原图`}
      >
        点击查看图片
      </a>
    </div>
  )
}

export default ImageThumbnail