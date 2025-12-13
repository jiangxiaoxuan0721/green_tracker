import { useState, ChangeEvent, FormEvent } from 'react';

// 定义表单数据类型
interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// 定义表单错误类型
interface RegisterFormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// 定义注册函数类型
type RegisterFunction = (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;

// 定义返回类型
interface UseRegisterFormReturn {
  formData: RegisterFormData;
  errors: RegisterFormErrors;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: FormEvent) => Promise<{ success: boolean; error?: string }>;
}

// 注册表单处理钩子
export const useRegisterForm = (registerFunction: RegisterFunction): UseRegisterFormReturn => {
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});

  // 处理表单输入变化
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除当前字段的错误信息
    if (errors[name as keyof RegisterFormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};
    
    // 用户名验证
    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名长度至少为3位';
    }
    
    // 邮箱验证
    if (!formData.email.trim()) {
      newErrors.email = '邮箱不能为空';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = '请输入有效的邮箱地址';
      }
    }
    
    // 密码验证
    if (!formData.password) {
      newErrors.password = '密码不能为空';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度至少为6位';
    }
    
    // 确认密码验证
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理表单提交
  const handleSubmit = async (e: FormEvent): Promise<{ success: boolean; error?: string }> => {
    e.preventDefault();
    
    console.log('[前端注册表单] 开始处理表单提交');
    console.log('[前端注册表单] 表单数据:', formData);
    
    if (validateForm()) {
      console.log('[前端注册表单] 表单验证通过，调用注册函数');
      return await registerFunction(
        formData.username, 
        formData.email, 
        formData.password
      );
    }
    
    console.log('[前端注册表单] 表单验证失败:', errors);
    return { success: false, error: '请检查表单错误' };
  };

  return {
    formData,
    errors,
    handleChange,
    handleSubmit
  };
};