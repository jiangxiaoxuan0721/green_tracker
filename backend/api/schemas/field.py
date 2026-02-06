from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class FieldCreate(BaseModel):
    name: str = Field(..., description="地块名称")
    description: Optional[str] = Field(None, description="地块描述")
    location_wkt: str = Field(..., description="地块边界（WKT格式）")
    area_m2: Optional[float] = Field(None, description="地块面积（平方米）")
    crop_type: Optional[str] = Field(None, description="作物类型")
    soil_type: Optional[str] = Field(None, description="土壤类型")
    irrigation_type: Optional[str] = Field(None, description="灌溉方式")

    class Config:
        schema_extra = {
            "example": {
                "name": "示范田A区",
                "description": "用于示范的高标准农田",
                "location_wkt": "POLYGON((116.10 39.90, 116.20 39.90, 116.20 40.00, 116.10 40.00, 116.10 39.90))",
                "area_m2": 1000000,
                "crop_type": "小麦",
                "soil_type": "壤土",
                "irrigation_type": "滴灌"
            }
        }


class FieldUpdate(BaseModel):
    name: Optional[str] = Field(None, description="地块名称")
    description: Optional[str] = Field(None, description="地块描述")
    location_wkt: Optional[str] = Field(None, description="地块边界（WKT格式）")
    area_m2: Optional[float] = Field(None, description="地块面积（平方米）")
    crop_type: Optional[str] = Field(None, description="作物类型")
    soil_type: Optional[str] = Field(None, description="土壤类型")
    irrigation_type: Optional[str] = Field(None, description="灌溉方式")

    class Config:
        schema_extra = {
            "example": {
                "name": "更新后的地块名称",
                "description": "更新后的描述",
                "crop_type": "玉米"
            }
        }


class FieldResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    location_wkt: str
    area_m2: Optional[float] = None
    crop_type: Optional[str] = None
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    owner_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator('location_wkt', mode='before')
    @classmethod
    def convert_geometry_to_wkt(cls, v):
        """将几何对象转换为 WKT 字符串"""
        if v is None:
            return None
        # 如果是 WKBElement 或其他几何对象，转换为 WKT 字符串
        if hasattr(v, 'desc'):
            # GeoAlchemy2 WKBElement 对象
            try:
                from geoalchemy2.functions import ST_AsText
                return str(ST_AsText(v))
            except:
                return str(v)
        # 如果已经是字符串，直接返回
        return str(v)

    class Config:
        from_attributes = False


class PointQuery(BaseModel):
    longitude: float = Field(..., description="经度")
    latitude: float = Field(..., description="纬度")

    class Config:
        schema_extra = {
            "example": {
                "longitude": 116.15,
                "latitude": 39.95
            }
        }


class FieldListParams(BaseModel):
    owner_id: Optional[str] = Field(None, description="所有者ID")
    keyword: Optional[str] = Field(None, description="搜索关键词")
    crop_type: Optional[str] = Field(None, description="作物类型")
    soil_type: Optional[str] = Field(None, description="土壤类型")
    irrigation_type: Optional[str] = Field(None, description="灌溉方式")

    class Config:
        schema_extra = {
            "example": {
                "owner_id": "550e8400-e29b-41d4-a716-446655440000",
                "active_only": True,
                "crop_type": "小麦"
            }
        }