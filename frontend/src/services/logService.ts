import api from './api';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'success';
  source: string;
  message: string;
  detail?: string;
  related_id?: string;
  related_type?: string;
}

export interface LogListParams {
  page?: number;
  page_size?: number;
  level?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
}

export interface LogListResponse {
  total: number;
  page: number;
  page_size: number;
  items: LogEntry[];
}

export interface LogSourcesResponse {
  sources: string[];
}

const logService = {
  /**
   * 分页查询日志
   */
  async getLogs(params: LogListParams = {}): Promise<LogListResponse> {
    const response = await api.get('/api/logs/', { params });
    return response.data;
  },

  /**
   * 获取日志来源列表
   */
  async getSources(): Promise<LogSourcesResponse> {
    const response = await api.get('/api/logs/sources');
    return response.data;
  },

  /**
   * 导出日志为 CSV
   */
  async exportLogs(params: {
    level?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<Blob> {
    const response = await api.get('/api/logs/export', {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * 删除一条日志
   */
  async deleteLog(logId: string): Promise<void> {
    await api.delete(`/api/logs/${logId}`);
  },
};

export default logService;
