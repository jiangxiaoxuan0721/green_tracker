import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { authService } from '@/services/authService';

// 定义用户类型
interface User {
  id: string;
  token: string;
}

// 定义认证上下文类型
interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticating: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证提供者组件props
interface AuthProviderProps {
  children: ReactNode;
}

// 认证提供者组件
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticating, setAuthenticating] = useState<boolean>(false); // 用于登录/注册过程中的加载状态
  const [error, setError] = useState<string | null>(null);

  // 初始化时检查本地存储中的token
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id');
      const isLoggedIn = localStorage.getItem('isLoggedIn');

      // 只有当所有登录信息都存在时才验证token
      if (token && userId && isLoggedIn === 'true') {
        try {
          // 直接设置用户状态，不进行网络验证（提升性能）
          // 如果后续请求失败，后端会返回401，前端会自动清除token并跳转登录页
          setUser({ id: userId, token });
        } catch (error) {
          console.error('[前端Auth] 恢复登录状态出错:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user_id');
          localStorage.removeItem('isLoggedIn');
        }
      } else {
        console.log('[前端Auth] 未找到有效的登录信息');
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // 登录函数
  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[前端Auth] 开始登录流程');
    console.log('[前端Auth] 登录参数:', { username, password: '***' });

    try {
      setAuthenticating(true);
      setError(null);
      console.log('[前端Auth] 调用authService.login');
      const response = await authService.login({ username, password });

      // 保存token和用户信息
      localStorage.setItem('token', response.token);
      localStorage.setItem('user_id', response.user_id);
      localStorage.setItem('isLoggedIn', 'true');

      setUser({
        id: response.user_id,
        token: response.token
      });

      console.log('[前端Auth] 已更新用户状态');
      return { success: true };
    } catch (error: any) {
      console.error('[前端Auth] 登录失败:', error);
      const errorMessage = error.response?.data?.detail || '登录失败';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setAuthenticating(false);
    }
  };

  // 注册函数
  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[前端Auth] 开始注册流程');
    console.log('[前端Auth] 注册参数:', { username, email, password: '***' });

    try {
      setAuthenticating(true);
      setError(null);

      console.log('[前端Auth] 调用authService.register');
      const response = await authService.register({
        username,
        email,
        password
      });

      console.log('[前端Auth] 注册成功，响应数据:', response);

      // 保存token和用户信息
      localStorage.setItem('token', response.token);
      localStorage.setItem('user_id', response.user_id);
      localStorage.setItem('isLoggedIn', 'true');

      console.log('[前端Auth] 已保存用户信息到localStorage');

      setUser({
        id: response.user_id,
        token: response.token
      });

      console.log('[前端Auth] 已更新用户状态');
      return { success: true };
    } catch (error: any) {
      console.error('[前端Auth] 注册失败:', error);
      const errorMessage = error.response?.data?.detail || '注册失败';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setAuthenticating(false);
    }
  };

  // 登出函数
  const logout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('isLoggedIn');
    setUser(null);
  };
  
  // 返回上下文提供者
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticating,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 使用认证上下文的钩子
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  
  return context;
};