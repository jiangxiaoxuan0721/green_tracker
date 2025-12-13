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
    const response = await api.post<AuthResponse>('/api/auth/register', userData);
    return response.data;
  },

  // 用户登录
  async login(credentials: UserLoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', credentials);
    return response.data;
  },

  // 验证token有效性
  async verifyToken(token: string): Promise<any> {
    try {
      const response = await api.get('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw new Error('Token验证失败');
    }
  }
};