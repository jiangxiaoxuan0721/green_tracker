import api from './api';

// 定义原始数据接口类型
export interface RawData {
  id: string;
  session_id: string;
  data_type: string;
  data_value: string;
  device_id?: string;
  device_display_name?: string;
  field_id?: string;
  field_display_name?: string;
  data_subtype?: string;
  data_unit?: string;
  data_format?: string;
  bucket_name?: string;
  object_key?: string;
  location_geom?: string;
  altitude_m?: number;
  heading?: number;
  sensor_meta?: Record<string, any>;
  file_meta?: Record<string, any>;
  acquisition_meta?: Record<string, any>;
  quality_score?: number;
  quality_flags?: string[];
  checksum?: string;
  is_valid?: boolean;
  validation_notes?: string;
  capture_time?: string;
  created_at: string;
  updated_at?: string;
  processing_status?: string;
  ai_status?: string;
}

export interface RawDataListParams {
  user_id: string;
  page?: number;
  page_size?: number;
  device_id?: string;
  field_id?: string;
  data_type?: string;
  data_subtype?: string;
  start_time?: string;
  end_time?: string;
}

export interface RawDataCreate {
  session_id: string;
  data_type: string;
  data_value: string;
  device_id?: string;
  device_display_name?: string;
  field_id?: string;
  field_display_name?: string;
  data_subtype?: string;
  data_unit?: string;
  data_format?: string;
  bucket_name?: string;
  object_key?: string;
  location_geom?: string;
  altitude_m?: number;
  heading?: number;
  sensor_meta?: Record<string, any>;
  file_meta?: Record<string, any>;
  acquisition_meta?: Record<string, any>;
  quality_score?: number;
  quality_flags?: string[];
  checksum?: string;
  is_valid?: boolean;
  validation_notes?: string;
  capture_time?: string;
}

export interface RawDataTag {
  id: string;
  raw_data_id: string;
  tag_category: string;
  tag_value: string;
  confidence?: number;
  source: string;
  created_at: string;
}

export const rawDataService = {
  // 获取原始数据列表
  async getRawDataList(params: RawDataListParams) {
    console.log('[前端RawDataService] 发送获取原始数据列表请求');
    console.log('[前端RawDataService] 请求参数:', params);
    
    try {
      const response = await api.get('/api/raw-data/list', { params });
      console.log('[前端RawDataService] 获取原始数据列表成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取原始数据列表失败:', error);
      throw error;
    }
  },

  // 获取原始数据详情
  async getRawDataDetail(rawDataId: string, userId: string) {
    console.log('[前端RawDataService] 发送获取原始数据详情请求');
    console.log('[前端RawDataService] 数据ID:', rawDataId, '用户ID:', userId);
    
    try {
      const response = await api.get(`/api/raw-data/${rawDataId}`, {
        params: { user_id: userId }
      });
      console.log('[前端RawDataService] 获取原始数据详情成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取原始数据详情失败:', error);
      throw error;
    }
  },

  // 删除原始数据
  async deleteRawData(rawDataId: string, userId: string) {
    console.log('[前端RawDataService] 发送删除原始数据请求');
    console.log('[前端RawDataService] 数据ID:', rawDataId, '用户ID:', userId);
    
    try {
      const response = await api.delete(`/api/raw-data/${rawDataId}`, {
        data: { user_id: userId }
      });
      console.log('[前端RawDataService] 删除原始数据成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('删除原始数据失败:', error);
      throw error;
    }
  },

  // 更新处理状态
  async updateProcessingStatus(rawDataId: string, processingStatus: string, userId: string) {
    console.log('[前端RawDataService] 发送更新处理状态请求');
    console.log('[前端RawDataService] 数据ID:', rawDataId, '状态:', processingStatus, '用户ID:', userId);
    
    try {
      const response = await api.put(`/api/raw-data/${rawDataId}/processing-status`, {
        processing_status: processingStatus,
        user_id: userId
      });
      console.log('[前端RawDataService] 更新处理状态成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('更新处理状态失败:', error);
      throw error;
    }
  },

  // 更新AI分析状态
  async updateAIStatus(rawDataId: string, aiStatus: string, userId: string) {
    console.log('[前端RawDataService] 发送更新AI分析状态请求');
    console.log('[前端RawDataService] 数据ID:', rawDataId, '状态:', aiStatus, '用户ID:', userId);
    
    try {
      const response = await api.put(`/api/raw-data/${rawDataId}/ai-status`, {
        ai_status: aiStatus,
        user_id: userId
      });
      console.log('[前端RawDataService] 更新AI分析状态成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('更新AI分析状态失败:', error);
      throw error;
    }
  },

  // 添加原始数据标签
  async addRawDataTag(
    rawDataId: string, 
    tagCategory: string, 
    tagValue: string, 
    userId: string,
    confidence?: number,
    source?: string
  ) {
    console.log('[前端RawDataService] 发送添加原始数据标签请求');
    console.log('[前端RawDataService] 数据ID:', rawDataId, '标签:', tagCategory, tagValue, '用户ID:', userId);
    
    try {
      const response = await api.post(`/api/raw-data/${rawDataId}/tags`, {
        tag_category: tagCategory,
        tag_value: tagValue,
        confidence,
        source: source || 'manual',
        user_id: userId
      });
      console.log('[前端RawDataService] 添加原始数据标签成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('添加原始数据标签失败:', error);
      throw error;
    }
  },

  // 获取原始数据标签
  async getRawDataTags(rawDataId: string, userId: string) {
    console.log('[前端RawDataService] 发送获取原始数据标签请求');
    console.log('[前端RawDataService] 数据ID:', rawDataId, '用户ID:', userId);
    
    try {
      const response = await api.get(`/api/raw-data/${rawDataId}/tags`, {
        params: { user_id: userId }
      });
      console.log('[前端RawDataService] 获取原始数据标签成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取原始数据标签失败:', error);
      throw error;
    }
  },

  // 导出原始数据
  async exportRawData(params: {
    user_id: string;
    format?: 'csv' | 'json';
    device_id?: string;
    field_id?: string;
    data_type?: string;
    data_subtype?: string;
    start_time?: string;
    end_time?: string;
  }) {
    console.log('[前端RawDataService] 发送导出原始数据请求');
    console.log('[前端RawDataService] 导出参数:', params);
    
    try {
      const response = await api.get('/api/raw-data/export', { 
        params,
        responseType: 'blob'
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `raw_data_export.${params.format || 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('[前端RawDataService] 导出原始数据成功');
      return { success: true };
    } catch (error) {
      console.error('导出原始数据失败:', error);
      throw error;
    }
  }
};

// 为了向后兼容，导出单独的函数
export const getRawDataList = rawDataService.getRawDataList;
export const getRawDataDetail = rawDataService.getRawDataDetail;
export const deleteRawData = rawDataService.deleteRawData;
export const updateProcessingStatus = rawDataService.updateProcessingStatus;
export const updateAIStatus = rawDataService.updateAIStatus;
export const addRawDataTag = rawDataService.addRawDataTag;
export const getRawDataTags = rawDataService.getRawDataTags;
export const exportRawData = rawDataService.exportRawData;