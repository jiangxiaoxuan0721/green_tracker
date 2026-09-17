/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_ALLOWED_HOSTS?: string
  readonly VITE_AMAP_KEY?: string
  readonly VITE_AMAP_SERVICE_KEY?: string
  readonly VITE_AMAP_SECURITY_CODE?: string
  readonly VITE_MINIO_ENDPOINT?: string
  readonly VITE_MINIO_PORT?: string
  readonly VITE_MINIO_BUCKET?: string
  readonly VITE_MINIO_SECURE?: string
  readonly VITE_MINIO_PUBLIC_URL?: string
  readonly VITE_MAX_FILE_SIZE?: string
  readonly VITE_ALLOWED_IMAGE_FORMATS?: string
  readonly VITE_ENABLE_VIRTUAL_SCROLL?: string
  readonly VITE_PAGE_SIZE?: string
  readonly VITE_MAX_CONCURRENT_REQUESTS?: string
  readonly VITE_IMAGE_CACHE_LIMIT?: string
  readonly VITE_THUMBNAIL_SIZE?: string
  readonly VITE_THUMBNAIL_CACHE_TTL?: string
  readonly VITE_IMAGE_LAZY_LOADING?: string
  readonly VITE_DEFAULT_USERNAME?: string
  readonly VITE_DEFAULT_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
