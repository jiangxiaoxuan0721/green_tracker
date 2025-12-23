import api from './api';

// 类型定义
export interface CollectionSession {
  id: string;
  field_id: string;
  creator_id?: string;
  start_time: string;
  end_time?: string;
  mission_type: string;
  mission_name?: string;
  description?: string;
  weather_snapshot?: Record<string, any>;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface CollectionSessionWithField {
  id: string;
  field_id: string;
  creator_id?: string;
  field_name: string;
  start_time?: string;
  end_time?: string;
  mission_type: string;
  mission_name?: string;
  description?: string;
  weather_snapshot?: Record<string, any>;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionSessionCreate {
  field_id: string;
  creator_id?: string;
  start_time: string;
  mission_type: string;
  end_time?: string;
  mission_name?: string;
  description?: string;
  weather_snapshot?: Record<string, any>;
  status?: string;
}

export interface CollectionSessionUpdate {
  end_time?: string;
  mission_name?: string;
  description?: string;
  weather_snapshot?: Record<string, any>;
  status?: string;
}

export interface SessionParams {
  limit?: number;
  offset?: number;
  field_id?: string;
  start_date?: string;
  end_date?: string;
  mission_types?: string;
  status?: string;
}

// 采集任务/会话相关的API服务
export const collectionSessionService = {
  // 获取采集任务列表（含农田信息）
  getSessions: async (params: SessionParams = {}): Promise<CollectionSessionWithField[]> => {
    const {
      limit = 100,
      offset = 0,
      field_id,
      start_date,
      end_date,
      mission_types,
      status
    } = params;
    
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());
    
    if (field_id) queryParams.append('field_id', field_id);
    if (start_date) queryParams.append('start_date', start_date);
    if (end_date) queryParams.append('end_date', end_date);
    if (mission_types) queryParams.append('mission_types', mission_types);
    if (status) queryParams.append('status', status);
    
    const response = await api.get(`/api/collection-sessions?${queryParams.toString()}`);
    return response.data;
  },
  
  // 根据ID获取采集任务详情
  getSessionById: async (sessionId: string): Promise<CollectionSession> => {
    const response = await api.get(`/api/collection-sessions/${sessionId}`);
    return response.data;
  },
  
  // 创建新的采集任务
  createSession: async (sessionData: CollectionSessionCreate): Promise<CollectionSession> => {
    const response = await api.post('/api/collection-sessions', sessionData);
    return response.data;
  },
  
  // 更新采集任务
  updateSession: async (sessionId: string, updateData: CollectionSessionUpdate): Promise<CollectionSession> => {
    const response = await api.put(`/api/collection-sessions/${sessionId}`, updateData);
    return response.data;
  },
  
  // 删除采集任务
  deleteSession: async (sessionId: string): Promise<{message: string}> => {
    const response = await api.delete(`/api/collection-sessions/${sessionId}`);
    return response.data;
  },
  
  // 获取指定农田的最新采集任务
  getLatestSessionByField: async (fieldId: string, missionType?: string): Promise<CollectionSession> => {
    const queryParams = new URLSearchParams();
    if (missionType) queryParams.append('mission_type', missionType);
    
    const response = await api.get(`/api/collection-sessions/field/${fieldId}/latest?${queryParams.toString()}`);
    return response.data;
  },
  
  // 根据状态获取采集任务列表
  getSessionsByStatus: async (status: string, limit = 100, offset = 0): Promise<CollectionSession[]> => {
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());
    
    const response = await api.get(`/api/collection-sessions/status/${status}?${queryParams.toString()}`);
    return response.data;
  }
};