"""
API密钥管理路由
提供API密钥的增删改查功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from ..routes.auth import (
    get_current_user,
    AuthPrincipal,
    AUTH_METHOD_API_KEY,
    require_data_upload
)
from database.db_models.meta_model import User
from database.main_db import get_meta_db
from database.user_db_manager import get_user_db
from database.db_services.log_service import create_log
from database.db_services.api_key_service import (
    create_api_key,
    get_api_keys_by_user,
    validate_api_key,
    update_api_key,
    delete_api_key,
    get_api_key_by_id,
    normalize_device_ids
)
from ..schemas.api_key import (
    ApiKeyCreateRequest,
    ApiKeyUpdateRequest,
    ApiKeyPermissionInfo
)
from utils.permissions import (
    ALL_PERMISSIONS,
    PERMISSION_DEFINITIONS,
    normalize_permissions
)

router = APIRouter(prefix="/api-keys", tags=["API密钥管理"])


def _resolve_permissions(permissions: Optional[List[str]]) -> List[str]:
    """校验并规范化权限列表，未知权限返回 422"""
    try:
        resolved = normalize_permissions(permissions or [])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not resolved:
        raise HTTPException(
            status_code=422,
            detail=f"至少选择一项权限，可选权限: {', '.join(ALL_PERMISSIONS)}"
        )
    return resolved


@router.get("/permissions", summary="获取API密钥权限字典", response_model=List[ApiKeyPermissionInfo])
async def list_api_key_permissions():
    """
    返回全部可选权限的定义（权限值、名称、适用场景、放行的接口）

    前端与第三方集成应以此接口为准，避免权限含义在各端产生歧义。
    """
    return [ApiKeyPermissionInfo(**item) for item in PERMISSION_DEFINITIONS]


@router.post("/", summary="创建API密钥")
async def create_new_api_key(
    request: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    创建新的API密钥

    用于支持无网页界面的设备/第三方系统调用云端接口。
    权限说明见 GET /api/api-keys/permissions。
    """
    # 权限是唯一的授权维度：密钥可作用于该用户名下的任意设备，不与设备绑定
    permissions = _resolve_permissions(request.permissions)
    device_ids = normalize_device_ids(request.device_ids)

    # 创建API密钥
    api_key = create_api_key(
        db=db,
        user_id=str(current_user.userid),
        key_name=request.key_name,
        description=request.description,
        permissions=permissions,
        expires_at=request.expires_at,
        device_ids=device_ids
    )

    if not api_key:
        raise HTTPException(status_code=500, detail="创建API密钥失败")

    # 直接查询获取创建的密钥信息，避免时区验证问题
    from database.db_models.meta_model import ApiKey
    
    key_record = db.query(ApiKey).filter(ApiKey.api_key == api_key).first()
    if not key_record:
        raise HTTPException(status_code=500, detail="创建API密钥后查询失败")
    
    # 转换为响应格式
    key_id = str(key_record.id)
    if not key_id:
        raise HTTPException(status_code=500, detail="无法获取API密钥ID")
    key_info = get_api_key_by_id(db, key_id)

    # 记录操作日志
    try:
        user_db = get_user_db(str(current_user.userid))
        create_log(user_db, "info", "api_key.create",
                   f"用户 {current_user.username} 创建API密钥: {request.key_name}，权限: {','.join(permissions)}",
                   related_id=str(key_id), related_type="api_key")
        user_db.close()
    except Exception:
        pass

    return {
        "code": 200, 
        "message": "success", 
        "data": {
            "api_key": api_key,
            "key_info": key_info
        }
    }


