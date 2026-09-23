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
import json
from typing import Iterable, Optional, List, Dict, Any
from datetime import datetime, timezone as tz


def _parse_string_array(raw: Any) -> List[str]:
    """
    解析数据库中以字符串存储的列表字段（permissions / device_ids）

    兼容两种历史形态：
    1. JSON 数组：'["data_upload"]'（新数据）
    2. Python 字面量：'['data_upload']'（历史数据，str(list) 写入）
    """
    if raw is None:
        return []
    if isinstance(raw, (list, tuple, set)):
        return [str(item) for item in raw if str(item)]
    if not isinstance(raw, str) or not raw.strip():
        return []

    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        try:
            import ast
            parsed = ast.literal_eval(raw)
        except (ValueError, SyntaxError):
            return []

    if isinstance(parsed, (list, tuple, set)):
        return [str(item) for item in parsed if str(item)]
    return []


def _dump_string_array(values: Optional[Iterable[str]]) -> str:
    """将字符串列表序列化为 JSON 数组字符串（统一存储格式）"""
    return json.dumps([str(v).strip() for v in (values or []) if str(v).strip()])


def normalize_device_ids(device_ids: Optional[Iterable[str]]) -> List[str]:
    """规范化设备ID列表：去空白、去重、保持传入顺序"""
    result: List[str] = []
    for item in device_ids or []:
        value = str(item).strip()
        if value and value not in result:
            result.append(value)
    return result


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
    expires_at: Optional[datetime] = None,
    device_ids: Optional[List[str]] = None
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
        device_ids: 该密钥可控制的设备ID列表（device_control 权限使用），可选

    Returns:
        str: 创建的API密钥，失败返回None
    """
    try:
        # 生成API密钥
        api_key = generate_api_key()
        
        # 确保API密钥唯一
        while db.query(ApiKey).filter(ApiKey.api_key == api_key).first():
            api_key = generate_api_key()

        # 权限与设备绑定（权限定义位于共享层 utils.permissions，此处惰性导入保持服务层轻量）
        from utils.permissions import DEFAULT_PERMISSIONS, normalize_permissions

        # 设置默认权限（规范化：去空、去重、剔除未知权限）
        normalized_permissions = normalize_permissions(
            permissions if permissions is not None else DEFAULT_PERMISSIONS
        )
        normalized_device_ids = normalize_device_ids(device_ids)

        new_api_key = ApiKey(
            user_id=user_id,  # 直接使用字符串，因为数据库中存储的是字符串
            key_name=key_name,
            api_key=api_key,
            description=description,
            permissions=_dump_string_array(normalized_permissions),
            device_ids=_dump_string_array(normalized_device_ids),
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

            # 获取完整密钥（用CSS在前端遮蔽显示）
            api_key_value = getattr(key, 'api_key', '')

            # 获取权限列表与绑定设备列表
            permissions = _parse_string_array(getattr(key, 'permissions', '[]'))
            device_ids = _parse_string_array(getattr(key, 'device_ids', '[]'))

            items.append({
                "id": str(key.id),
                "key_name": key.key_name,
                "api_key": api_key_value,  # 完整密钥，用CSS遮蔽显示
                "description": getattr(key, 'description', None),
                "permissions": permissions,
                "device_ids": device_ids,
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
            "permissions": _parse_string_array(getattr(key_record, 'permissions', '[]')),
            "device_ids": _parse_string_array(getattr(key_record, 'device_ids', '[]'))
        }

    except Exception as e:
        print(f"[ApiService] 验证API密钥失败: {str(e)}")
        return None


def _revoke_devices_if_control_lost(
    *,
    key_id: str,
    user_id,
    old_permissions: List[str],
    old_active: bool,
    new_permissions,
    new_active,
    key_name: str
) -> None:
    """
    密钥失去远程控制能力时，通知正在使用它的设备立即停止接受指令

    触发条件（原本可控，变更后不可控）：
    - 移除 device_control 权限
    - 密钥被禁用
    """
    from utils.permissions import PERMISSION_DEVICE_CONTROL

    if new_permissions is None:
        new_permissions = old_permissions
    elif isinstance(new_permissions, str):
        new_permissions = _parse_string_array(new_permissions)

    if new_active is None:
        new_active = old_active

    had_control = PERMISSION_DEVICE_CONTROL in old_permissions
    has_control = PERMISSION_DEVICE_CONTROL in new_permissions

    if not had_control:
        return
    if has_control and new_active:
        return

    reason = (
        f"密钥「{key_name}」的远程控制权限已被撤销，"
        f"该设备已被禁止远程控制，请重新签到获取最新能力"
    )

    try:
        from database.db_services.device_revoke_service import revoke_control_for_key

        result = revoke_control_for_key(str(key_id), user_id, reason)
        print(
            f"[ApiService] 已向 {result.get('notified', 0)} 台设备下发远程控制撤销通知: "
            f"密钥={key_name}"
        )
    except Exception as e:
        print(f"[ApiService] 下发远程控制撤销通知失败: {str(e)}")


def update_api_key(
    db: Session,
    key_id: str,
    key_name: Optional[str] = None,
    description: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    is_active: Optional[bool] = None,
    expires_at: Optional[datetime] = None,
    device_ids: Optional[List[str]] = None
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
        device_ids: 可控制的设备ID列表（传空列表表示清空绑定）

    Returns:
        bool: 更新是否成功
    """
    try:
        # 直接使用字符串ID，因为数据库中存储的是字符串
        # 读取变更前的状态，用于判断是否需要撤销设备的远程控制授权
        old_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
        if old_key is None:
            return False

        old_permissions = _parse_string_array(getattr(old_key, 'permissions', '[]'))
        old_active = bool(getattr(old_key, 'is_active', False))
        old_user_id = getattr(old_key, 'user_id', None)

        # 构建更新数据
        update_data = {}
        if key_name is not None:
            update_data["key_name"] = key_name
        if description is not None:
            update_data["description"] = description
        if permissions is not None:
            from utils.permissions import normalize_permissions
            update_data["permissions"] = _dump_string_array(normalize_permissions(permissions))
        if device_ids is not None:
            update_data["device_ids"] = _dump_string_array(normalize_device_ids(device_ids))
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

        if affected_rows > 0:
            _revoke_devices_if_control_lost(
                key_id=str(key_id),
                user_id=old_user_id,
                old_permissions=old_permissions,
                old_active=old_active,
                new_permissions=update_data.get("permissions"),
                new_active=update_data.get("is_active"),
                key_name=getattr(old_key, 'key_name', None) or key_id
            )

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
        # 删除前先取出归属用户，删除后需要通知受影响的设备
        old_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()

        affected_rows = db.query(ApiKey).filter(
            ApiKey.id == key_id
        ).delete()

        db.commit()

        if affected_rows > 0 and old_key is not None:
            _revoke_devices_if_control_lost(
                key_id=str(key_id),
                user_id=getattr(old_key, 'user_id', None),
                old_permissions=_parse_string_array(getattr(old_key, 'permissions', '[]')),
                old_active=True,
                new_permissions=[],
                new_active=False,
                key_name=getattr(old_key, 'key_name', None) or key_id
            )

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

        return {
            "id": str(key_record.id),
            "user_id": str(key_record.user_id),
            "key_name": key_record.key_name,
            "api_key": getattr(key_record, 'api_key', ''),
            "description": getattr(key_record, 'description', None),
            "permissions": _parse_string_array(getattr(key_record, 'permissions', '[]')),
            "device_ids": _parse_string_array(getattr(key_record, 'device_ids', '[]')),
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


