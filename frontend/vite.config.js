import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 根据当前工作目录中的 `mode` 加载环境变量文件
  // 设置第三个参数为 '' 来加载所有环境变量，不管 `VITE_` 前缀如何
  const env = loadEnv(mode, process.cwd(), '')

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
      port: 3000, // 前端服务器端口
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})