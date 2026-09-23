from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime


class DeviceCommandCreateRequest(BaseModel):
    """下发设备控制指令请求"""
    device_id: str = Field(..., description="目标设备ID（须属于调用方用户名下；能否下发由该设备上报的密钥是否含 device_control 决定）")
    command: str = Field(..., description="指令名称，如 ping/get_info/get_metrics/reboot/set_config")
    params: Optional[Dict[str, Any]] = Field(None, description="指令参数，如 reboot 的 delay、set_config 的 key/value")
    timeout_seconds: Optional[int] = Field(
        300, ge=10, le=86400,
        description="指令有效期（秒）。超时未执行将被标记为 expired，默认 300 秒"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "device_id": "3f1c0b8e-0d3a-4a2b-9c1f-7d2e5a4b6c88",
                "command": "reboot",
                "params": {"delay": 5},
                "timeout_seconds": 300
            }
        }
    }


class DeviceCommandResultRequest(BaseModel):
    """设备回执请求"""
    status: str = Field(..., description="执行结果：acked（成功）/ failed（失败）")
    result: Optional[Dict[str, Any]] = Field(None, description="执行结果详情，由设备自行填充")
    error_message: Optional[str] = Field(None, description="失败原因（status=failed 时建议填写）")

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "acked",
                "result": {"uptime_seconds": 12830},
                "error_message": None
            }
        }
    }


class DeviceCommandResponse(BaseModel):
    """设备指令响应"""
    id: str
    command_id: str
    device_id: str
    device_name: Optional[str] = None
    command: str
    params: Optional[Dict[str, Any]] = None
    status: str
    transport: Optional[str] = None
    source: Optional[str] = None
    api_key_id: Optional[str] = None
    issued_by: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeviceCommandListResponse(BaseModel):
    """设备指令列表响应"""
    items: List[DeviceCommandResponse]
    pagination: Dict[str, Any] = Field(default_factory=dict)


class DeviceCommandDefinition(BaseModel):
    """支持的指令定义"""
    id: str
    label: str
    description: str = ""
    icon: Optional[str] = None
    require_confirm: bool = False
    params_schema: Optional[Dict[str, str]] = None


class DeviceCapabilities(BaseModel):
    """
    云端告知设备「你接下来能做什么」

    设备只持有密钥拷贝、无法解读权限含义，因此由云端在签到响应里
    把权限翻译成能力开关，设备按开关行事即可。
    """
    upload_data: bool = Field(False, description="是否允许上传采集数据（data_upload）")
    read_data: bool = Field(
        False,
        description="是否允许从云端读取/导出已上传的数据到本地（data_read），对应 GET /api/raw-data/*"
    )
    pull_tasks: bool = Field(
        False,
        description="是否允许拉取云端下发的采集任务；属设备作业通道的默认能力，不受权限约束"
    )
    receive_commands: bool = Field(False, description="云端是否会向该设备下发控制指令（device_control）")


class DeviceHeartbeatResponse(BaseModel):
    """设备签到响应（能力协商结果）"""
    device_id: str
    registered: bool = Field(..., description="是否已用密钥完成登记")
    capabilities: DeviceCapabilities = Field(default_factory=DeviceCapabilities)
    command_channel: Optional[str] = Field(
        None, description="指令通道：mqtt（在线实时）/ http（离线轮询）；不可受控时为 null"
    )
    poll_interval_seconds: Optional[int] = Field(
        None, description="http 通道的建议轮询间隔（秒）；不可受控时为 null"
    )
    server_time: datetime = Field(..., description="云端当前时间，供设备校时")


class DeviceControlGrant(BaseModel):
    """
    设备的远程控制授权状态

    依据「设备上报所使用的API密钥」判定（软关联），与调用者身份无关：
    设备用的密钥没有 device_control，控制台同样不能操控它。
    """
    device_id: str
    device_name: Optional[str] = None
    bound: bool = Field(False, description="设备是否已上报所使用的API密钥")
    control_granted: bool = Field(False, description="是否具备远程控制授权")
    reason: str = Field("", description="未授权原因（已授权时为空）")
    api_key_id: Optional[str] = None
    api_key_name: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    is_active: Optional[bool] = None
    is_expired: Optional[bool] = None
    expires_at: Optional[datetime] = None
    last_reported_at: Optional[datetime] = None


__all__ = [
    "DeviceCommandCreateRequest",
    "DeviceCommandResultRequest",
    "DeviceCommandResponse",
    "DeviceCommandListResponse",
    "DeviceCommandDefinition",
    "DeviceCapabilities",
    "DeviceHeartbeatResponse",
    "DeviceControlGrant",
]
