from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class CollectionSessionBase(BaseModel):
    field_id: str = Field(..., description="农田ID")
    start_time: datetime = Field(..., description="任务开始时间")
    mission_type: str = Field(..., description="任务类型（巡检/定点/路径/应急）")
    end_time: Optional[datetime] = Field(None, description="任务结束时间")
    mission_name: Optional[str] = Field(None, description="任务名称")
    description: Optional[str] = Field(None, description="任务说明")
    weather_snapshot: Optional[Dict[str, Any]] = Field(None, description="采集时的环境快照")
    status: str = Field("planned", description="任务状态")

    class Config:
        schema_extra = {
            "example": {
                "field_id": "550e8400-e29b-41d4-a716-446655440000",
                "start_time": "2025-01-01T10:00:00",
                "mission_type": "巡检",
                "end_time": "2025-01-01T12:00:00",
                "mission_name": "春季巡检",
                "description": "春季农田全面巡检任务"
            }
        }


class CollectionSessionCreate(CollectionSessionBase):
    """创建采集会话请求模型"""
    pass


class CollectionSessionUpdate(BaseModel):
    """更新采集会话请求模型"""
    end_time: Optional[datetime] = Field(None, description="任务结束时间")
    mission_name: Optional[str] = Field(None, description="任务名称")
    description: Optional[str] = Field(None, description="任务说明")
    weather_snapshot: Optional[Dict[str, Any]] = Field(None, description="采集时的环境快照")
    status: Optional[str] = Field(None, description="任务状态")

    class Config:
        schema_extra = {
            "example": {
                "end_time": "2025-01-01T14:00:00",
                "status": "completed"
            }
        }


class CollectionSessionResponse(BaseModel):
    """采集会话响应模型"""
    id: str
    field_id: str
    creator_id: Optional[str]
    creator_name: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime]
    mission_type: str
    mission_name: Optional[str]
    description: Optional[str]
    weather_snapshot: Optional[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CollectionSessionWithFieldResponse(BaseModel):
    """包含农田信息的采集会话响应模型"""
    id: str
    field_id: str
    creator_id: Optional[str]
    field_name: str
    creator_name: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    mission_type: str
    mission_name: Optional[str]
    description: Optional[str]
    weather_snapshot: Optional[Dict[str, Any]]
    status: str
    created_at: Optional[str]
    updated_at: Optional[str]


__all__ = [
    "CollectionSessionBase",
    "CollectionSessionCreate",
    "CollectionSessionUpdate",
    "CollectionSessionResponse",
    "CollectionSessionWithFieldResponse"
]
