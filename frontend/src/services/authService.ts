import api from './api';

// 定义接口类型
export interface UserRegisterData {
  username: string;
  email: string;
  password: string;
  code: string;
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
  // 发送邮箱验证码
  async sendVerificationCode(email: string): Promise<{ message: string; email: string }> {
    console.log('[前端AuthService] 发送验证码请求');
    const response = await api.post<{ message: string; email: string }>('/api/auth/send-code', { email });
    console.log('[前端AuthService] 验证码发送响应:', response.data);
    return response.data;
  },

  // 用户注册
  async register(userData: UserRegisterData): Promise<AuthResponse> {
    console.log('[前端AuthService] 发送注册请求到后端');
    console.log('[前端AuthService] 请求数据:', { ...userData, password: '***', code: '***' });
    
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
  },

  // 忘记密码 - 发送重置验证码（10秒超时，因为后台发邮件很快返回）
  async forgotPassword(email: string): Promise<{ message: string; email: string }> {
    console.log('[前端AuthService] 发送忘记密码请求');
    const response = await api.post<{ message: string; email: string }>('/api/auth/forgot-password', { email }, {
      timeout: 10000, // 10秒超时
    });
    console.log('[前端AuthService] 忘记密码响应:', response.data);
    return response.data;
  },

  // 重置密码
  async resetPassword(data: { email: string; code: string; new_password: string }): Promise<{ message: string }> {
    console.log('[前端AuthService] 发送重置密码请求');
    const response = await api.post<{ message: string }>('/api/auth/reset-password', data);
    console.log('[前端AuthService] 重置密码响应:', response.data);
    return response.data;
  }
};