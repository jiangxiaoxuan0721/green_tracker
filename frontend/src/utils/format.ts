import { env } from '@/config/env'

export const isImageFormatSupported = (filename: string | undefined): boolean => {
  if (!filename) return false
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return env.ALLOWED_IMAGE_FORMATS.includes(extension)
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
