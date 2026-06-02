"""
MQTT 业务服务层

整合数据库操作与 MQTT 设备管理，提供统一的业务 API：
- 设备 MQTT 凭证管理（生成/查询）
- 逻辑设备 ↔ 物理设备映射
- 指令下发与结果查询
- 在线状态同步到数据库
"""

import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from database.main_db import SessionLocal as MetaSessionLocal
from database.user_db_manager import UserDatabaseManager
from .mosquitto_manager import register_device as mosquitto_register_device

logger = logging.getLogger("MQTT.Service")

# 心跳超时阈值（秒）
HEARTBEAT_TIMEOUT = 120


def generate_mqtt_secret(length: int = 32) -> str:
    """生成随机的 MQTT 设备密钥"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def get_mqtt_credentials_for_device(device_id: str, user_id: str) -> Optional[Dict[str, str]]:
    """
    获取设备的 MQTT 凭证信息

    通过查询所有用户数据库来查找设备（因为设备存储在用户级数据库中）。
    返回: {"mqtt_username": "...", "mqtt_secret": "..."} 或 None
    """
    db_manager = UserDatabaseManager()
    session = db_manager.get_db(user_id)

    try:
        from database.db_models.user_models import Device
        device = session.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None

        # mqtt_username 使用 device_id（UUID 字符串）
        mqtt_username = str(device.id)

        # mqtt_secret 存储在 Device 表中
        mqtt_secret = getattr(device, 'mqtt_secret', None)
        if not mqtt_secret:
            # 如果设备还没有 MQTT 密钥，自动生成并保存
            mqtt_secret = generate_mqtt_secret()
            device.mqtt_secret = mqtt_secret
            session.commit()
            # 同步注册到 Mosquitto Broker
            mosquitto_register_device(device_id, mqtt_secret)

        return {
            "mqtt_username": mqtt_username,
            "mqtt_secret": mqtt_secret,
        }
    finally:
        session.close()


def provision_device_mqtt(device_id: str, user_id: str,
                          mqtt_secret: Optional[str] = None,
                          regenerate: bool = False) -> Dict[str, Any]:
    """
    为设备配置 MQTT 凭证

    Args:
        device_id: 设备ID
        user_id: 用户ID
        mqtt_secret: MQTT 密钥（不传则沿用已有密钥，无已有密钥则自动生成）
        regenerate: 是否强制重新生成（忽略已有密钥）

    Returns:
        包含凭证信息的字典
    """
    db_manager = UserDatabaseManager()
    session = db_manager.get_db(user_id)

    try:
        from database.db_models.user_models import Device
        device = session.query(Device).filter(Device.id == device_id).first()
        if not device:
            raise ValueError(f"设备不存在: {device_id}")

        # 确定最终使用的密钥
        existing_secret = getattr(device, 'mqtt_secret', None) or None

        if regenerate:
            # 强制重新生成
            final_secret = generate_mqtt_secret()
            is_new = True
        elif mqtt_secret:
            # 用户明确传入密钥 → 覆盖
            final_secret = mqtt_secret
            is_new = (final_secret != existing_secret)
        elif existing_secret:
            # 已有密钥且未传入新密钥 → 直接返回，不修改
            logger.info(f"设备已有 MQTT 凭证，直接返回: {device_id}")
            return {
                "device_id": device_id,
                "mqtt_username": str(device.id),
                "mqtt_secret": existing_secret,
                "message": "已返回现有 MQTT 凭证",
            }
        else:
            # 无已有密钥且未传入 → 自动生成
            final_secret = generate_mqtt_secret()
            is_new = True

        device.mqtt_secret = final_secret
        session.commit()

        # 仅在新增或变更密钥时同步 Broker
        if is_new:
            mosquitto_register_device(device_id, final_secret)
            logger.info(f"设备 MQTT 凭证已{'重新生成' if regenerate else '配置'}: {device_id}")

        return {
            "device_id": device_id,
            "mqtt_username": str(device.id),
            "mqtt_secret": final_secret,
            "message": "MQTT 凭证已重新生成" if regenerate else ("MQTT 凭证配置成功" if is_new else "MQTT 凭证已存在"),
        }
    finally:
        session.close()


def sync_device_online_status(device_id: str, user_id: str, online: bool):
    """
    将设备在线状态同步到数据库

    更新 Device 表的 last_seen_at 字段。
    """
    db_manager = UserDatabaseManager()
    session = db_manager.get_db(user_id)

    try:
        from database.db_models.user_models import Device
        device = session.query(Device).filter(Device.id == device_id).first()
        if device:
            device.last_seen_at = datetime.now(timezone.utc)
            session.commit()
    finally:
        session.close()
