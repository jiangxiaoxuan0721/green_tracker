"""
API密钥服务模块
提供API密钥的增删改查功能
"""

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session
from database.db_models.meta_model import ApiKey
import uuid
import secrets
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone as tz


def generate_api_key():
    """生成API密钥，以green-开头，后面是32位随机字符串"""
    random_part = secrets.token_urlsafe(24)  # 生成32位随机字符串
    return f"green-{random_part}"


def validate_api_key_format(api_key: str) -> bool:
    """验证API密钥格式"""
    pattern = r'^green-[A-Za-z0-9_-]+$'
    return bool(re.match(pattern, api_key))


def create_api_key(
    db: Session,
    user_id: str,
    key_name: str,
    description: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    expires_at: Optional[datetime] = None
) -> Optional[str]:
    """
    创建新的API密钥

    Args:
        db: 数据库会话
        user_id: 用户ID
        key_name: 密钥名称
        description: 密钥描述
        permissions: 权限列表，默认为['data_upload']
        expires_at: 过期时间，可选

    Returns:
        str: 创建的API密钥，失败返回None
    """
    try:
        # 生成API密钥
        api_key = generate_api_key()
        
        # 确保API密钥唯一
        while db.query(ApiKey).filter(ApiKey.api_key == api_key).first():
            api_key = generate_api_key()

        # 设置默认权限
        if permissions is None:
            permissions = ["data_upload"]

        new_api_key = ApiKey(
            user_id=user_id,  # 直接使用字符串，因为数据库中存储的是字符串
            key_name=key_name,
            api_key=api_key,
            description=description,
            permissions=str(permissions),  # 存储为JSON字符串
            expires_at=expires_at
        )

        db.add(new_api_key)
        db.commit()
        db.refresh(new_api_key)

        print(f"[ApiService] 成功创建API密钥，名称={key_name}")
        return api_key

    except Exception as e:
        print(f"[ApiService] 创建API密钥失败: {str(e)}")
        db.rollback()
        return None


def get_api_keys_by_user(
    db: Session,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
    include_inactive: bool = False
) -> Dict[str, Any]:
    """
    获取用户的API密钥列表

    Args:
        db: 数据库会话
        user_id: 用户ID
        page: 页码
        page_size: 每页数量
        include_inactive: 是否包含非激活密钥

    Returns:
        Dict[str, Any]: 分页数据列表和分页信息
    """
    try:
        # 构建查询
        query = db.query(ApiKey).filter(ApiKey.user_id == user_id)
        
        if not include_inactive:
            query = query.filter(ApiKey.is_active == True)

        # 计算总数
        total_count = query.count()

        # 分页
        offset = (page - 1) * page_size
        api_keys = query.order_by(desc(ApiKey.created_at)).offset(offset).limit(page_size).all()

        # 转换为前端显示格式
        items = []
        for key in api_keys:
            # 检查是否过期
            is_expired = False
            expires_at = getattr(key, 'expires_at', None)
            if expires_at:
                # 如果expires_at没有时区信息，假设它是UTC时间
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=tz.utc)
                if expires_at < datetime.now(tz.utc):
                    is_expired = True

            # 隐藏完整密钥，只显示前8位和后4位
            api_key_value = getattr(key, 'api_key', '')
            masked_key = api_key_value[:8] + "*"*20 + api_key_value[-4:] if len(api_key_value) > 32 else api_key_value

            # 获取权限列表
            permissions_str = getattr(key, 'permissions', '[]')
            try:
                permissions = eval(permissions_str) if permissions_str else []
            except:
                permissions = []

            items.append({
                "id": str(key.id),
                "key_name": key.key_name,
                "api_key": masked_key,
                "full_api_key": getattr(key, 'api_key', ''),  # 完整密钥，仅在创建时显示
                "description": getattr(key, 'description', None),
                "permissions": permissions,
                "is_active": key.is_active,
                "is_expired": is_expired,
                "last_used_at": getattr(key, 'last_used_at', None),
                "usage_count": getattr(key, 'usage_count', 0),
                "expires_at": getattr(key, 'expires_at', None),
                "created_at": getattr(key, 'created_at', None)
            })

        # 构建分页信息
        total_pages = (total_count + page_size - 1) // page_size

        return {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }

    except Exception as e:
        print(f"[ApiService] 获取API密钥列表失败: {str(e)}")
        return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_count": 0, "total_pages": 0}}


