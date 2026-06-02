"""
MQTT 模块 Pydantic 数据模型
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class CommandRequest(BaseModel):
    """向设备下发命令的请求"""
    command: str = Field(..., description="命令名称，如 get_info / reboot / ping / set_config")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="命令参数")


class CommandResponse(BaseModel):
    """命令下发响应"""
    message: str
    command_id: str
    device_id: str
    command: str
    timestamp: str


class CommandResult(BaseModel):
    """命令执行结果查询"""
    command_id: str
    device_id: str
    command: str
    payload: Optional[Dict[str, Any]] = None
    sent_at: Optional[str] = None
    response: Optional[Dict[str, Any]] = None
    acknowledged: bool = False
    responded_at: Optional[str] = None


class DeviceMqttStatus(BaseModel):
    """设备 MQTT 在线状态"""
    device_id: str
    name: Optional[str] = None  # 从 DB 查询的设备名称
    status: str = "offline"  # "online" / "offline"（与 DeviceStateManager 一致）
    last_seen: Optional[str] = None
    first_seen: Optional[str] = None
    ip_address: Optional[str] = None
    client_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    connect_history: Optional[list] = None
    registered: bool = False


class DeviceMqttDetail(DeviceMqttStatus):
    """设备 MQTT 详细信息（继承状态，connect_history 已在父类中）"""
    pass


class MqttStatsResponse(BaseModel):
    """MQTT 系统统计"""
    total_devices: int
    online_devices: int
    offline_devices: int
    pending_commands: int
    mqtt_broker: str
    mqtt_connected: bool
    registered_device_ids: list


class MqttProvisionRequest(BaseModel):
    """设备 MQTT 凭证配置请求"""
    device_id: str = Field(..., description="设备ID（DB中的逻辑设备ID）")
    mqtt_secret: Optional[str] = Field(None, description="MQTT 密钥，不传则自动生成")
    regenerate: bool = Field(False, description="是否强制重新生成密钥")


class MqttProvisionResponse(BaseModel):
    """设备 MQTT 凭证配置响应"""
    device_id: str
    mqtt_username: str
    mqtt_secret: str
    message: str
    mqtt_broker_host: str
    mqtt_broker_port: int
