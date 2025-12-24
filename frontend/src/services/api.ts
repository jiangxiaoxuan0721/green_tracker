/// <reference path="../utils/vite-env.d.ts" />
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// 动态检测后端 API 地址
// 从环境变量获取，如果没有则根据当前访问地址动态判断
let apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  // 如果没有配置环境变量，根据当前访问地址自动判断
  const currentHost = window.location.hostname;
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    // 本地访问：使用 localhost:6130
    apiBaseUrl = 'http://localhost:6130';
  } else {
    // 外部访问：使用当前主机地址 + 6130 端口
    apiBaseUrl = `http://${currentHost}:6130`;
  }
}

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 调试信息
console.log('[前端API] 初始化API');
console.log('- import.meta.env.VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('- 检测到的API地址:', apiBaseUrl);
console.log('- 最终baseURL:', api.defaults.baseURL);

// 请求拦截器 - 添加token到请求头
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`[前端API] 发送请求: ${config.method?.toUpperCase()} ${config.url}`);
    console.log('[前端API] 请求数据:', config.data);
    
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
      console.log('[前端API] 401未授权，清除用户信息并重定向到登录页');
      // Token过期或无效，清除本地存储并跳转到登录页
      localStorage.removeItem('token');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user_id');
      window.location.href = '/login';
    }
    
    // 如果是网络错误或CORS错误，提供更详细的信息
    if (error.code === 'ERR_NETWORK') {
      console.error('[前端API] 网络错误，可能是后端服务未运行或CORS问题');
      console.error(`[前端API] 请求URL: ${error.config?.baseURL}${error.config?.url}`);
    }
    
    return Promise.reject(error);
  }
);

export default api;