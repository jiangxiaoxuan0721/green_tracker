"""
设备 → API密钥 软关联服务

设备不预先配置绑定关系，而是用自己持有的密钥上报一次（心跳/拉取指令/回执/拉取作业），
云端据此记录「该设备当前使用哪把密钥」，用于控制授权判定。
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from database.db_models.user_models import DeviceKeyBinding


def record_binding(
    db: Session,
    device_id: str,
    api_key_id: str,
    api_key_name: Optional[str] = None,
    source: str = "report"
) -> bool:
    """
    记录/刷新设备的密钥关联（一台设备只保留一条当前关联）

    Args:
        db: 用户库会话
        device_id: 设备ID
        api_key_id: 设备上报时使用的API密钥ID
        api_key_name: 密钥名称（冗余展示）
        source: 上报来源，便于追溯

    Returns:
        bool: 写入是否成功
    """
    if not device_id or not api_key_id:
        return False

    try:
        now = datetime.utcnow()
        binding = db.query(DeviceKeyBinding).filter(
            DeviceKeyBinding.device_id == str(device_id)
        ).first()

        if binding:
            binding.api_key_id = str(api_key_id)
            binding.api_key_name = api_key_name
            binding.source = source
            binding.last_reported_at = now
        else:
            binding = DeviceKeyBinding(
                device_id=str(device_id),
                api_key_id=str(api_key_id),
                api_key_name=api_key_name,
                source=source,
                last_reported_at=now,
                created_at=now,
                updated_at=now
            )
            db.add(binding)

        db.commit()
        return True
    except Exception as e:
        print(f"[DeviceKeyBinding] 记录设备密钥关联失败: {str(e)}")
        db.rollback()
        return False


def get_binding(db: Session, device_id: str) -> Optional[Dict[str, Any]]:
    """查询设备当前上报的密钥关联，未上报返回 None"""
    if not device_id:
        return None

    try:
        binding = db.query(DeviceKeyBinding).filter(
            DeviceKeyBinding.device_id == str(device_id)
        ).first()

        if not binding:
            return None

        return {
            "device_id": binding.device_id,
            "api_key_id": binding.api_key_id,
            "api_key_name": binding.api_key_name,
            "source": binding.source,
            "last_reported_at": binding.last_reported_at,
        }
    except Exception as e:
        print(f"[DeviceKeyBinding] 查询设备密钥关联失败: {str(e)}")
        return None


def find_devices_by_api_key(db: Session, api_key_id: str) -> List[Dict[str, Any]]:
    """反查当前正在使用指定密钥的设备（密钥被撤销/降权时用于通知设备）"""
    if not api_key_id:
        return []

    try:
        bindings = db.query(DeviceKeyBinding).filter(
            DeviceKeyBinding.api_key_id == str(api_key_id)
        ).all()

        return [
            {
                "device_id": b.device_id,
                "api_key_id": b.api_key_id,
                "api_key_name": b.api_key_name,
                "last_reported_at": b.last_reported_at,
            }
            for b in bindings
        ]
    except Exception as e:
        print(f"[DeviceKeyBinding] 反查密钥关联设备失败: {str(e)}")
        return []


def clear_binding(db: Session, device_id: str) -> bool:
    """清除设备的密钥关联（设备退役/换绑时使用）"""
    try:
        affected = db.query(DeviceKeyBinding).filter(
            DeviceKeyBinding.device_id == str(device_id)
        ).delete()
        db.commit()
        return affected > 0
    except Exception as e:
        print(f"[DeviceKeyBinding] 清除设备密钥关联失败: {str(e)}")
        db.rollback()
        return False
