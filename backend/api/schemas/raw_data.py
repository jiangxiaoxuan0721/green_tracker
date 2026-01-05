from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class RawDataRequest(BaseModel):
    """原始数据请求模型"""
    session_id: str = Field(..., description="采集会话ID")
    data_type: str = Field(..., description="数据类型")
    data_value: str = Field(..., description="数据值")
    device_id: Optional[str] = Field(None, description="设备ID")
    device_display_name: Optional[str] = Field(None, description="设备前端显示名称")
    field_id: Optional[str] = Field(None, description="地块ID")
    field_display_name: Optional[str] = Field(None, description="地块前端显示名称")
    data_subtype: Optional[str] = Field(None, description="数据子类型")
    data_unit: Optional[str] = Field(None, description="数据单位")
    data_format: Optional[str] = Field(None, description="数据格式")
    bucket_name: Optional[str] = Field(None, description="MinIO bucket名称")
    object_key: Optional[str] = Field(None, description="MinIO对象路径")
    location_geom: Optional[str] = Field(None, description="位置几何信息")
    altitude_m: Optional[float] = Field(None, description="采集高度")
    heading: Optional[float] = Field(None, description="朝向")
    sensor_meta: Optional[Dict[str, Any]] = Field(None, description="传感器元数据")
    file_meta: Optional[Dict[str, Any]] = Field(None, description="文件元数据")
    acquisition_meta: Optional[Dict[str, Any]] = Field(None, description="采集元数据")
    quality_score: Optional[float] = Field(None, description="质量评分")
    quality_flags: Optional[List[str]] = Field(None, description="质量标记")
    checksum: Optional[str] = Field(None, description="文件校验值")
    is_valid: Optional[bool] = Field(True, description="是否有效")
    validation_notes: Optional[str] = Field(None, description="验证备注")
    capture_time: Optional[datetime] = Field(None, description="采集时间")

    class Config:
        schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "data_type": "image",
                "data_value": "path/to/image.jpg",
                "device_id": "device-uuid",
                "device_display_name": "无人机A1",
                "field_id": "field-uuid",
                "field_display_name": "示范田A区"
            }
        }


class RawDataTagRequest(BaseModel):
    """原始数据标签请求模型"""
    raw_data_id: str = Field(..., description="原始数据ID")
    tag_category: str = Field(..., description="标签类别")
    tag_value: str = Field(..., description="标签值")
    confidence: Optional[float] = Field(None, description="置信度")
    source: Optional[str] = Field("manual", description="标签来源")

    class Config:
        schema_extra = {
            "example": {
                "raw_data_id": "data-uuid",
                "tag_category": "crop",
                "tag_value": "小麦",
                "confidence": 0.95,
                "source": "ai"
            }
        }


class ProcessingStatusRequest(BaseModel):
    """处理状态更新请求模型"""
    processing_status: str = Field(..., description="处理状态")

    class Config:
        schema_extra = {
            "example": {
                "processing_status": "processed"
            }
        }


class AIStatusRequest(BaseModel):
    """AI状态更新请求模型"""
    ai_status: str = Field(..., description="AI分析状态")

    class Config:
        schema_extra = {
            "example": {
                "ai_status": "analyzed"
            }
        }


class RawDataResponse(BaseModel):
    """原始数据响应模型"""
    id: str
    session_id: str
    user_id: str
    data_type: str
    data_value: str
    device_id: Optional[str] = None
    device_display_name: Optional[str] = None
    field_id: Optional[str] = None
    field_display_name: Optional[str] = None
    data_subtype: Optional[str] = None
    data_unit: Optional[str] = None
    data_format: Optional[str] = None
    bucket_name: Optional[str] = None
    object_key: Optional[str] = None
    location_geom: Optional[str] = None
    altitude_m: Optional[float] = None
    heading: Optional[float] = None
    sensor_meta: Optional[Dict[str, Any]] = None
    file_meta: Optional[Dict[str, Any]] = None
    acquisition_meta: Optional[Dict[str, Any]] = None
    quality_score: Optional[float] = None
    quality_flags: Optional[List[str]] = None
    checksum: Optional[str] = None
    is_valid: Optional[bool] = None
    validation_notes: Optional[str] = None
    capture_time: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    processing_status: Optional[str] = None
    ai_status: Optional[str] = None

    class Config:
        from_attributes = True


class RawDataListResponse(BaseModel):
    """原始数据列表响应模型"""
    total: int
    items: List[RawDataResponse]


__all__ = [
    "RawDataRequest",
    "RawDataTagRequest",
    "ProcessingStatusRequest",
    "AIStatusRequest",
    "RawDataResponse",
    "RawDataListResponse"
]
