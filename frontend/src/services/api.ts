import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';

// API 基址来自唯一出口 config/env.ts（已归一化：不含尾部 /api，空 = 同源相对路径）
const apiBaseUrl = env.API_BASE_URL;

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: env.API_TIMEOUT, // 默认30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加token到请求头
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`[前端API] 发送请求: ${config.method?.toUpperCase()} ${config.url}`);
    console.log('[前端API] 请求参数:', config.params);
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('[前端API] 请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[前端API] 收到响应: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    console.log('[前端API] 响应数据:', response.data);
    return response;
  },
  (error) => {
    console.error('[前端API] 响应错误:', error);
    console.error('[前端API] 错误详情:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      method: error.config?.method,
    });

    if (error.response?.status === 401) {
      console.log('[前端API] 401未授权，清除用户信息');
      // Token过期或无效，清除本地存储（由路由守卫处理跳转）
      localStorage.removeItem('token');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user_id');
    }

    // 如果是网络错误或CORS错误，提供更详细的信息
    if (error.code === 'ERR_NETWORK') {
      console.error('[前端API] 网络错误，可能是后端服务未运行或CORS问题');
      console.error(`[前端API] 请求URL: ${error.config?.baseURL}${error.config?.url}`);
    }

    return Promise.reject(error);
  }
);

// 导出API基础URL供其他服务使用
export function getApiUrl(): string {
  return apiBaseUrl;
}

export default api;