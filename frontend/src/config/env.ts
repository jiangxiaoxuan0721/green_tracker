/**
 * 全局环境变量唯一出口
 *
 * 约定：
 * - 所有 import.meta.env 读取必须经过本模块，业务代码禁止直接使用 import.meta.env
 * - API_BASE_URL 是 origin 前缀，**不含** /api；调用方请求路径自带 /api 前缀
 */

type Mode = 'development' | 'production' | 'test'

const readString = (value: string | undefined, fallback: string): string => {
  const trimmed = (value ?? '').trim()
  return trimmed !== '' ? trimmed : fallback
}

const readInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const readBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value.trim() === '' ? fallback : value.trim() === 'true'

const readList = (value: string | undefined, fallback: string[]): string[] => {
  const trimmed = (value ?? '').trim()
  if (trimmed === '') return fallback
  return trimmed.split(',').map(item => item.trim()).filter(Boolean)
}

/**
 * 规范化 API 基址：剥离尾部 `/api` 与尾部斜杠。
 *
 * 背景：代码中所有请求路径都自带 `/api` 前缀。若 VITE_API_BASE_URL 被误填为
 * `/api`，拼接会得到 `/api/api/auth/login` → 404（2026-09-15 线上故障根因）。
 * 此处主动剥离，使该误配置不再产生故障。
 */
export const normalizeApiBaseUrl = (raw: string | undefined): string => {
  const original = (raw ?? '').trim()
  if (original === '') return ''

  let normalized = original.replace(/\/+$/, '')
  // 循环剥离病态输入（如 /api/api）的每一层 /api 后缀
  while (normalized === '/api' || normalized.endsWith('/api')) {
    normalized =
      normalized === '/api' ? '' : normalized.slice(0, -'/api'.length).replace(/\/+$/, '')
  }

  if (normalized !== original) {
    console.warn(
      `[环境变量] VITE_API_BASE_URL 已被修正: "${original}" -> "${normalized || '(空)'}"。` +
        '该变量应为 origin 前缀且不含 /api（请求路径已自带 /api），请修正 .env。'
    )
  }
  return normalized
}

const mode = readString(import.meta.env.MODE, 'development') as Mode

export const env = {
  MODE: mode,
  isDevelopment: mode === 'development',
  isProduction: mode === 'production',
  isTest: mode === 'test',

  /** API origin 前缀（已归一化，不含 /api）。空 = 同源相对路径 */
  API_BASE_URL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  API_TIMEOUT: readInt(import.meta.env.VITE_API_TIMEOUT, 30000),

  MINIO_ENDPOINT: readString(import.meta.env.VITE_MINIO_ENDPOINT, 'localhost'),
  MINIO_PORT: readInt(import.meta.env.VITE_MINIO_PORT, 9100),
  MINIO_BUCKET: readString(import.meta.env.VITE_MINIO_BUCKET, 'green-tracker-minio'),
  MINIO_SECURE: readBool(import.meta.env.VITE_MINIO_SECURE, false),
  MINIO_PUBLIC_URL: readString(
    import.meta.env.VITE_MINIO_PUBLIC_URL,
    `/minio/${readString(import.meta.env.VITE_MINIO_BUCKET, 'green-tracker-minio')}`
  ),

  ALLOWED_HOSTS: readList(import.meta.env.VITE_ALLOWED_HOSTS, []),

  AMAP_KEY: readString(import.meta.env.VITE_AMAP_KEY, ''),
  AMAP_SERVICE_KEY: readString(import.meta.env.VITE_AMAP_SERVICE_KEY, ''),
  AMAP_SECURITY_CODE: readString(import.meta.env.VITE_AMAP_SECURITY_CODE, ''),

  /**
   * 库内地块几何的坐标系假设。
   * wgs84 = 库内存标准 WGS84，渲染需转 GCJ-02（新部署的正确默认值）；
   * gcj02 = 存量数据直接存的是 GCJ-02，渲染不做变换。
   *
   * 校准结论（2026-09-16，spec §6.3 一次性校准已完成）：
   * 本库存量数据为 **GCJ-02**。证据：重构前的 FieldMapPicker 用 AMap.MouseTool
   * 取点后原样入库，当时全仓无任何坐标转换代码（crs.ts 是本次重构才引入），
   * 且不存在种子数据或外部导入来源 —— 几何只有「在高德上绘制」这一个入口。
   * 因此 .env 设为 VITE_FIELD_SOURCE_CRS=gcj02。
   * 若将来把存量数据迁移为 WGS84，必须同步改回 wgs84，否则会向反方向偏移。
   */
  FIELD_SOURCE_CRS: readString(import.meta.env.VITE_FIELD_SOURCE_CRS, 'wgs84') as 'wgs84' | 'gcj02',

  // 算法压缩包默认上限 1 GB（覆盖大型 ML 模型 + 依赖 + 数据集打包场景）
  // 通过 VITE_MAX_FILE_SIZE 环境变量覆盖；后端 nginx client_max_body_size 0 无限制
  MAX_FILE_SIZE: readInt(import.meta.env.VITE_MAX_FILE_SIZE, 1024 * 1024 * 1024),
  ALLOWED_IMAGE_FORMATS: readList(import.meta.env.VITE_ALLOWED_IMAGE_FORMATS, [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
  ]),
  THUMBNAIL_SIZE: readInt(import.meta.env.VITE_THUMBNAIL_SIZE, 150),
  THUMBNAIL_CACHE_TTL: readInt(import.meta.env.VITE_THUMBNAIL_CACHE_TTL, 3600),
  IMAGE_CACHE_LIMIT: readInt(import.meta.env.VITE_IMAGE_CACHE_LIMIT, 100),
  IMAGE_LAZY_LOADING: readBool(import.meta.env.VITE_IMAGE_LAZY_LOADING, true),

  ENABLE_VIRTUAL_SCROLL: readBool(import.meta.env.VITE_ENABLE_VIRTUAL_SCROLL, false),
  PAGE_SIZE: readInt(import.meta.env.VITE_PAGE_SIZE, 20),
  MAX_CONCURRENT_REQUESTS: readInt(import.meta.env.VITE_MAX_CONCURRENT_REQUESTS, 5),

  DEFAULT_USERNAME: readString(import.meta.env.VITE_DEFAULT_USERNAME, 'admin'),
  DEFAULT_PASSWORD: readString(import.meta.env.VITE_DEFAULT_PASSWORD, '123456'),
} as const

/**
 * 拼接完整 API 地址。
 * @param path 以 / 开头的路径，如 '/api/auth/login'
 */
export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${env.API_BASE_URL}${normalizedPath}`
}

if (env.isDevelopment) {
  console.log('[环境变量] 加载完成:', {
    MODE: env.MODE,
    API_BASE_URL: env.API_BASE_URL,
    MINIO_PUBLIC_URL: env.MINIO_PUBLIC_URL,
    MAX_FILE_SIZE: `${env.MAX_FILE_SIZE} bytes (${(env.MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB)`,
  })
}

export default env
