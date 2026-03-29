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
    // 始终使用 object_key 构建公开 URL，不使用可能过期的预签名 URL
    // 因为 MinIO 配置了公开访问，可以直接使用公开 URL
    if (minioPath) {
      const fullImageUrl = getMinioUrl(minioPath, false) // 不添加预览参数
      if (fullImageUrl) {
        window.open(fullImageUrl, '_blank')
      }
    } else {
      console.log('[ImageThumbnail] No valid object_path')
    }
  }, [minioPath])
  
  // 获取文件名显示
  const getFileName = () => {
    if (minioPath) {
      return minioPath.split('/').pop()
    }
    return dataId ? `ID:${dataId}` : '未知图片'
  }

  // 检查是否有有效的文件数据（支持 image 和 file 类型）
  const hasValidFile = (record?.data_type === 'image' || record?.data_type === 'file') && (minioPath || dataId)

  if (!record) {
    return <div style={style}>无数据</div>
  }

  if (record.data_type !== 'image' && record.data_type !== 'file') {
    return <div style={style}>-</div>
  }

  if (!hasValidFile) {
    return <div style={style}>无文件</div>
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