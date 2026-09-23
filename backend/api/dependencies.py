"""
设备远程控制的设备级授权守卫（基于「设备上报所用密钥」的软关联）

判定链：
    设备 --(启动/心跳上报)--> device_key_bindings.api_key_id --> api_keys.permissions

授权口径：
- 设备未上报过密钥            → 无法判定，按未授权拒绝（403）
- 上报的密钥已被删除          → 403
- 上报的密钥被禁用 / 已过期    → 403
- 上报的密钥不含 device_control → 403（这正是"设备用的密钥没有控制权限，云端也不能操控"）
- 上报的密钥含 device_control  → 放行

JWT（Web 控制台）同样走这条判定，因此不会出现"界面能点、密钥却没权限"的越权。
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from utils.permissions import PERMISSION_DEVICE_CONTROL, parse_permissions


def get_device_binding(user_db: Session, device_id: str) -> Optional[Dict[str, Any]]:
    """设备上报的密钥关联（未上报返回 None）"""
    from database.db_services.device_key_binding_service import get_binding

    return get_binding(user_db, device_id)


def get_bound_key_state(
    user_db: Session,
    meta_db: Session,
    device_id: str
) -> Dict[str, Any]:
    """
    汇总设备的控制授权状态，供守卫与查询接口共用

    Returns:
        {
            "device_id": str,
            "bound": bool,              是否上报过密钥
            "control_granted": bool,    是否具备远程控制授权
            "reason": str,              未授权原因（已授权为空）
            "api_key_id"/"api_key_name"/"permissions"/"is_active"/"is_expired"/"expires_at"
        }
    """
    state: Dict[str, Any] = {
        "device_id": device_id,
        "bound": False,
        "control_granted": False,
        "code": "not_reported",
        "reason": "设备尚未上报所使用的密钥",
        "action": "请让设备完成一次签到",
        "api_key_id": None,
        "api_key_name": None,
        "permissions": [],
        "is_active": None,
        "is_expired": None,
        "expires_at": None,
        "last_reported_at": None,
    }

    binding = get_device_binding(user_db, device_id)
    if not binding:
        return state

    state["bound"] = True
    state["api_key_id"] = binding.get("api_key_id")
    state["api_key_name"] = binding.get("api_key_name")
    state["last_reported_at"] = binding.get("last_reported_at")

    from database.db_models.meta_model import ApiKey

    key = meta_db.query(ApiKey).filter(ApiKey.id == binding.get("api_key_id")).first()
    if not key:
        state["code"] = "key_deleted"
        state["reason"] = "设备上报的密钥已被删除"
        state["action"] = "请让设备重新签到"
        return state

    permissions = parse_permissions(getattr(key, "permissions", None))
    expires_at = getattr(key, "expires_at", None)
    is_expired = False
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        is_expired = expires_at < datetime.now(timezone.utc)

    state["permissions"] = permissions
    state["is_active"] = bool(getattr(key, "is_active", False))
    state["is_expired"] = is_expired
    state["expires_at"] = getattr(key, "expires_at", None)

    if not state["is_active"]:
        state["code"] = "key_disabled"
        state["reason"] = f"密钥「{key.key_name}」已被禁用"
        state["action"] = "请在密钥管理中启用该密钥"
        return state

    if is_expired:
        state["code"] = "key_expired"
        state["reason"] = f"密钥「{key.key_name}」已过期"
        state["action"] = "请延长有效期或更换密钥"
        return state

    if PERMISSION_DEVICE_CONTROL not in permissions:
        state["code"] = "missing_permission"
        state["reason"] = f"密钥「{key.key_name}」未授予「设备控制」权限"
        state["action"] = "请在密钥管理中勾选「设备控制」权限"
        return state

    state["control_granted"] = True
    state["code"] = "granted"
    state["reason"] = ""
    state["action"] = ""
    return state


def _short_device_id(device_id: str) -> str:
    """提示文案中避免完整 UUID 占位"""
    text = str(device_id or "")
    return f"{text[:8]}…" if len(text) > 8 else text


def assert_device_control_granted(
    user_db: Session,
    meta_db: Session,
    device_id: str,
    device_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    校验设备已获得远程控制授权，未授权时抛 403

    提示文案面向当前操作者：只说「为什么」+「你该做什么」，
    设备侧的签到指引放在心跳响应与接入文档中，不在这里重复。

    适用于：
    - POST /api/device-commands（云端下发）
    - POST /api/mqtt/devices/{device_id}/commands（控制台下发）
    """
    state = get_bound_key_state(user_db, meta_db, device_id)
    if state.get("control_granted"):
        return state

    label = device_name or _short_device_id(device_id)
    reason = state.get("reason") or "未获得远程控制授权"
    action = state.get("action") or ""

    detail = f"设备「{label}」暂不可远程控制：{reason}"
    if action:
        detail = f"{detail}。{action}"

    raise HTTPException(status_code=403, detail=detail)


__all__ = [
    "get_device_binding",
    "get_bound_key_state",
    "assert_device_control_granted",
]
