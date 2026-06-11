"""
MQTT 设备状态管理器

功能:
- 维护所有物理设备的在线/离线状态（内存缓存）
- 翻译 MQTT 消息到设备状态更新
- 追踪未完成的命令及其响应
- 提供设备状态查询接口
"""

import logging
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger("MQTT.DeviceManager")


class DeviceStateManager:
    """
    物理设备状态管理器（内存缓存）

    管理所有通过 MQTT 连接上来的物理设备的状态信息，
    并与数据库中的逻辑设备建立映射关系。
    """

    def __init__(self):
        self.devices: Dict[str, dict] = {}        # device_id -> device_state
        self.pending_commands: Dict[str, dict] = {}  # command_id -> command_state
        self.lock = threading.Lock()

    # ------------------------------------------------------------------
    # 设备状态更新
    # ------------------------------------------------------------------

    def update_status(self, device_id: str, status: str,
                      client_id: Optional[str] = None,
                      ip: Optional[str] = None,
                      metadata: Optional[Dict] = None):
        """更新设备在线状态"""
        with self.lock:
            now = datetime.now(timezone.utc).isoformat()

            if device_id not in self.devices:
                self.devices[device_id] = {
                    "device_id": device_id,
                    "status": status,
                    "last_seen": now,
                    "first_seen": now,
                    "ip_address": ip,
                    "client_id": client_id,
                    "metadata": metadata or {},
                    "connect_history": [],
                    "registered": True,  # 能连接 MQTT = 已有凭证 = 已注册
                }
                logger.info(f"🔍 新设备上线: {device_id}")
            else:
                dev = self.devices[device_id]
                dev["status"] = status
                dev["last_seen"] = now
                if ip:
                    dev["ip_address"] = ip
                if client_id:
                    dev["client_id"] = client_id
                if metadata:
                    dev["metadata"].update(metadata)

                # 记录连接历史
                event = "connected" if status == "online" else "disconnected"
                dev["connect_history"].append({"time": now, "event": event})
                if len(dev["connect_history"]) > 100:
                    dev["connect_history"] = dev["connect_history"][-100:]

            logger.info(f"设备状态: {device_id} -> {status}")

    # ------------------------------------------------------------------
    # 设备查询
    # ------------------------------------------------------------------

    def get_device(self, device_id: str) -> Optional[dict]:
        """获取单个设备状态"""
        with self.lock:
            return self.devices.get(device_id)

    def get_all_devices(self) -> List[dict]:
        """获取所有设备状态列表"""
        with self.lock:
            return list(self.devices.values())

    def get_online_count(self) -> int:
        """获取在线设备数"""
        with self.lock:
            return sum(1 for d in self.devices.values() if d["status"] == "online")

    def is_online(self, device_id: str) -> bool:
        """检查指定设备是否在线"""
        with self.lock:
            dev = self.devices.get(device_id)
            return dev is not None and dev["status"] == "online"

    # ------------------------------------------------------------------
    # 命令追踪
    # ------------------------------------------------------------------

    def add_pending_command(self, command_id: str, device_id: str,
                            command: str, payload: dict):
        """记录一条待响应的命令"""
        with self.lock:
            self.pending_commands[command_id] = {
                "command_id": command_id,
                "device_id": device_id,
                "command": command,
                "payload": payload,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "response": None,
                "acknowledged": False,
            }

    def update_command_response(self, command_id: str, response: dict):
        """更新命令响应"""
        with self.lock:
            if command_id in self.pending_commands:
                self.pending_commands[command_id]["response"] = response
                self.pending_commands[command_id]["acknowledged"] = True
                self.pending_commands[command_id]["responded_at"] = \
                    datetime.now(timezone.utc).isoformat()
                logger.info(f"✅ 命令响应: cmd_id={command_id}")

    def get_command(self, command_id: str) -> Optional[dict]:
        """查询命令状态"""
        with self.lock:
            return self.pending_commands.get(command_id)

    def get_pending_count(self) -> int:
        """获取待响应命令数"""
        with self.lock:
            return sum(1 for c in self.pending_commands.values()
                       if not c["acknowledged"])

    # ------------------------------------------------------------------
    # MQTT 消息处理（由 CloudMQTTClient 回调）
    # ------------------------------------------------------------------

    def handle_mqtt_message(self, topic: str, payload: dict):
        """
        处理来自 MQTT 的消息，自动分发到对应的处理方法

        Topic 格式: green-tracker/device/{device_id}/{msg_type}
        """
        try:
            parts = topic.split("/")
            if len(parts) < 4:
                return

            device_id = parts[2]
            msg_type = parts[3] if len(parts) > 3 else ""

            if msg_type == "status":
                self.update_status(
                    device_id=device_id,
                    status=payload.get("status", "unknown"),
                    client_id=payload.get("client_id"),
                    ip=payload.get("ip"),
                    metadata=payload.get("metadata"),
                )

            elif msg_type == "announce":
                # 设备宣告上线，携带能力信息
                self.update_status(
                    device_id=device_id,
                    status="online",
                    client_id=payload.get("client_id"),
                    ip=payload.get("ip"),
                    metadata=payload.get("metadata") or payload,
                )
                logger.info(f"📢 设备宣告: {device_id}")

            elif msg_type == "response":
                cmd_id = payload.get("command_id")
                if cmd_id:
                    self.update_command_response(cmd_id, payload)

            elif msg_type == "lwt":
                self.update_status(
                    device_id=device_id,
                    status="offline",
                )
                logger.warning(f"⚠️ 设备遗嘱消息（异常断线）: {device_id}")

            else:
                logger.debug(f"未知消息类型: {msg_type}, topic={topic}")

        except Exception as e:
            logger.error(f"处理 MQTT 消息异常: {e}, topic={topic}")


# ============================================================
# 全局实例
# ============================================================

_device_manager_instance: Optional[DeviceStateManager] = None


def get_device_manager() -> DeviceStateManager:
    """获取全局设备状态管理器实例"""
    global _device_manager_instance
    if _device_manager_instance is None:
        _device_manager_instance = DeviceStateManager()
    return _device_manager_instance
