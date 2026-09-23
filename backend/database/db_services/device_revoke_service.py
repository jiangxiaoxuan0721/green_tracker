"""
密钥撤销 / 降权时向设备下发 revoke_control

场景：
    云端撤销了某把密钥（删除、禁用、去掉 device_control）后，
    使用该密钥的设备应立刻停止接受指令并重新签到，
    而不是继续按旧能力执行到下一次轮询才发现问题。

投递策略：
    MQTT 在线 → 实时下发；否则落为 pending，由设备 HTTP 轮询取走。
    只有已上报过该密钥的设备才会被通知（关联在用户库的 device_key_bindings）。
"""

import secrets
import time
from datetime import datetime
from typing import Any, Dict, List

REVOKE_COMMAND = "revoke_control"


def _generate_command_id() -> str:
    """与 MQTT 下发保持一致的指令ID格式"""
    return f"cmd_{int(time.time() * 1000)}_{secrets.token_hex(3)}"


def _deliver_revoke(
    db,
    device_id: str,
    reason: str,
    api_key_id: str
) -> str:
    """
    向单台设备投递撤销通知

    Returns:
        str: 实际投递通道 —— "mqtt"（实时）或 "pending"（等轮询）
    """
    from database.db_services.device_command_service import create_command

    params = {"reason": reason}

    # 1) MQTT 在线时实时下发
    try:
        from mqtt.mqtt_client import get_mqtt_client
        from mqtt.device_manager import get_device_manager

        client = get_mqtt_client()
        device_manager = get_device_manager()
        if client and client.connected and device_manager.is_online(device_id):
            sent_command_id = client.send_command(device_id, REVOKE_COMMAND, params)
            if sent_command_id:
                create_command(
                    db,
                    command_id=sent_command_id,
                    device_id=device_id,
                    command=REVOKE_COMMAND,
                    params=params,
                    status="sent",
                    transport="mqtt",
                    api_key_id=api_key_id,
                    issued_by="system",
                    sent_at=datetime.utcnow()
                )
                return "mqtt"
    except Exception as e:
        print(f"[DeviceRevoke] MQTT 下发失败，回退为轮询: {e}")

    # 2) 离线：落 pending，等设备轮询取走
    create_command(
        db,
        command_id=_generate_command_id(),
        device_id=device_id,
        command=REVOKE_COMMAND,
        params=params,
        status="pending",
        transport="http",
        api_key_id=api_key_id,
        issued_by="system"
    )
    return "pending"


def revoke_control_for_key(
    api_key_id: str,
    user_id: str,
    reason: str = "该密钥的远程控制权限已被撤销"
) -> Dict[str, Any]:
    """
    通知所有正在使用该密钥的设备：远程控制授权已撤销

    Args:
        api_key_id: 被撤销/降权的密钥ID
        user_id: 密钥归属用户（决定到哪个用户库查设备关联）
        reason: 下发给设备的原因说明

    Returns:
        Dict: {"notified": 设备数, "devices": [{"device_id", "channel"}]}
    """
    result: Dict[str, Any] = {"notified": 0, "devices": []}

    if not api_key_id or not user_id:
        return result

    try:
        from database.user_db_manager import UserDatabaseManager
        from database.db_services.device_key_binding_service import find_devices_by_api_key

        db = UserDatabaseManager().get_db(str(user_id))
        try:
            devices: List[Dict[str, Any]] = find_devices_by_api_key(db, api_key_id)
            for device in devices:
                channel = _deliver_revoke(
                    db, device["device_id"], reason, str(api_key_id)
                )
                result["devices"].append({
                    "device_id": device["device_id"],
                    "channel": channel
                })
            result["notified"] = len(result["devices"])
        finally:
            db.close()
    except Exception as e:
        print(f"[DeviceRevoke] 撤销通知失败: {e}")
        result["error"] = str(e)

    return result


__all__ = ["revoke_control_for_key", "REVOKE_COMMAND"]