@router.get("/", summary="获取API密钥列表")
async def get_api_key_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    include_inactive: bool = Query(False, description="是否包含非激活密钥"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    获取当前用户的API密钥列表
    
    注意：出于安全考虑，返回的密钥会被遮蔽显示
    """
    result = get_api_keys_by_user(
        db=db,
        user_id=str(current_user.userid),
        page=page,
        page_size=page_size,
        include_inactive=include_inactive
    )

    return {"code": 200, "message": "success", "data": result}


@router.get("/{key_id}", summary="获取API密钥详情")
async def get_api_key_detail(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    获取API密钥详情
    
    注意：出于安全考虑，只有密钥所有者可以查看
    """
    # 获取密钥详情
    key_info = get_api_key_by_id(db, key_id)

    if not key_info:
        raise HTTPException(status_code=404, detail="API密钥不存在")

    # 验证所有权
    if key_info["user_id"] != str(current_user.userid):
        raise HTTPException(status_code=403, detail="无权限访问此API密钥")

    return {"code": 200, "message": "success", "data": key_info}


@router.put("/{key_id}", summary="更新API密钥")
async def update_api_key_by_id(
    key_id: str,
    request: ApiKeyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    更新API密钥信息（名称、描述、权限、设备绑定、启用状态、过期时间）
    
    注意：不能更新密钥值本身，如需重新生成请删除后重新创建
    """
    # 首先验证所有权
    key_info = get_api_key_by_id(db, key_id)
    if not key_info:
        raise HTTPException(status_code=404, detail="API密钥不存在")

    if key_info["user_id"] != str(current_user.userid):
        raise HTTPException(status_code=403, detail="无权限修改此API密钥")

    # 权限是唯一的授权维度（密钥不与设备绑定，未传权限时保持原值）
    permissions = (
        _resolve_permissions(request.permissions)
        if request.permissions is not None
        else list(key_info.get("permissions") or [])
    )
    if not permissions:
        raise HTTPException(status_code=422, detail="权限列表不能为空")

    device_ids = (
        normalize_device_ids(request.device_ids)
        if request.device_ids is not None
        else list(key_info.get("device_ids") or [])
    )

    # 更新密钥
    success = update_api_key(
        db=db,
        key_id=key_id,
        key_name=request.key_name,
        description=request.description,
        permissions=permissions,
        device_ids=device_ids,
        is_active=request.is_active,
        expires_at=request.expires_at
    )

    if not success:
        raise HTTPException(status_code=500, detail="更新API密钥失败")

    # 返回更新后的信息
    updated_key = get_api_key_by_id(db, key_id)
    return {"code": 200, "message": "success", "data": updated_key}


@router.delete("/{key_id}", summary="删除API密钥")
async def delete_api_key_by_id(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    删除API密钥
    
    注意：删除后无法恢复，请谨慎操作
    """
    # 首先验证所有权
    key_info = get_api_key_by_id(db, key_id)
    if not key_info:
        raise HTTPException(status_code=404, detail="API密钥不存在")

    if key_info["user_id"] != str(current_user.userid):
        raise HTTPException(status_code=403, detail="无权限删除此API密钥")

    # 删除密钥
    success = delete_api_key(db, key_id)

    if not success:
        raise HTTPException(status_code=500, detail="删除API密钥失败")

    # 记录操作日志
    try:
        user_db = get_user_db(str(current_user.userid))
        create_log(user_db, "warning", "api_key.delete",
                   f"用户 {current_user.username} 删除API密钥: {key_id}",
                   related_id=key_id, related_type="api_key")
        user_db.close()
    except Exception:
        pass

    return {"code": 200, "message": "success", "data": None}


# 用于数据上传的API密钥验证中间件依赖
async def get_api_key_user(
    principal: AuthPrincipal = Depends(require_data_upload)
) -> User:
    """
    通过API密钥验证用户身份（要求 data_upload 权限）

    与其它接口保持一致的认证约定：X-API-Key: <api_key>
    """
    if principal.auth_method != AUTH_METHOD_API_KEY:
        raise HTTPException(status_code=403, detail="该依赖仅接受 API 密钥认证")

    return principal.user


@router.post("/validate", summary="验证API密钥")
async def validate_api_key_endpoint(
    x_api_key: str = Header(..., description="API密钥"),
    db: Session = Depends(get_meta_db)
):
    """
    验证API密钥有效性和权限
    
    用于设备在上传数据前验证密钥有效性及权限
    返回密钥的详细信息，包括权限列表
    """
    # 验证API密钥
    key_info = validate_api_key(db, x_api_key)

    if not key_info:
        raise HTTPException(
            status_code=401,
            detail="无效的API密钥"
        )

    return {
        "code": 200,
        "message": "API密钥有效",
        "data": {
            "key_id": key_info["id"],
            "user_id": key_info["user_id"],
            "key_name": key_info["key_name"],
            "permissions": key_info["permissions"],
            "device_ids": key_info.get("device_ids", [])
        }
    }
