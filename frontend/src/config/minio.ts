import { env } from './env'

/**
 * 获取 MinIO 完整访问 URL
 * @param objectPath 对象路径
 * @param forcePreview 是否追加 inline 参数（强制预览而非下载）
 */
export const getMinioUrl = (
  objectPath: string | null | undefined,
  forcePreview = true
): string => {
  if (!objectPath) return ''

  const baseUrl = env.MINIO_PUBLIC_URL
  const url = baseUrl.endsWith('/')
    ? `${baseUrl}${objectPath}`
    : `${baseUrl}/${objectPath}`

  if (forcePreview) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}response-content-disposition=inline`
  }
  return url
}
