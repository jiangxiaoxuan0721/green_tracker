from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ApiKeyCreateRequest(BaseModel):
    """API密钥创建请求模型"""
    key_name: str = Field(..., description="密钥名称")
    description: Optional[str] = Field(None, description="密钥描述")
    permissions: Optional[List[str]] = Field(
        ["data_upload"],
        description="权限列表，可选值：data_upload（数据上传）/ data_read（数据读取）/ device_control（设备控制）"
    )
    device_ids: Optional[List[str]] = Field(
        None,
        description="设备ID列表（可选）。密钥不与设备绑定，可作用于该用户名下的任意设备；该字段仅作备注记录"
    )
    expires_at: Optional[datetime] = Field(None, description="过期时间")

    model_config = {
        "json_schema_extra": {
            "example": {
                "key_name": "农田数据采集设备",
                "description": "用于农田巡检设备上传数据",
                "permissions": ["data_upload"],
                "device_ids": [],
                "expires_at": "2025-12-31T23:59:59"
            }
        }
    }


class ApiKeyUpdateRequest(BaseModel):
    """API密钥更新请求模型"""
    key_name: Optional[str] = Field(None, description="密钥名称")
    description: Optional[str] = Field(None, description="密钥描述")
    permissions: Optional[List[str]] = Field(
        None,
        description="权限列表，可选值：data_upload / data_read / device_control"
    )
    device_ids: Optional[List[str]] = Field(
        None,
        description="设备ID列表（可选，传空列表表示清空）。不参与鉴权"
    )
    is_active: Optional[bool] = Field(None, description="是否激活")
    expires_at: Optional[datetime] = Field(None, description="过期时间")

    model_config = {
        "json_schema_extra": {
            "example": {
                "key_name": "更新后的密钥名称",
                "description": "更新后的描述",
                "permissions": ["data_upload", "device_control"],
                "device_ids": ["3f1c0b8e-0d3a-4a2b-9c1f-7d2e5a4b6c88"],
                "is_active": True
            }
        }
    }


class ApiKeyPermissionInfo(BaseModel):
    """权限说明模型（用于权限字典接口）"""
    value: str = Field(..., description="权限值")
    label: str = Field(..., description="权限名称")
    description: str = Field(..., description="权限说明")
    scenario: str = Field(..., description="适用场景")
    endpoints: List[str] = Field(default_factory=list, description="该权限放行的接口")


class ApiKeyResponse(BaseModel):
    """API密钥响应模型"""
    id: str
    user_id: str
    key_name: str
    api_key: str
    description: Optional[str] = None
    permissions: List[str]
    device_ids: List[str] = Field(default_factory=list, description="可控制的设备ID列表")
    is_active: bool
    is_expired: bool
    last_used_at: Optional[datetime] = None
    usage_count: int
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApiKeyListResponse(BaseModel):
    """API密钥列表响应模型"""
    total: int
    items: List[ApiKeyResponse]


class ApiKeyCreateResponse(BaseModel):
    """API密钥创建响应模型"""
    api_key: str
    key_info: ApiKeyResponse


__all__ = [
    "ApiKeyCreateRequest",
    "ApiKeyUpdateRequest", 
    "ApiKeyResponse",
    "ApiKeyListResponse",
    "ApiKeyCreateResponse",
    "ApiKeyPermissionInfo"
]