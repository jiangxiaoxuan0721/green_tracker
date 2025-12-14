import api from './api';

// 定义地块接口类型
export interface Field {
  id: string;
  name: string;
  description?: string;
  location_wkt: string;
  area_m2?: number;
  crop_type?: string;
  soil_type?: string;
  irrigation_type?: string;
  owner_id: string;
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FieldCreate {
  name: string;
  description?: string;
  location_wkt: string;
  area_m2?: number;
  crop_type?: string;
  soil_type?: string;
  irrigation_type?: string;
  organization_id?: string;
}

export interface FieldUpdate {
  name?: string;
  description?: string;
  location_wkt?: string;
  area_m2?: number;
  crop_type?: string;
  soil_type?: string;
  irrigation_type?: string;
  is_active?: boolean;
}

export interface PointQuery {
  longitude: number;
  latitude: number;
  owner_id?: string;
  organization_id?: string;
  active_only?: boolean;
}

export interface FieldListParams {
  owner_id?: string;
  organization_id?: string;
  active_only?: boolean;
  keyword?: string;
  crop_type?: string;
  soil_type?: string;
  irrigation_type?: string;
  limit?: number;
  offset?: number;
}

// 地块相关的API服务
export const fieldService = {
  // 创建地块
  async createField(fieldData: FieldCreate): Promise<Field> {
    console.log('[前端FieldService] 发送创建地块请求');
    console.log('[前端FieldService] 请求数据:', fieldData);
    
    const response = await api.post<Field>('/api/fields/', fieldData);
    
    console.log('[前端FieldService] 创建地块成功:', response.data);
    return response.data;
  },

  // 获取地块列表
  async getFields(params?: FieldListParams): Promise<Field[]> {
    console.log('[前端FieldService] 发送获取地块列表请求');
    console.log('[前端FieldService] 查询参数:', params);
    
    const response = await api.get<Field[]>('/api/fields/', { params });
    
    console.log('[前端FieldService] 获取地块列表成功:', response.data);
    return response.data;
  },

  // 根据ID获取特定地块
  async getFieldById(fieldId: string): Promise<Field> {
    console.log('[前端FieldService] 发送获取特定地块请求');
    console.log('[前端FieldService] 地块ID:', fieldId);
    
    const response = await api.get<Field>(`/api/fields/${fieldId}`);
    
    console.log('[前端FieldService] 获取地块成功:', response.data);
    return response.data;
  },

  // 更新地块信息
  async updateField(fieldId: string, fieldData: FieldUpdate): Promise<Field> {
    console.log('[前端FieldService] 发送更新地块请求');
    console.log('[前端FieldService] 地块ID:', fieldId);
    console.log('[前端FieldService] 更新数据:', fieldData);
    
    const response = await api.put<Field>(`/api/fields/${fieldId}`, fieldData);
    
    console.log('[前端FieldService] 更新地块成功:', response.data);
    return response.data;
  },

  // 删除地块
  async deleteField(fieldId: string, softDelete: boolean = true): Promise<void> {
    console.log('[前端FieldService] 发送删除地块请求');
    console.log('[前端FieldService] 地块ID:', fieldId);
    console.log('[前端FieldService] 软删除:', softDelete);
    
    try {
      await api.delete(`/api/fields/${fieldId}?soft_delete=${softDelete}`);
      console.log('[前端FieldService] 删除地块成功');
    } catch (error: any) {
      console.error('[前端FieldService] 删除地块失败:', error);
      // 如果是认证错误，不重新抛出，让API拦截器处理
      if (error.response?.status === 401) {
        return Promise.reject(error);
      }
      // 其他错误也重新抛出
      throw error;
    }
  },

  // 恢复已软删除的地块
  async restoreField(fieldId: string): Promise<Field> {
    console.log('[前端FieldService] 发送恢复地块请求');
    console.log('[前端FieldService] 地块ID:', fieldId);
    
    const response = await api.post<Field>(`/api/fields/${fieldId}/restore`);
    
    console.log('[前端FieldService] 恢复地块成功:', response.data);
    return response.data;
  },

  // 根据点坐标查找地块
  async findFieldsByPoint(pointData: PointQuery): Promise<Field[]> {
    console.log('[前端FieldService] 发送点查询请求');
    console.log('[前端FieldService] 查询数据:', pointData);
    
    const response = await api.post<Field[]>('/api/fields/point-query', pointData);
    
    console.log('[前端FieldService] 点查询成功:', response.data);
    return response.data;
  }
};