/// <reference path="./vite-env.d.ts" />

// 从环境变量加载配置
export const env = {
  // API 基础 URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:6130',
  
  // 应用环境
  MODE: import.meta.env.MODE || 'development',
  
  // 默认用户名
  DEFAULT_USERNAME: import.meta.env.VITE_DEFAULT_USERNAME || 'admin',
  
  // 默认密码
  DEFAULT_PASSWORD: import.meta.env.VITE_DEFAULT_PASSWORD || '123456',
  
  // 后端API端口
  API_PORT: import.meta.env.VITE_API_PORT || '6130',
} as const;

// 调试信息
console.log('[环境变量] 加载完成，API_BASE_URL:', env.API_BASE_URL);