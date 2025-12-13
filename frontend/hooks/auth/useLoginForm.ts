import { useState, ChangeEvent, FormEvent } from 'react';

// 定义表单数据类型
interface LoginFormData {
  username: string;
  password: string;
}

// 定义表单错误类型
interface LoginFormErrors {
  username?: string;
  password?: string;
}

// 定义登录函数类型
type LoginFunction = (username: string, password: string) => Promise<{ success: boolean; error?: string }>;

// 定义返回类型
interface UseLoginFormReturn {
  formData: LoginFormData;
  errors: LoginFormErrors;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: FormEvent) => Promise<{ success: boolean; error?: string }>;
}

// 登录表单处理钩子
export const useLoginForm = (loginFunction: LoginFunction): UseLoginFormReturn => {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<LoginFormErrors>({});

  // 处理表单输入变化
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除当前字段的错误信息
    if (errors[name as keyof LoginFormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空';
    }
    
    if (!formData.password) {
      newErrors.password = '密码不能为空';
    } else if (formData.password.length < 8) {
      newErrors.password = '密码长度至少为8位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理表单提交
  const handleSubmit = async (e: FormEvent): Promise<{ success: boolean; error?: string }> => {
    e.preventDefault();
    
    if (validateForm()) {
      return await loginFunction(formData.username, formData.password);
    }
    
    return { success: false, error: '请检查表单错误' };
  };

  return {
    formData,
    errors,
    handleChange,
    handleSubmit
  };
};