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
  console.log('- VITE_ALLOWED_HOSTS:', env.VITE_ALLOWED_HOSTS)
  
  // 从环境变量中解析允许的主机列表
  const allowedHosts = env.VITE_ALLOWED_HOSTS 
    ? env.VITE_ALLOWED_HOSTS.split(',').map(host => host.trim())
    : [
        'localhost',
        '127.0.0.1',
      ]
  
  console.log('[Vite配置] 允许的主机列表:', allowedHosts)
  
  return {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      globals: true,
    },
    envDir: projectRoot,
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
    build: {
      outDir: 'dist',
      // 生产构建不产出 sourcemap，避免把源码体积带入公网传输
      sourcemap: false,
      // 单 chunk 体积告警阈值（默认 500KB 会持续告警）
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // 手动拆包：把体积大、变更频率低的第三方库独立成 chunk。
          // 首屏只下载 react 核心，图表（recharts）/ 动画（framer-motion）
          // 等重库被拆出后可长期命中浏览器缓存，不再随业务代码失效。
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'chart-vendor': ['recharts'],
            'motion-vendor': ['framer-motion'],
            'icons-vendor': ['lucide-react'],
            'state-vendor': ['zustand', 'axios'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0', // 允许外部访问
      port: 3010, // 前端服务器端口（仅本地监听，由 Nginx 反向代理对外提供 https）
      allowedHosts: allowedHosts,
      proxy: {
        // 推荐：使用相对路径 /api，让浏览器走当前协议（http/https），
        // 配合 Nginx 反向代理可避免 HTTPS 下出现 mixed content 错误。
        '/api': {
          target: env.VITE_API_BASE_URL && env.VITE_API_BASE_URL.startsWith('http')
            ? env.VITE_API_BASE_URL
            : 'http://localhost:6130',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})