import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 从项目根目录加载环境变量文件
  // 设置第三个参数为 '' 来加载所有环境变量，不管 `VITE_` 前缀如何
  const projectRoot = path.resolve(__dirname, '..')
  console.log('[Vite配置] 项目根目录:', projectRoot)
  console.log('[Vite配置] 开始加载环境变量...')
  const env = loadEnv(mode, projectRoot, '')
  
  // 输出关键环境变量，确认加载成功
  console.log('[Vite配置] 环境变量加载结果:')
  console.log('- VITE_API_BASE_URL:', env.VITE_API_BASE_URL)
  console.log('- PORT:', env.PORT)
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },
    server: {
      port: 3010, // 前端服务器端口
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:6130',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})