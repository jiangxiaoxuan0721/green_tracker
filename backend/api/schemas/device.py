from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID


class DeviceCreate(BaseModel):
    name: str = Field(..., description="设备名称")
    device_type: str = Field(..., description="设备类型 (satellite/uav/ugv/robot/sensor)")
    platform_level: str = Field(..., description="平台层级 (天/空/地/具身)")
    model: Optional[str] = Field(None, description="设备型号")
    manufacturer: Optional[str] = Field(None, description="设备厂商")
    sensors: Optional[Dict[str, Any]] = Field(None, description="传感器配置")
    actuators: Optional[Dict[str, Any]] = Field(None, description="执行机构配置")
    description: Optional[str] = Field(None, description="设备说明")

    class Config:
        schema_extra = {
            "example": {
                "name": "多光谱巡检无人机01",
                "device_type": "uav",
                "platform_level": "空",
                "model": "DJI M300",
                "manufacturer": "DJI",
                "sensors": {"RGB": True, "multispectral": True, "thermal": False},
                "actuators": {"flight": True},
                "description": "多光谱农业巡检无人机"
            }
        }


class DeviceUpdate(BaseModel):
    name: Optional[str] = Field(None, description="设备名称")
    device_type: Optional[str] = Field(None, description="设备类型")
    platform_level: Optional[str] = Field(None, description="平台层级")
    model: Optional[str] = Field(None, description="设备型号")
    manufacturer: Optional[str] = Field(None, description="设备厂商")
    sensors: Optional[Dict[str, Any]] = Field(None, description="传感器配置")
    actuators: Optional[Dict[str, Any]] = Field(None, description="执行机构配置")
    description: Optional[str] = Field(None, description="设备说明")
    is_active: Optional[bool] = Field(None, description="是否活跃")

    class Config:
        schema_extra = {
            "example": {
                "name": "更新后的设备名称",
                "description": "更新后的设备说明",
                "sensors": {"RGB": True, "multispectral": True, "thermal": True}
            }
        }


class DeviceResponse(BaseModel):
    id: Union[str, UUID]
    name: str
    device_type: str
    platform_level: str
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    sensors: Optional[Dict[str, Any]] = None
    actuators: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    owner_id: Optional[Union[str, UUID]] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator('id', 'owner_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """将UUID对象转换为字符串"""
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class DeviceListParams(BaseModel):
    owner_id: Optional[str] = Field(None, description="所有者ID")
    device_type: Optional[str] = Field(None, description="设备类型")
    platform_level: Optional[str] = Field(None, description="平台层级")
    active_only: Optional[bool] = Field(True, description="是否只获取活跃设备")
    keyword: Optional[str] = Field(None, description="搜索关键词")
    has_sensor: Optional[str] = Field(None, description="包含特定传感器的设备")
    has_actuator: Optional[str] = Field(None, description="包含特定执行机构的设备")

    class Config:
        schema_extra = {
            "example": {
                "owner_id": "550e8400-e29b-41d4-a716-446655440000",
                "device_type": "uav",
                "active_only": True,
                "has_sensor": "multispectral"
            }
        }