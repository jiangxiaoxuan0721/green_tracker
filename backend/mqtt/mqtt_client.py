"""
MQTT 客户端管理器
- 连接 MQTT Broker，订阅设备心跳通配符主题
- 处理心跳消息，更新设备 last_seen_at
- 提供指令下发接口
"""
import json
import logging
import os
from datetime import datetime, timezone
from threading import Thread
from typing import Optional

import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

logger = logging.getLogger(__name__)

# =============================================================================
# MQTT 配置
# =============================================================================
MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
MQTT_KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")

# 心跳主题通配符：device/+/heartbeat（兼容旧设备）
HEARTBEAT_TOPIC = "device/+/heartbeat"
# MQTT Will Message 状态主题：device/+/status
STATUS_TOPIC = "device/+/status"
# 心跳超时判定离线时间（秒）
HEARTBEAT_TIMEOUT_SECONDS = 120
# 指令下发主题模板
CMD_TOPIC_TEMPLATE = "device/{device_id}/cmd"


class MQTTClientManager:
    """
    MQTT 客户端管理器（单例模式）
    在后台线程中运行，监听设备心跳并更新在线状态
    """

    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self._thread: Optional[Thread] = None

    # -------------------------------------------------------------------------
    # 连接回调
    # -------------------------------------------------------------------------
    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            logger.info(
                f"[MQTT] 已连接 Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}"
            )
            # 订阅设备心跳（兼容旧设备客户端）
            result = client.subscribe(HEARTBEAT_TOPIC, qos=1)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"[MQTT] 已订阅心跳: {HEARTBEAT_TOPIC}")
            # 订阅设备在线状态（Will Message / status 主题）
            result2 = client.subscribe(STATUS_TOPIC, qos=1)
            if result2[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"[MQTT] 已订阅状态: {STATUS_TOPIC}")
        else:
            logger.error(f"[MQTT] 连接失败, rc={rc}")

    def _on_disconnect(self, client, userdata, rc, properties=None, reason=None):
        if rc != 0:
            logger.warning(
                f"[MQTT] 意外断开连接 (rc={rc})，将自动重连..."
            )

    # -------------------------------------------------------------------------
    # 消息回调
    # -------------------------------------------------------------------------
    def _on_message(self, client, userdata, msg):
        """接收 MQTT 消息并分发处理"""
        topic = msg.topic
        try:
            payload = msg.payload.decode('utf-8', errors='ignore')
        except Exception:
            logger.warning(f"[MQTT] 无法解码消息 payload: {msg.topic}")
            return

        logger.debug(f"[MQTT] 收到消息: topic={topic} payload={payload[:100]}")

        # 状态主题（Will Message / online/offline）
        if self._is_status_topic(topic):
            self._handle_status(topic, payload)
        # 心跳主题（兼容旧设备）
        elif self._is_heartbeat_topic(topic):
            self._handle_heartbeat(topic, payload)

    # -------------------------------------------------------------------------
    # 状态处理（Will Message / online-offline）
    # -------------------------------------------------------------------------
    @staticmethod
    def _is_status_topic(topic: str) -> bool:
        """判断 topic 是否为设备状态主题"""
        parts = topic.split('/')
        return (
            len(parts) == 3
            and parts[0] == 'device'
            and parts[2] == 'status'
        )

    def _handle_status(self, topic: str, payload: str):
        """
        处理设备在线状态变更（Will Message 或主动上报）

        消息格式: "online" 或 "offline"（纯文本）
        Broker Will Message 在设备异常断开时自动发布 "offline"
        """
        from database.db_services.device_service import set_device_mqtt_online_status

        device_id = self._extract_device_id_from_topic(topic)
        if not device_id:
            logger.warning(f"[MQTT] 无法从 status topic 提取设备ID: {topic}")
            return

        status = payload.strip().lower()
        if status == 'online':
            set_device_mqtt_online_status(device_id, True)
            self._update_device_last_seen(device_id)
            logger.info(f"[MQTT] 设备上线: {device_id[:8]}...")
        elif status == 'offline':
            set_device_mqtt_online_status(device_id, False)
            logger.info(f"[MQTT] 设备离线: {device_id[:8]}...")
        else:
            logger.debug(f"[MQTT] 未知状态消息: {status}")

    # -------------------------------------------------------------------------
    # 心跳处理
    # -------------------------------------------------------------------------
    @staticmethod
    def _is_heartbeat_topic(topic: str) -> bool:
        """判断 topic 是否为设备心跳主题"""
        parts = topic.split('/')
        return (
            len(parts) == 3
            and parts[0] == 'device'
            and parts[2] == 'heartbeat'
        )

    @staticmethod
    def _extract_device_id_from_topic(topic: str) -> Optional[str]:
        """从 topic 提取设备 UUID（device/{uuid}/heartbeat）"""
        parts = topic.split('/')
        if len(parts) >= 2:
            return parts[1]
        return None

    def _handle_heartbeat(self, topic: str, payload: str):
        """
        处理设备心跳消息
        预期格式: {"device_id": "uuid", "type": "heartbeat", "timestamp": ...}
        """
        device_id = self._extract_device_id_from_topic(topic)
        if not device_id:
            logger.warning(f"[MQTT] 无法从 topic 提取设备ID: {topic}")
            return

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            logger.error(f"[MQTT] 心跳消息 JSON 解析失败: {payload[:200]}")
            return

        # 校验消息类型
        if data.get('type') != 'heartbeat':
            logger.debug(f"[MQTT] 非心跳消息, type={data.get('type')}")
            return

        # 校验 device_id 一致性（防御性校验）
        msg_device_id = data.get('device_id')
        if msg_device_id and msg_device_id != device_id:
            logger.warning(
                f"[MQTT] device_id 不一致: topic={device_id}, "
                f"payload={msg_device_id}"
            )
            return

        # 更新 last_seen_at
        self._update_device_last_seen(device_id)

    def _get_all_user_ids_from_meta(self) -> list[str]:
        """从元数据库获取所有拥有数据库的用户ID列表"""
        from database.main_db import SessionLocal
        from database.db_models.meta_model import UserDatabase

        try:
            with SessionLocal() as meta_db:
                user_dbs = meta_db.query(UserDatabase.user_id).filter(
                    UserDatabase.is_active == True
                ).all()
                return [row.user_id for row in user_dbs]
        except Exception as e:
            logger.error(f"[MQTT] 查询元数据库失败: {e}")
            return []

    def _update_device_last_seen(self, device_id: str):
        """在对应各用户数据库中查找设备并更新 last_seen_at"""
        from database.user_db_manager import db_manager
        from database.db_models.user_models import Device

        # 先从已缓存的 engine 中查找（快速路径）
        cached_users = db_manager.get_active_users()
        # 再从元数据库获取所有活跃用户（兜底路径，覆盖未触发懒加载的用户）
        all_user_ids = set(self._get_all_user_ids_from_meta())

        # 合并：已缓存的优先，再试元数据库中的其他用户
        user_ids_to_try = list(cached_users) + [
            uid for uid in all_user_ids if uid not in cached_users
        ]

        now_utc = datetime.now(timezone.utc)
        found = False

        for user_id in user_ids_to_try:
            try:
                db = db_manager.get_db(user_id)
                try:
                    device = db.query(Device).filter(
                        Device.id == device_id
                    ).first()
                    if device:
                        device.last_seen_at = now_utc  # type: ignore[attr-defined]
                        db.commit()
                        logger.debug(
                            f"[MQTT] 设备 {device_id[:8]}... 心跳更新 "
                            f"user={user_id}, last_seen_at={now_utc}"
                        )
                        found = True
                        break
                finally:
                    db.close()
            except Exception as e:
                logger.debug(
                    f"[MQTT] 查询用户 {user_id} 数据库跳过: {e}"
                )
                continue

        if not found:
            logger.debug(
                f"[MQTT] 设备 {device_id[:8]}... 未在任何用户数据库中找到"
            )

    # -------------------------------------------------------------------------
    # 指令下发
    # -------------------------------------------------------------------------
    def dispatch_command(self, device_id: str, command: dict) -> bool:
        """
        向指定设备下发 MQTT 指令

        Args:
            device_id: 目标设备 UUID
            command: 指令内容（dict，会被序列化为 JSON）

        Returns:
            bool: 是否成功发布
        """
        if not self.client or not self.client.is_connected():
            logger.error("[MQTT] 客户端未连接，无法下发指令")
            return False

        topic = CMD_TOPIC_TEMPLATE.format(device_id=device_id)
        try:
            payload = json.dumps(command)
            msg_info = self.client.publish(topic, payload, qos=1)
            msg_info.wait_for_publish(timeout=5)

            if msg_info.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(
                    f"[MQTT] 指令已下发 → {device_id[:8]}... "
                    f"cmd={command.get('command', 'unknown')}"
                )
                return True
            else:
                logger.error(f"[MQTT] 指令下发失败, rc={msg_info.rc}")
                return False
        except Exception as e:
            logger.error(f"[MQTT] 指令下发异常: {e}")
            return False

    # -------------------------------------------------------------------------
    # 生命周期
    # -------------------------------------------------------------------------
    def start(self):
        """启动 MQTT 客户端（后台线程）"""
        try:
            client_id = f"green-tracker-backend-{os.getpid()}"
            client = mqtt.Client(
                client_id=client_id,
                protocol=mqtt.MQTTv5,
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            )

            if MQTT_USERNAME and MQTT_PASSWORD:
                client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

            client.on_connect = self._on_connect
            client.on_disconnect = self._on_disconnect
            client.on_message = self._on_message

            client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_KEEPALIVE)

            self.client = client
            self._thread = Thread(target=client.loop_forever, daemon=True)
            self._thread.start()
            logger.info(
                f"[MQTT] MQTT 客户端已启动 "
                f"({MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}), "
                f"监听 {HEARTBEAT_TOPIC}, {STATUS_TOPIC}"
            )
        except Exception as e:
            logger.error(f"[MQTT] 启动失败: {e}")

    def stop(self):
        """停止 MQTT 客户端"""
        if self.client:
            try:
                self.client.disconnect()
                self.client.loop_stop()
                logger.info("[MQTT] MQTT 客户端已停止")
            except Exception as e:
                logger.error(f"[MQTT] 停止异常: {e}")


# 全局单例
mqtt_manager = MQTTClientManager()
