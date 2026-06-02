"""
MQTT 云端设备管理模块

提供:
- MQTT Broker 连接管理
- 物理设备在线状态追踪
- 云→设备指令下发
- REST API 路由
"""

from .mqtt_client import CloudMQTTClient, get_mqtt_client
from .device_manager import DeviceStateManager, get_device_manager
from .routes import router as mqtt_router
from .schemas import (
    CommandRequest,
    CommandResponse,
    DeviceMqttStatus,
    MqttStatsResponse,
)

__all__ = [
    "CloudMQTTClient",
    "get_mqtt_client",
    "DeviceStateManager",
    "get_device_manager",
    "mqtt_router",
    "CommandRequest",
    "CommandResponse",
    "DeviceMqttStatus",
    "MqttStatsResponse",
]
