"""
MQTT 云端客户端

功能:
- 连接 MQTT Broker（使用管理员账号）
- 订阅所有设备的状态/响应/遗嘱 Topic
- 向指定设备下发命令
- 自动重连
"""

import os
import json
import time
import logging
import threading
import secrets
from datetime import datetime, timezone
from typing import Dict, Optional
from pathlib import Path

from dotenv import load_dotenv
import paho.mqtt.client as mqtt

logger = logging.getLogger("MQTT.Client")

# ============================================================
# 环境变量加载（确保从项目根目录 .env 加载）
# ============================================================
_project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(_project_root, '.env'))

BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
BROKER_USERNAME = os.getenv("MQTT_BROKER_USERNAME", "admin")
BROKER_PASSWORD = os.getenv("MQTT_BROKER_PASSWORD", "admin123")
LOG_LEVEL = os.getenv("MQTT_LOG_LEVEL", "INFO").upper()

# ============================================================
# Topic 定义（与物理设备客户端编码规则一致）
# ============================================================
TOPIC_PREFIX = "green-tracker"
TOPIC_STATUS   = f"{TOPIC_PREFIX}/device/+/status"
TOPIC_RESPONSE = f"{TOPIC_PREFIX}/device/+/response"
TOPIC_LWT      = f"{TOPIC_PREFIX}/device/+/lwt"
TOPIC_ANNOUNCE = f"{TOPIC_PREFIX}/device/+/announce"
TOPIC_COMMAND  = f"{TOPIC_PREFIX}/device/{{device_id}}/command"


class CloudMQTTClient:
    """
    云端 MQTT 客户端

    作为 MQTT Client 连接到 Broker，负责：
    1. 订阅所有设备的状态/响应/遗嘱消息
    2. 向设备发布命令
    3. 维护与 Broker 的稳定连接
    """

    def __init__(self):
        self.client_id = f"green-tracker-cloud-{int(time.time())}"
        self.client = mqtt.Client(
            client_id=self.client_id,
            protocol=mqtt.MQTTv311,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )

        # 使用管理员账号认证
        self.client.username_pw_set(BROKER_USERNAME, BROKER_PASSWORD)

        # 绑定回调
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        self.connected = False
        self._message_handler = None  # 外部消息处理器
        self._mqtt_thread: Optional[threading.Thread] = None

    def set_message_handler(self, handler):
        """设置外部消息处理回调: handler(topic: str, payload: dict)"""
        self._message_handler = handler

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            logger.info(f"✅ MQTT Broker 连接成功 (client_id={self.client_id})")

            # 订阅设备状态
            client.subscribe(TOPIC_STATUS, qos=1)
            logger.info(f"  已订阅: {TOPIC_STATUS}")

            # 订阅命令响应
            client.subscribe(TOPIC_RESPONSE, qos=1)
            logger.info(f"  已订阅: {TOPIC_RESPONSE}")

            # 订阅遗嘱消息
            client.subscribe(TOPIC_LWT, qos=1)
            logger.info(f"  已订阅: {TOPIC_LWT}")

            # 订阅设备宣告（设备上线时广播自身能力信息）
            client.subscribe(TOPIC_ANNOUNCE, qos=1)
            logger.info(f"  已订阅: {TOPIC_ANNOUNCE}")
        else:
            logger.error(f"❌ MQTT 连接失败! rc={rc}")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            logger.debug(f"📥 收到消息: topic={topic}")

            if self._message_handler:
                self._message_handler(topic, payload)

        except json.JSONDecodeError as e:
            logger.error(f"JSON 解码失败: {e}, raw={msg.payload[:200]}")
        except Exception as e:
            logger.error(f"消息处理异常: {e}")

    def _on_disconnect(self, client, userdata, rc, properties=None):
        self.connected = False
        if rc != 0:
            logger.warning(f"⚠️ MQTT 意外断开! rc={rc}，将自动重连")

    def _loop_thread(self):
        try:
            self.client.loop_forever()
        except Exception as e:
            logger.error(f"MQTT 循环异常退出: {e}")

    def start(self):
        """启动 MQTT 客户端"""
        logger.info(f"正在连接 MQTT Broker: {BROKER_HOST}:{BROKER_PORT}")
        try:
            self.client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            self._mqtt_thread = threading.Thread(
                target=self._loop_thread, daemon=False, name="mqtt-loop"
            )
            self._mqtt_thread.start()
            logger.info("MQTT 客户端已启动")
        except Exception as e:
            logger.error(f"连接 Broker 失败: {e}")
            raise

    def stop(self):
        """停止 MQTT 客户端"""
        self.client.disconnect()
        if self._mqtt_thread and self._mqtt_thread.is_alive():
            self._mqtt_thread.join(timeout=5)
        logger.info("MQTT 客户端已停止")

    def send_command(self, device_id: str, command: str,
                     params: Optional[Dict] = None) -> Optional[str]:
        """
        向指定设备下发命令

        Args:
            device_id: 目标设备ID（DB 中的逻辑设备 id）
            command: 命令名称
            params: 命令参数

        Returns:
            command_id 或 None
        """
        if not self.connected:
            logger.error("MQTT 未连接，无法发送命令")
            return None

        command_id = f"cmd_{int(time.time() * 1000)}_{secrets.token_hex(3)}"
        message = {
            "command_id": command_id,
            "command": command,
            "params": params or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "green-tracker-cloud",
        }

        topic = TOPIC_COMMAND.format(device_id=device_id)
        result = self.client.publish(topic, json.dumps(message), qos=1)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            logger.info(f"📤 命令已发送: {command} -> {device_id} (cmd_id={command_id})")
            return command_id
        else:
            logger.error(f"命令发送失败: rc={result.rc}")
            return None


# ============================================================
# 全局实例管理
# ============================================================

_mqtt_client_instance: Optional[CloudMQTTClient] = None
_lock = threading.Lock()


def get_mqtt_client() -> Optional[CloudMQTTClient]:
    """获取全局 MQTT 客户端实例"""
    return _mqtt_client_instance


def init_mqtt_client() -> CloudMQTTClient:
    """初始化并启动全局 MQTT 客户端"""
    global _mqtt_client_instance
    with _lock:
        if _mqtt_client_instance is not None:
            return _mqtt_client_instance

        _mqtt_client_instance = CloudMQTTClient()
        _mqtt_client_instance.start()
        return _mqtt_client_instance


def shutdown_mqtt_client():
    """关闭全局 MQTT 客户端"""
    global _mqtt_client_instance
    with _lock:
        if _mqtt_client_instance:
            _mqtt_client_instance.stop()
            _mqtt_client_instance = None
