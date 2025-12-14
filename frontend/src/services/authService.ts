import api from './api';

// 定义接口类型
export interface UserRegisterData {
  username: string;
  email: string;
  password: string;
}

export interface UserLoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  token: string;
}

// 认证相关的API服务
export const authService = {
  // 用户注册
  async register(userData: UserRegisterData): Promise<AuthResponse> {
    console.log('[前端AuthService] 发送注册请求到后端');
    console.log('[前端AuthService] 请求数据:', { ...userData, password: '***' });
    
    const response = await api.post<AuthResponse>('/api/auth/register', userData);
    
    console.log('[前端AuthService] 收到注册响应:', response.data);
    return response.data;
  },

  // 用户登录
  async login(credentials: UserLoginData): Promise<AuthResponse> {
    console.log('[前端AuthService] 发送登录请求到后端');
    console.log('[前端AuthService] 请求数据:', { ...credentials, password: '***' });
    
    const response = await api.post<AuthResponse>('/api/auth/login', credentials);
    
    console.log('[前端AuthService] 收到登录响应:', response.data);
    return response.data;
  },

  // 验证token有效性
  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await api.get('/api/auth/verify');
      return response.data.valid === true;
    } catch (error: any) {
      console.error('[前端AuthService] Token验证失败:', error);
      return false;
    }
  }
};