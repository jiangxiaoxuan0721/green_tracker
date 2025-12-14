import api from './api';

// 定义接口类型
export interface FeedbackData {
  name?: string;
  email?: string;
  subject: string;
  content: string;
}

export interface FeedbackResponse {
  id: string;
  name?: string;
  email?: string;
  subject: string;
  content: string;
  created_at: string;
}

// 反馈相关的API服务
export const feedbackService = {
  // 提交反馈
  async submitFeedback(feedbackData: FeedbackData): Promise<FeedbackResponse> {
    console.log('[前端FeedbackService] 发送反馈请求到后端');
    console.log('[前端FeedbackService] 请求数据:', feedbackData);
    
    const response = await api.post<FeedbackResponse>('/api/feedback/', feedbackData);
    
    console.log('[前端FeedbackService] 收到反馈响应:', response.data);
    return response.data;
  },

  // 获取所有反馈
  async getAllFeedback(): Promise<FeedbackResponse[]> {
    console.log('[前端FeedbackService] 获取所有反馈');
    
    const response = await api.get<FeedbackResponse[]>('/api/feedback/');
    
    console.log('[前端FeedbackService] 收到反馈列表:', response.data);
    return response.data;
  }
};