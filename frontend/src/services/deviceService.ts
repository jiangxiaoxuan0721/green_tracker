import api from './api';

// 定义设备接口类型
export interface Device {
  id: string;
  device_type: string;
  platform_level: string;
  model?: string;
  manufacturer?: string;
  sensors?: Record<string, any>;
  actuators?: Record<string, any>;
  description?: string;
  owner_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DeviceCreate {
  device_type: string;
  platform_level: string;
  model?: string;
  manufacturer?: string;
  sensors?: Record<string, any>;
  actuators?: Record<string, any>;
  description?: string;
}

export interface DeviceUpdate {
  device_type?: string;
  platform_level?: string;
  model?: string;
  manufacturer?: string;
  sensors?: Record<string, any>;
  actuators?: Record<string, any>;
  description?: string;
  is_active?: boolean;
}

export interface DeviceListParams {
  owner_id?: string;
  device_type?: string;
  platform_level?: string;
  active_only?: boolean;
  keyword?: string;
  has_sensor?: string;
  has_actuator?: string;
  limit?: number;
  offset?: number;
}

// 设备相关的API服务
export const deviceService = {
  // 创建设备
  async createDevice(deviceData: DeviceCreate): Promise<Device> {
    console.log('[前端DeviceService] 发送创建设备请求');
    console.log('[前端DeviceService] 请求数据:', deviceData);
    
    const response = await api.post<Device>('/api/devices/', deviceData);
    
    console.log('[前端DeviceService] 创建设备成功:', response.data);
    return response.data;
  },

  // 获取设备列表
  async getDevices(params?: DeviceListParams): Promise<Device[]> {
    console.log('[前端DeviceService] 发送获取设备列表请求');
    console.log('[前端DeviceService] 查询参数:', params);
    
    const response = await api.get<Device[]>('/api/devices/', { params });
    
    console.log('[前端DeviceService] 获取设备列表成功:', response.data);
    return response.data;
  },

  // 根据ID获取特定设备
  async getDeviceById(deviceId: string): Promise<Device> {
    console.log('[前端DeviceService] 发送获取特定设备请求');
    console.log('[前端DeviceService] 设备ID:', deviceId);
    
    const response = await api.get<Device>(`/api/devices/${deviceId}`);
    
    console.log('[前端DeviceService] 获取设备成功:', response.data);
    return response.data;
  },

  // 更新设备信息
  async updateDevice(deviceId: string, deviceData: DeviceUpdate): Promise<Device> {
    console.log('[前端DeviceService] 发送更新设备请求');
    console.log('[前端DeviceService] 设备ID:', deviceId);
    console.log('[前端DeviceService] 更新数据:', deviceData);
    
    const response = await api.put<Device>(`/api/devices/${deviceId}`, deviceData);
    
    console.log('[前端DeviceService] 更新设备成功:', response.data);
    return response.data;
  },

  // 删除设备
  async deleteDevice(deviceId: string, softDelete: boolean = true): Promise<void> {
    console.log('[前端DeviceService] 发送删除设备请求');
    console.log('[前端DeviceService] 设备ID:', deviceId);
    console.log('[前端DeviceService] 软删除:', softDelete);
    
    try {
      await api.delete(`/api/devices/${deviceId}?soft_delete=${softDelete}`);
      console.log('[前端DeviceService] 删除设备成功');
    } catch (error: any) {
      console.error('[前端DeviceService] 删除设备失败:', error);
      // 如果是认证错误，不重新抛出，让API拦截器处理
      if (error.response?.status === 401) {
        return Promise.reject(error);
      }
      // 其他错误也重新抛出
      throw error;
    }
  },

  // 恢复已软删除的设备
  async restoreDevice(deviceId: string): Promise<Device> {
    console.log('[前端DeviceService] 发送恢复设备请求');
    console.log('[前端DeviceService] 设备ID:', deviceId);
    
    const response = await api.post<Device>(`/api/devices/${deviceId}/restore`);
    
    console.log('[前端DeviceService] 恢复设备成功:', response.data);
    return response.data;
  },

  // 根据设备类型获取设备列表
  async getDevicesByType(deviceType: string, activeOnly: boolean = true): Promise<Device[]> {
    console.log('[前端DeviceService] 发送获取设备类型请求');
    console.log('[前端DeviceService] 设备类型:', deviceType);
    console.log('[前端DeviceService] 仅活跃:', activeOnly);
    
    const response = await api.get<Device[]>(`/api/devices/types/${deviceType}`, { 
      params: { active_only: activeOnly }
    });
    
    console.log('[前端DeviceService] 获取设备类型成功:', response.data);
    return response.data;
  },

  // 根据平台层级获取设备列表
  async getDevicesByPlatform(platformLevel: string, activeOnly: boolean = true): Promise<Device[]> {
    console.log('[前端DeviceService] 发送获取平台层级请求');
    console.log('[前端DeviceService] 平台层级:', platformLevel);
    console.log('[前端DeviceService] 仅活跃:', activeOnly);
    
    const response = await api.get<Device[]>(`/api/devices/platforms/${platformLevel}`, { 
      params: { active_only: activeOnly }
    });
    
    console.log('[前端DeviceService] 获取平台层级成功:', response.data);
    return response.data;
  }
};