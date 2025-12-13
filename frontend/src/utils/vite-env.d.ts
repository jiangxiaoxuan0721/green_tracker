/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_DEFAULT_USERNAME: string
  readonly VITE_DEFAULT_PASSWORD: string
  readonly VITE_API_PORT: string
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}