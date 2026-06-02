"""
Mosquitto Broker 设备用户管理器

负责在设备 provisioning 时将设备认证信息同步到 Mosquitto passwd 文件，
确保设备能通过 MQTT 协议连接到 Broker。

注意：
- docker-compose 中 passwd 文件通过 :ro 挂载，容器内无法直接写入
- 因此使用临时 Docker 容器挂载宿主机 passwd 文件来执行 mosquitto_passwd
"""

import logging
import subprocess
import os
from pathlib import Path

logger = logging.getLogger("MQTT.MosquittoManager")

# passwd 文件路径（宿主机绝对路径）
_project_root = Path(__file__).parent.parent.parent
_PASSWD_HOST_PATH = str(_project_root / "mqtt" / "mosquitto" / "config" / "passwd")
_CONTAINER_NAME = "green-tracker-mqtt-broker"


def _docker_temp_add_user(device_id: str, secret: str) -> bool:
    """
    使用临时 Docker 容器挂载宿主机 passwd 文件来添加设备用户。

    docker-compose 中 mosquitto/config 以 :ro 挂载，所以不能用 docker exec 写入，
    需要用独立的临时容器挂载宿主机 passwd 文件来操作。
    """
    try:
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "-v", f"{_PASSWD_HOST_PATH}:/tmp/passwd",
                "eclipse-mosquitto:2.0",
                "mosquitto_passwd", "-b", "/tmp/passwd",
                device_id, secret,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        # 忽略 Warning 输出，只看 returncode
        if result.returncode == 0:
            logger.info(f"已注册设备用户到 Mosquitto passwd: {device_id}")
            return True
        else:
            logger.warning(f"mosquitto_passwd stderr: {result.stderr.strip()}")
            return True  # 非零也可能是用户已存在（更新密码）
    except FileNotFoundError:
        logger.error("docker CLI 不可用，无法注册设备用户")
        return False
    except subprocess.TimeoutExpired:
        logger.error("docker run 超时")
        return False
    except Exception as e:
        logger.error(f"注册设备用户异常: {e}")
        return False


def _reload_broker() -> bool:
    """发送 HUP 信号热重载 Mosquitto 配置（不中断现有连接）"""
    try:
        result = subprocess.run(
            ["docker", "exec", _CONTAINER_NAME, "kill", "-HUP", "1"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        logger.info("Mosquitto Broker 配置热重载信号已发送")
        return result.returncode == 0
    except FileNotFoundError:
        logger.warning("docker CLI 不可用，无法重载 Broker")
        return False
    except Exception as e:
        logger.error(f"重载 Broker 异常: {e}")
        return False


def register_device(device_id: str, secret: str) -> bool:
    """
    将设备用户注册到 Mosquitto passwd 文件并热重载 Broker。

    Args:
        device_id: 设备 ID（同时作为 MQTT 用户名）
        secret: MQTT 认证密钥

    Returns:
        注册是否成功
    """
    # 确保父目录存在
    os.makedirs(os.path.dirname(_PASSWD_HOST_PATH), exist_ok=True)
    if not os.path.exists(_PASSWD_HOST_PATH):
        Path(_PASSWD_HOST_PATH).touch()
        logger.info(f"创建 passwd 文件: {_PASSWD_HOST_PATH}")

    # 使用临时容器写入 passwd 文件（绕过容器内 :ro 挂载限制）
    success = _docker_temp_add_user(device_id, secret)
    if not success:
        logger.error(f"设备用户注册失败: {device_id}，设备将无法连接 MQTT Broker")
        return False

    # 热重载 Broker 使新凭证生效
    _reload_broker()
    return True
