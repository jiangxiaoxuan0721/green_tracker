from pydantic import BaseModel, Field
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
    organization_id: Optional[str] = Field(None, description="所属组织ID")

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
    is_active: Optional[bool] = Field(None, description="是否有效")

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
    organization_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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
    organization_id: Optional[str] = Field(None, description="组织ID")
    active_only: Optional[bool] = Field(True, description="是否只获取活跃地块")
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