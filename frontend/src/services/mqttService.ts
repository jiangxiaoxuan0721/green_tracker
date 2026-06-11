import api from './api';

// ============================================================
// MQTT 相关接口类型定义
// ============================================================

export interface MqttDeviceStatus {
  device_id: string;
  name: string | null;  // 来自 DB 的设备名称
  status: string;  // "online" / "offline"
  last_seen: string | null;
  first_seen: string | null;
  ip_address: string | null;
  client_id: string | null;
  metadata: Record<string, any> | null;
  connect_history: Array<{ time: string; event: string }> | null;
  registered: boolean;
}

export type MqttDeviceDetail = MqttDeviceStatus;

export interface MqttDeviceListResponse {
  total: number;
  online_count: number;
  devices: MqttDeviceStatus[];
}

export interface CommandRequest {
  command: string;
  params?: Record<string, any>;
}

export interface CommandResponse {
  message: string;
  command_id: string;
  device_id: string;
  command: string;
  timestamp: string;
}

export interface CommandResult {
  command_id: string;
  device_id: string;
  command: string;
  payload: Record<string, any> | null;
  sent_at: string | null;
  response: Record<string, any> | null;
  acknowledged: boolean;
  responded_at: string | null;
}

export interface MqttStats {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  pending_commands: number;
  mqtt_broker: string;
  mqtt_connected: boolean;
  registered_device_ids: string[];
}

export interface MqttProvisionResponse {
  device_id: string;
  mqtt_username: string;
  mqtt_secret: string;
  message: string;
  mqtt_broker_host: string;
  mqtt_broker_port: number;
}

export interface SupportedCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  require_confirm: boolean;
  params_schema?: Record<string, any> | null;
}

export interface DeviceCommandsResponse {
  device_id: string;
  commands: SupportedCommand[];
}

export interface MqttHealth {
  status: string;
  service: string;
  mqtt_connected: boolean;
  broker: string;
  timestamp: string;
}

// ============================================================
// MQTT API 服务
// ============================================================

export const mqttService = {
  // 健康检查
  async healthCheck(): Promise<MqttHealth> {
    const response = await api.get<MqttHealth>('/api/mqtt/health');
    return response.data;
  },

  // 系统统计
  async getStats(): Promise<MqttStats> {
    const response = await api.get<MqttStats>('/api/mqtt/stats');
    return response.data;
  },

  // 获取 MQTT 设备列表
  async getDevices(status?: string): Promise<MqttDeviceListResponse> {
    const params = status ? { status } : {};
    const response = await api.get<MqttDeviceListResponse>('/api/mqtt/devices', { params });
    return response.data;
  },

  // 获取单个设备 MQTT 详情
  async getDevice(deviceId: string): Promise<MqttDeviceDetail> {
    const response = await api.get<MqttDeviceDetail>(`/api/mqtt/devices/${deviceId}`);
    return response.data;
  },

  // 向设备下发命令
  async sendCommand(deviceId: string, command: string, params?: Record<string, any>): Promise<CommandResponse> {
    const response = await api.post<CommandResponse>(
      `/api/mqtt/devices/${deviceId}/commands`,
      { command, params: params || {} }
    );
    return response.data;
  },

  // 获取设备支持的指令列表
  async getDeviceCommands(deviceId: string): Promise<DeviceCommandsResponse> {
    const response = await api.get<DeviceCommandsResponse>(`/api/mqtt/devices/${deviceId}/commands`);
    return response.data;
  },

  // 查询命令执行结果
  async getCommandResult(commandId: string): Promise<CommandResult> {
    const response = await api.get<CommandResult>(`/api/mqtt/commands/${commandId}`);
    return response.data;
  },

  // 为设备配置 MQTT 凭证
  async provisionDevice(deviceId: string, mqttSecret?: string): Promise<MqttProvisionResponse> {
    const response = await api.post<MqttProvisionResponse>(
      `/api/mqtt/devices/${deviceId}/provision`,
      mqttSecret ? { device_id: deviceId, mqtt_secret: mqttSecret } : { device_id: deviceId }
    );
    return response.data;
  },

  // 重新生成设备 MQTT 凭证（强制刷新）
  async regenerateDeviceCredentials(deviceId: string): Promise<MqttProvisionResponse> {
    const response = await api.post<MqttProvisionResponse>(
      `/api/mqtt/devices/${deviceId}/provision`,
      { device_id: deviceId, regenerate: true }
    );
    return response.data;
  },

  // 获取设备 MQTT 凭证
  async getDeviceCredentials(deviceId: string): Promise<{ mqtt_username: string; mqtt_secret: string; mqtt_broker_host: string; mqtt_broker_port: number }> {
    const response = await api.get<{ mqtt_username: string; mqtt_secret: string; mqtt_broker_host: string; mqtt_broker_port: number }>(
      `/api/mqtt/devices/${deviceId}/credentials`
    );
    return response.data;
  },
};

export default mqttService;