def validate_api_key(db: Session, api_key: str) -> Optional[Dict[str, Any]]:
    """
    验证API密钥有效性

    Args:
        db: 数据库会话
        api_key: API密钥

    Returns:
        Dict[str, Any]: 密钥信息，无效返回None
    """
    try:
        # 验证格式
        if not validate_api_key_format(api_key):
            return None

        # 查询密钥
        key_record = db.query(ApiKey).filter(
            and_(
                ApiKey.api_key == api_key,
                ApiKey.is_active == True
            )
        ).first()

        if not key_record:
            return None

        # 检查是否过期
        expires_at = getattr(key_record, 'expires_at', None)
        if expires_at:
            # 如果expires_at没有时区信息，假设它是UTC时间
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=tz.utc)
            if expires_at < datetime.now(tz.utc):
                return None

        # 更新使用记录
        setattr(key_record, 'last_used_at', datetime.utcnow())
        current_usage = getattr(key_record, 'usage_count', 0)
        setattr(key_record, 'usage_count', current_usage + 1)
        db.commit()

        return {
            "id": str(key_record.id),
            "user_id": str(key_record.user_id),
            "key_name": key_record.key_name,
            "permissions": eval(getattr(key_record, 'permissions', '[]')) if getattr(key_record, 'permissions', None) else []
        }

    except Exception as e:
        print(f"[ApiService] 验证API密钥失败: {str(e)}")
        return None


def update_api_key(
    db: Session,
    key_id: str,
    key_name: Optional[str] = None,
    description: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    is_active: Optional[bool] = None,
    expires_at: Optional[datetime] = None
) -> bool:
    """
    更新API密钥

    Args:
        db: 数据库会话
        key_id: 密钥ID
        key_name: 密钥名称
        description: 密钥描述
        permissions: 权限列表
        is_active: 是否激活
        expires_at: 过期时间

    Returns:
        bool: 更新是否成功
    """
    try:
        # 直接使用字符串ID，因为数据库中存储的是字符串
        # 构建更新数据
        update_data = {}
        if key_name is not None:
            update_data["key_name"] = key_name
        if description is not None:
            update_data["description"] = description
        if permissions is not None:
            update_data["permissions"] = str(permissions)
        if is_active is not None:
            update_data["is_active"] = is_active
        if expires_at is not None:
            update_data["expires_at"] = expires_at

        if not update_data:
            return True  # 没有需要更新的字段

        affected_rows = db.query(ApiKey).filter(
            ApiKey.id == key_id
        ).update(update_data)

        db.commit()
        return affected_rows > 0

    except Exception as e:
        print(f"[ApiService] 更新API密钥失败: {str(e)}")
        db.rollback()
        return False


def delete_api_key(db: Session, key_id: str) -> bool:
    """
    删除API密钥

    Args:
        db: 数据库会话
        key_id: 密钥ID

    Returns:
        bool: 删除是否成功
    """
    try:
        # 直接使用字符串ID，因为数据库中存储的是字符串
        affected_rows = db.query(ApiKey).filter(
            ApiKey.id == key_id
        ).delete()

        db.commit()
        return affected_rows > 0

    except Exception as e:
        print(f"[ApiService] 删除API密钥失败: {str(e)}")
        db.rollback()
        return False


def get_api_key_by_id(db: Session, key_id: str) -> Optional[Dict[str, Any]]:
    """
    根据ID获取API密钥详情

    Args:
        db: 数据库会话
        key_id: 密钥ID

    Returns:
        Dict[str, Any]: 密钥详情，如果不存在则返回None
    """
    try:
        # 直接使用字符串ID，因为数据库中存储的是字符串
        key_record = db.query(ApiKey).filter(ApiKey.id == key_id).first()

        if not key_record:
            return None

        # 检查是否过期
        is_expired = False
        expires_at = getattr(key_record, 'expires_at', None)
        if expires_at:
            # 如果expires_at没有时区信息，假设它是UTC时间
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=tz.utc)
            if expires_at < datetime.now(tz.utc):
                is_expired = True

        permissions_str = getattr(key_record, 'permissions', '[]')
        try:
            permissions = eval(permissions_str) if permissions_str else []
        except:
            permissions = []

        return {
            "id": str(key_record.id),
            "user_id": str(key_record.user_id),
            "key_name": key_record.key_name,
            "api_key": getattr(key_record, 'api_key', ''),
            "description": getattr(key_record, 'description', None),
            "permissions": permissions,
            "is_active": key_record.is_active,
            "is_expired": is_expired,
            "last_used_at": getattr(key_record, 'last_used_at', None),
            "usage_count": getattr(key_record, 'usage_count', 0),
            "expires_at": getattr(key_record, 'expires_at', None),
            "created_at": getattr(key_record, 'created_at', None),
            "updated_at": getattr(key_record, 'updated_at', None)
        }

    except Exception as e:
        print(f"[ApiService] 获取API密钥详情失败: {str(e)}")
        return None