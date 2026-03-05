from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ApiKeyCreateRequest(BaseModel):
    """API密钥创建请求模型"""
    key_name: str = Field(..., description="密钥名称")
    description: Optional[str] = Field(None, description="密钥描述")
    permissions: Optional[List[str]] = Field(["data_upload"], description="权限列表")
    expires_at: Optional[datetime] = Field(None, description="过期时间")

    model_config = {
        "json_schema_extra": {
            "example": {
                "key_name": "农田数据采集设备",
                "description": "用于农田巡检设备上传数据",
                "permissions": ["data_upload"],
                "expires_at": "2025-12-31T23:59:59"
            }
        }
    }


class ApiKeyUpdateRequest(BaseModel):
    """API密钥更新请求模型"""
    key_name: Optional[str] = Field(None, description="密钥名称")
    description: Optional[str] = Field(None, description="密钥描述")
    permissions: Optional[List[str]] = Field(None, description="权限列表")
    is_active: Optional[bool] = Field(None, description="是否激活")
    expires_at: Optional[datetime] = Field(None, description="过期时间")

    model_config = {
        "json_schema_extra": {
            "example": {
                "key_name": "更新后的密钥名称",
                "description": "更新后的描述",
                "is_active": True
            }
        }
    }


class ApiKeyResponse(BaseModel):
    """API密钥响应模型"""
    id: str
    user_id: str
    key_name: str
    api_key: str
    description: Optional[str] = None
    permissions: List[str]
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
    "ApiKeyCreateResponse"
]