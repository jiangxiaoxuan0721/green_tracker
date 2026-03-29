/**
 * 环境配置模块
 * 
 * 提供统一的环境变量访问接口，支持开发、测试、生产环境
 */

const getEnvironmentConfig = () => {
  // 使用Vite的import.meta.env替代process.env
  const NODE_ENV = import.meta.env.MODE || 'development'
  
  // 基础配置
  const baseConfig = {
    NODE_ENV,
    isDevelopment: NODE_ENV === 'development',
    isProduction: NODE_ENV === 'production',
    isTest: NODE_ENV === 'test',
  }
  
  // MinIO配置 - 使用VITE_前缀的环境变量
  const minioEndpoint = import.meta.env.VITE_MINIO_ENDPOINT || 'localhost'
  const minioPort = parseInt(import.meta.env.VITE_MINIO_PORT) || 9100
  const minioBucket = import.meta.env.VITE_MINIO_BUCKET || 'green-tracker-minio'
  
  const minioConfig = {
    endpoint: minioEndpoint,
    port: minioPort,
    secure: import.meta.env.VITE_MINIO_SECURE === 'true',
    bucketName: minioBucket,
    // 公开访问URL - 优先使用配置的URL，否则构建默认URL
    publicUrl: import.meta.env.VITE_MINIO_PUBLIC_URL || 
               `http://localhost:9100/green-tracker-minio`,
  }
  
  // API配置
  const apiConfig = {
    baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
  }
  
  // 图片处理配置
  const imageConfig = {
    maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedFormats: import.meta.env.VITE_ALLOWED_IMAGE_FORMATS?.split(',') || 
                    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
  }
  
  // 缓存配置（简化）
  const cacheConfig = {
    imageCacheLimit: parseInt(import.meta.env.VITE_IMAGE_CACHE_LIMIT) || 100,
  }
  
  // 性能配置
  const performanceConfig = {
    enableVirtualScroll: import.meta.env.VITE_ENABLE_VIRTUAL_SCROLL === 'true',
    pageSize: parseInt(import.meta.env.VITE_PAGE_SIZE) || 20,
    maxConcurrentRequests: parseInt(import.meta.env.VITE_MAX_CONCURRENT_REQUESTS) || 5,
  }
  
  return {
    ...baseConfig,
    minio: minioConfig,
    api: apiConfig,
    image: imageConfig,
    cache: cacheConfig,
    performance: performanceConfig,
  }
}

// 创建全局配置实例
const config = getEnvironmentConfig()

/**
 * 获取MinIO完整URL
 * @param {string} objectPath - MinIO对象路径
 * @param {boolean} forcePreview - 是否强制预览（添加inline响应头参数）
 * @returns {string} 完整的访问URL
 */
export const getMinioUrl = (objectPath, forcePreview = true) => {
  if (!objectPath) return ''

  const baseUrl = config.minio.publicUrl
  let url = baseUrl.endsWith('/') ? `${baseUrl}${objectPath}` : `${baseUrl}/${objectPath}`

  // 添加查询参数强制浏览器预览而不是下载
  if (forcePreview) {
    const separator = url.includes('?') ? '&' : '?'
    url += `${separator}response-content-disposition=inline`
  }

  return url
}



/**
 * 验证图片格式
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为支持的格式
 */
export const isImageFormatSupported = (filename) => {
  if (!filename) return false
  
  const extension = filename.split('.').pop().toLowerCase()
  return config.image.allowedFormats.includes(extension)
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的大小
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 默认导出配置对象
export default config

// 开发环境下打印配置信息
if (config.isDevelopment) {
  console.log('🔧 环境配置:', {
    ...config,
    // 避免打印敏感信息
    minio: {
      ...config.minio,
      publicUrl: config.minio.publicUrl
    }
  })
}