"""
API密钥管理路由
提供API密钥的增删改查功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session

from ..routes.auth import get_current_user
from database.db_models.meta_model import User
from database.main_db import get_meta_db
from database.db_services.api_key_service import (
    create_api_key,
    get_api_keys_by_user,
    validate_api_key,
    update_api_key,
    delete_api_key,
    get_api_key_by_id
)
from ..schemas.api_key import (
    ApiKeyCreateRequest,
    ApiKeyUpdateRequest
)

router = APIRouter(prefix="/api-keys", tags=["API密钥管理"])


@router.post("/", summary="创建API密钥")
async def create_new_api_key(
    request: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    创建新的API密钥
    
    用于支持无网页界面的设备上传数据
    """
    # 创建API密钥
    api_key = create_api_key(
        db=db,
        user_id=str(current_user.userid),
        key_name=request.key_name,
        description=request.description,
        permissions=request.permissions,
        expires_at=request.expires_at
    )

    if not api_key:
        raise HTTPException(status_code=500, detail="创建API密钥失败")

    # 直接查询获取创建的密钥信息，避免时区验证问题
    from database.db_models.meta_model import ApiKey
    
    key_record = db.query(ApiKey).filter(ApiKey.api_key == api_key).first()
    if not key_record:
        raise HTTPException(status_code=500, detail="创建API密钥后查询失败")
    
    # 转换为响应格式
    key_id = str(key_record.id) if key_record and key_record.id else None
    if not key_id:
        raise HTTPException(status_code=500, detail="无法获取API密钥ID")
    key_info = get_api_key_by_id(db, key_id)

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
    更新API密钥信息
    
    注意：不能更新密钥值本身，如需重新生成请删除后重新创建
    """
    # 首先验证所有权
    key_info = get_api_key_by_id(db, key_id)
    if not key_info:
        raise HTTPException(status_code=404, detail="API密钥不存在")

    if key_info["user_id"] != str(current_user.userid):
        raise HTTPException(status_code=403, detail="无权限修改此API密钥")

    # 更新密钥
    success = update_api_key(
        db=db,
        key_id=key_id,
        key_name=request.key_name,
        description=request.description,
        permissions=request.permissions,
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

    return {"code": 200, "message": "success", "data": None}


# 用于数据上传的API密钥验证中间件依赖
async def get_api_key_user(
    x_api_key: str = Header(..., description="API密钥"),
    db: Session = Depends(get_meta_db)
):
    """
    通过API密钥验证用户身份
    
    用于数据上传等需要API密钥验证的接口
    """
    # 验证API密钥
    key_info = validate_api_key(db, x_api_key)

    if not key_info:
        raise HTTPException(
            status_code=401,
            detail="无效的API密钥",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # 检查权限（这里简化处理，只检查是否为data_upload权限）
    if "data_upload" not in key_info.get("permissions", []):
        raise HTTPException(
            status_code=403,
            detail="API密钥没有数据上传权限"
        )

    # 返回用户信息
    user = db.query(User).filter(User.userid == key_info["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="关联用户不存在")

    return user


@router.post("/validate", summary="验证API密钥")
async def validate_api_key_endpoint(
    x_api_key: str = Header(..., description="API密钥"),
    db: Session = Depends(get_meta_db)
):
    """
    验证API密钥有效性
    
    用于设备在上传数据前验证密钥有效性
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
            "user_id": key_info["user_id"],
            "key_name": key_info["key_name"],
            "permissions": key_info["permissions"]
        }
    }


@router.get("/validate/permissions", summary="验证API密钥权限")
async def validate_api_key_permissions(
    x_api_key: str = Header(..., description="API密钥"),
    db: Session = Depends(get_meta_db)
):
    """
    验证API密钥及其权限
    
    用于设备在上传数据前验证密钥有效性
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
        "message": "success",
        "data": {
            "user_id": key_info["user_id"],
            "key_name": key_info["key_name"],
            "permissions": key_info["permissions"]
        }
    }