"""
设备指令服务模块

负责云端下发指令的持久化与状态流转：
pending -> sent/delivered -> acked/failed
以及 cancelled / expired 两种终态。
"""

from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from database.db_models.user_models import DeviceCommand

from datetime import datetime

# 可继续执行（设备仍应拉取）的状态
ACTIVE_STATUSES = ["pending", "sent"]

# 终态：不再变化
FINAL_STATUSES = ["acked", "failed", "cancelled", "expired"]

VALID_STATUSES = ACTIVE_STATUSES + ["delivered"] + FINAL_STATUSES


def _to_dict(command: DeviceCommand) -> Dict[str, Any]:
    """将指令记录转换为接口响应字典"""
    return {
        "id": str(command.id),
        "command_id": command.command_id,
        "device_id": command.device_id,
        "device_name": command.device_name,
        "command": command.command,
        "params": command.params or {},
        "status": command.status,
        "transport": command.transport,
        "source": command.source,
        "api_key_id": command.api_key_id,
        "issued_by": command.issued_by,
        "result": command.result,
        "error_message": command.error_message,
        "created_at": command.created_at,
        "sent_at": command.sent_at,
        "delivered_at": command.delivered_at,
        "executed_at": command.executed_at,
        "expires_at": command.expires_at,
        "updated_at": command.updated_at
    }


def create_command(
    db: Session,
    *,
    command_id: str,
    device_id: str,
    command: str,
    params: Optional[Dict[str, Any]] = None,
    device_name: Optional[str] = None,
    status: str = "pending",
    transport: Optional[str] = None,
    api_key_id: Optional[str] = None,
    issued_by: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    sent_at: Optional[datetime] = None,
    error_message: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    创建一条设备指令

    Returns:
        Dict[str, Any]: 指令详情，失败返回 None
    """
    try:
        record = DeviceCommand(
            command_id=command_id,
            device_id=device_id,
            device_name=device_name,
            command=command,
            params=params or {},
            status=status,
            transport=transport,
            source="cloud",
            api_key_id=api_key_id,
            issued_by=issued_by,
            expires_at=expires_at,
            sent_at=sent_at,
            error_message=error_message
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return _to_dict(record)
    except Exception as e:
        print(f"[DeviceCommandService] 创建指令失败: {e}")
        db.rollback()
        return None


def get_command(db: Session, command_id: str) -> Optional[Dict[str, Any]]:
    """按 command_id 查询指令"""
    try:
        record = db.query(DeviceCommand).filter(
            DeviceCommand.command_id == command_id
        ).first()
        return _to_dict(record) if record else None
    except Exception as e:
        print(f"[DeviceCommandService] 查询指令失败: {e}")
        return None


def list_commands(
    db: Session,
    *,
    device_id: Optional[str] = None,
    status: Optional[str] = None,
    command: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """分页查询指令列表（按创建时间倒序）"""
    try:
        query = db.query(DeviceCommand)
        if device_id:
            query = query.filter(DeviceCommand.device_id == device_id)
        if status:
            query = query.filter(DeviceCommand.status == status)
        if command:
            query = query.filter(DeviceCommand.command == command)

        total_count = query.count()
        total_pages = (total_count + page_size - 1) // page_size if page_size else 1
        records = query.order_by(desc(DeviceCommand.created_at)).offset(
            max(page - 1, 0) * page_size
        ).limit(page_size).all()

        return {
            "items": [_to_dict(record) for record in records],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages
            }
        }
    except Exception as e:
        print(f"[DeviceCommandService] 查询指令列表失败: {e}")
        return {
            "items": [],
            "pagination": {"page": page, "page_size": page_size, "total_count": 0, "total_pages": 0}
        }


def _mark_expired(db: Session, records: List[DeviceCommand]) -> None:
    """将已过期的指令统一标记为 expired"""
    now = datetime.utcnow()
    changed = False
    for record in records:
        expires_at = record.expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=None)
        if expires_at and expires_at < now and record.status in ACTIVE_STATUSES:
            record.status = "expired"
            changed = True
    if changed:
        db.commit()


def get_pending_commands(
    db: Session,
    device_id: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    获取设备的待执行指令（pending/sent 且未过期）

    过期指令会被就地标记为 expired，不再返回。
    """
    try:
        records = db.query(DeviceCommand).filter(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status.in_(ACTIVE_STATUSES)
        ).order_by(DeviceCommand.created_at).limit(limit).all()

        _mark_expired(db, records)

        pending = [record for record in records if record.status in ACTIVE_STATUSES]
        return [_to_dict(record) for record in pending]
    except Exception as e:
        print(f"[DeviceCommandService] 查询待执行指令失败: {e}")
        return []


def mark_delivered(db: Session, command_id: str) -> Optional[Dict[str, Any]]:
    """标记指令已被设备拉取"""
    try:
        record = db.query(DeviceCommand).filter(
            DeviceCommand.command_id == command_id
        ).first()
        if not record:
            return None

        if record.status == "pending":
            record.status = "delivered"
            record.delivered_at = datetime.utcnow()
            db.commit()
            db.refresh(record)
        return _to_dict(record)
    except Exception as e:
        print(f"[DeviceCommandService] 标记指令已投递失败: {e}")
        db.rollback()
        return None


def mark_result(
    db: Session,
    command_id: str,
    *,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """记录设备回执（acked / failed）"""
    try:
        record = db.query(DeviceCommand).filter(
            DeviceCommand.command_id == command_id
        ).first()
        if not record:
            return None

        if record.status in FINAL_STATUSES:
            return _to_dict(record)

        record.status = status
        record.result = result or {}
        record.error_message = error_message
        record.executed_at = datetime.utcnow()
        db.commit()
        db.refresh(record)
        return _to_dict(record)
    except Exception as e:
        print(f"[DeviceCommandService] 记录指令回执失败: {e}")
        db.rollback()
        return None


def cancel_command(db: Session, command_id: str) -> Optional[Dict[str, Any]]:
    """云端取消一条未完成的指令"""
    try:
        record = db.query(DeviceCommand).filter(
            DeviceCommand.command_id == command_id
        ).first()
        if not record:
            return None

        if record.status in FINAL_STATUSES:
            return _to_dict(record)

        record.status = "cancelled"
        db.commit()
        db.refresh(record)
        return _to_dict(record)
    except Exception as e:
        print(f"[DeviceCommandService] 取消指令失败: {e}")
        db.rollback()
        return None
