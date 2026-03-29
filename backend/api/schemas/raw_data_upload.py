from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DataType(str, Enum):
    """数据类型枚举"""
    ENVIRONMENTAL = "environmental"  # 环境数据
    SOIL = "soil"  # 土壤数据
    FILE = "file"  # 文件数据（包括图像、视频等所有存储在MinIO中的文件）


class DataSubType(str, Enum):
    """数据子类型枚举"""
    # FILE 类型的子类型
    RGB = "rgb"  # RGB图像
    NIR = "nir"  # 近红外图像
    RED_EDGE = "red_edge"  # 红边图像
    THERMAL = "thermal"  # 热成像
    MULTISPECTRAL = "multispectral"  # 多光谱
    VIDEO = "video"  # 视频

    # ENVIRONMENTAL 类型的子类型
    TEMPERATURE = "temperature"  # 温度
    HUMIDITY = "humidity"  # 湿度
    CO2 = "co2"  # 二氧化碳浓度
    LIGHT = "light"  # 光照强度
    PRESSURE = "pressure"  # 气压

    # SOIL 类型的子类型
    MOISTURE = "moisture"  # 土壤湿度
    PH = "ph"  # 土壤酸碱度
    EC = "ec"  # 电导率
    TEMPERATURE_SOIL = "temperature_soil"  # 土壤温度


class DataUnit(str, Enum):
    """数据单位枚举"""
    # 温度单位
    CELSIUS = "°C"  # 摄氏度
    FAHRENHEIT = "°F"  # 华氏度

    # 湿度单位
    PERCENT = "%"  # 百分比

    # 浓度单位
    PPM = "ppm"  # 百万分比

    # 光照单位
    LUX = "lux"  # 勒克斯

    # 气压单位
    HPA = "hPa"  # 百帕
    KPA = "kPa"  # 千帕

    # 长度单位
    CM = "cm"  # 厘米
    M = "m"  # 米

    # 电导率单位
    US_CM = "μS/cm"  # 微西门子每厘米
    DS_M = "dS/m"  # 分西门子每米

    # pH值
    PH = "pH"  # pH值（无量纲）


# 数据子类型到单位的映射表
SUBTYPE_UNIT_MAP = {
    # 环境数据
    DataSubType.TEMPERATURE: DataUnit.CELSIUS,
    DataSubType.HUMIDITY: DataUnit.PERCENT,
    DataSubType.CO2: DataUnit.PPM,
    DataSubType.LIGHT: DataUnit.LUX,
    DataSubType.PRESSURE: DataUnit.HPA,
    # 土壤数据
    DataSubType.MOISTURE: DataUnit.PERCENT,
    DataSubType.PH: DataUnit.PH,
    DataSubType.EC: DataUnit.US_CM,
    DataSubType.TEMPERATURE_SOIL: DataUnit.CELSIUS,
}


class UploadDataRequest(BaseModel):
    """数字数据上传请求模型"""
    session_id: str = Field(..., description="采集会话ID")
    data_type: DataType = Field(..., description="数据类型")
    data_subtype: DataSubType = Field(..., description="数据子类型")
    data_value: str = Field(..., description="数据值（数值）")
    capture_time: Optional[datetime] = Field(None, description="采集时间")
    location_geom: Optional[str] = Field(None, description="位置几何信息（WKT格式）")
    altitude_m: Optional[float] = Field(None, description="采集高度（米）")
    heading: Optional[float] = Field(None, description="朝向（度）")
    sensor_meta: Optional[Dict[str, Any]] = Field(None, description="传感器元数据")
    quality_score: Optional[float] = Field(None, description="质量评分（0-1）")
    is_valid: Optional[bool] = Field(True, description="是否有效")
    validation_notes: Optional[str] = Field(None, description="验证备注")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "data_type": "environmental",
                "data_subtype": "temperature",
                "data_value": "25.5",
                "capture_time": "2024-01-15T10:30:00",
                "location_geom": "POINT(116.397428 39.90923)",
                "altitude_m": 100.0
            }
        }
    }


class UploadFileResponse(BaseModel):
    """文件上传响应模型"""
    data_id: str = Field(..., description="数据ID")
    object_key: str = Field(..., description="MinIO对象路径")
    access_url: str = Field(..., description="访问URL")
    data_type: DataType = Field(..., description="数据类型")
    data_subtype: DataSubType = Field(..., description="数据子类型")
    file_size_bytes: int = Field(..., description="文件大小（字节）")
    file_size_mb: float = Field(..., description="文件大小（MB）")
    data_format: str = Field(..., description="数据格式")
    upload_time: str = Field(..., description="上传时间")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "data_id": "data-uuid",
                "object_key": "raw/images/uuid_timestamp.jpg",
                "access_url": "http://minio.example.com/...",
                "data_type": "file",
                "data_subtype": "rgb",
                "file_size_bytes": 1024000,
                "file_size_mb": 1.02,
                "data_format": "jpeg",
                "upload_time": "2024-01-15T10:30:00"
            }
        }
    }


class UploadDataResponse(BaseModel):
    """数字数据上传响应模型"""
    data_id: str = Field(..., description="数据ID")
    data_type: DataType = Field(..., description="数据类型")
    data_subtype: DataSubType = Field(..., description="数据子类型")
    data_value: str = Field(..., description="数据值")
    upload_time: str = Field(..., description="上传时间")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "data_id": "data-uuid",
                "data_type": "environmental",
                "data_subtype": "temperature",
                "data_value": "25.5",
                "upload_time": "2024-01-15T10:30:00"
            }
        }
    }


__all__ = [
    "DataType",
    "DataSubType",
    "DataUnit",
    "UploadDataRequest",
    "UploadFileResponse",
    "UploadDataResponse"
]
