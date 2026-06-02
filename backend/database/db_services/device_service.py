import hashlib
import logging
import os
import secrets
import subprocess
import tempfile

from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session
from database.db_models.user_models import Device
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# =============================================================================
# MQTT Will Message 在线状态追踪（内存级，重启后清空）
# =============================================================================
# 当设备通过 MQTT status 主题上报 online 时加入此集合
# 当设备上报 offline 或 Broker 发布 Will Message 时移除此集合
_online_device_ids: set[str] = set()


def set_device_mqtt_online_status(device_id: str, online: bool):
    """
    由 MQTT 客户端调用，更新设备在线状态的内存缓存。
    仅在通过 MQTT Will Message / status topic 收到状态变更时调用。
    """
    if online:
        _online_device_ids.add(device_id)
        logger.debug("[DeviceService] MQTT 上线: %s...", device_id[:8])
    else:
        _online_device_ids.discard(device_id)
        logger.debug("[DeviceService] MQTT 离线: %s...", device_id[:8])


def is_device_online_by_mqtt(device_id: str) -> bool:
    """查询设备是否通过 MQTT Will Message 机制判定为在线"""
    return device_id in _online_device_ids


def create_device(db: Session, name: str, device_type: str, platform_level: str,
                 model: str = "", manufacturer: str = "",
                 sensors: Optional[Dict[str, Any]] = None,
                 actuators: Optional[Dict[str, Any]] = None,
                 description: str = "") -> Device:
    """
    创建新设备

    Args:
        db: 数据库会话
        name: 设备名称
        device_type: 设备类型 (satellite/uav/ugv/robot/sensor)
        platform_level: 平台层级 (天/空/地/具身)
        model: 设备型号（可选）
        manufacturer: 设备厂商（可选）
        sensors: 传感器配置（可选，JSON格式）
        actuators: 执行机构配置（可选，JSON格式）
        description: 设备说明（可选）

    Returns:
        Device: 创建的设备对象
    """
    print(f"[DeviceService] 创建设备: {name}")

    new_device = Device(
        name=name,
        device_type=device_type,
        platform_level=platform_level,
        model=model,
        manufacturer=manufacturer,
        sensors=sensors,
        actuators=actuators,
        description=description
    )

    db.add(new_device)
    db.commit()
    db.refresh(new_device)

    print(f"[DeviceService] 设备已创建: {new_device.id}")
    return new_device


def get_device_by_id(db: Session, device_id: str) -> Optional[Device]:
    """
    根据设备ID获取设备信息

    Args:
        db: 数据库会话
        device_id: 设备ID

    Returns:
        Device: 设备对象，不存在返回None
    """
    return db.query(Device).filter(Device.id == device_id).first()


def get_all_devices(db: Session, active_only: bool = True) -> List[Device]:
    """
    获取所有设备

    Args:
        db: 数据库会话
        active_only: 是否只获取活跃设备，默认为True

    Returns:
        List[Device]: 设备列表
    """
    query = db.query(Device)

    if active_only:
        query = query.filter(Device.is_active == True)

    return query.all()


def search_devices(db: Session, device_type: str = "",
                 platform_level: str = "", keyword: str = "",
                 has_sensor: str = "", has_actuator: str = "",
                 active_only: bool = True) -> List[Device]:
    """
    根据条件搜索设备

    Args:
        db: 数据库会话
        device_type: 设备类型（可选）
        platform_level: 平台层级（可选）
        keyword: 关键词（搜索型号、厂商和描述）
        has_sensor: 传感器类型（筛选包含特定传感器的设备）
        has_actuator: 执行机构类型（筛选包含特定执行机构的设备）
        active_only: 是否只获取活跃设备，默认为True

    Returns:
        List[Device]: 搜索结果
    """
    query = db.query(Device)

    if active_only:
        query = query.filter(Device.is_active == True)

    if device_type:
        query = query.filter(Device.device_type == device_type)

    if platform_level:
        query = query.filter(Device.platform_level == platform_level)

    if keyword:
        search_filter = or_(
            Device.model.ilike(f"%{keyword}%"),
            Device.manufacturer.ilike(f"%{keyword}%"),
            Device.description.ilike(f"%{keyword}%")
        )
        query = query.filter(search_filter)

    # 使用JSON查询搜索特定传感器
    if has_sensor:
        query = query.filter(text("sensors @> :sensor_key").bindparams(sensor_key=f'{{"{has_sensor}": true}}'))

    # 使用JSON查询搜索特定执行机构
    if has_actuator:
        query = query.filter(text("actuators @> :actuator_key").bindparams(actuator_key=f'{{"{has_actuator}": true}}'))

    return query.all()


def update_device(db: Session, device_id: str,
                name: str = None, device_type: str = "", platform_level: str = "",
                model: str = "", manufacturer: str = "",
                sensors: Optional[Dict[str, Any]] = None,
                actuators: Optional[Dict[str, Any]] = None,
                description: str = "", is_active: bool = False) -> Optional[Device]:
    """
    更新设备信息

    Args:
        db: 数据库会话
        device_id: 设备ID
        name: 新设备名称（可选）
        device_type: 新设备类型（可选）
        platform_level: 新平台层级（可选）
        model: 新型号（可选）
        manufacturer: 新厂商（可选）
        sensors: 新传感器配置（可选）
        actuators: 新执行机构配置（可选）
        description: 新描述（可选）
        is_active: 新状态（可选）

    Returns:
        Device: 更新后的设备对象，不存在返回None
    """
    print(f"[DeviceService] 更新设备: {device_id}")

    # 构建查询条件
    conditions = [Device.id == device_id]

    # 查找设备
    device = db.query(Device).filter(and_(*conditions)).first()
    if not device:
        return None

    # 准备更新数据
    update_data = {}

    if name is not None:
        update_data["name"] = name
    if device_type is not None:
        update_data["device_type"] = device_type
    if platform_level is not None:
        update_data["platform_level"] = platform_level
    if model is not None:
        update_data["model"] = model
    if manufacturer is not None:
        update_data["manufacturer"] = manufacturer
    if sensors is not None:
        update_data["sensors"] = sensors
    if actuators is not None:
        update_data["actuators"] = actuators
    if description is not None:
        update_data["description"] = description
    if is_active is not None:
        update_data["is_active"] = is_active

    # 执行更新
    if update_data:
        db.query(Device).filter(and_(*conditions)).update(update_data)
        db.commit()

    # 刷新对象以获取更新后的值
    db.refresh(device)

    return device


def delete_device(db: Session, device_id: str, soft_delete: bool = True) -> bool:
    """
    删除设备

    Args:
        db: 数据库会话
        device_id: 设备ID
        soft_delete: 是否使用软删除（默认为True，只标记为不活跃）

    Returns:
        bool: 删除是否成功
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return False

    if soft_delete:
        device.is_active = False  # type: ignore
    else:
        db.delete(device)
    db.commit()

    return True


def restore_device(db: Session, device_id: str) -> Optional[Device]:
    """
    恢复已软删除的设备

    Args:
        db: 数据库会话
        device_id: 设备ID

    Returns:
        Device: 恢复后的设备对象，不存在返回None
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.is_active == False
    ).first()

    if not device:
        return None

    device.is_active = True  # type: ignore
    db.commit()
    db.refresh(device)

    return device


# =============================================================================
# 设备在线状态相关函数
# =============================================================================

HEARTBEAT_TIMEOUT_SECONDS = 120  # 120秒未收到心跳判定离线


def update_device_last_seen(db: Session, device_id: str) -> bool:
    """
    更新设备最后在线时间（通常由 MQTT 心跳触发）

    Args:
        db: 数据库会话
        device_id: 设备ID

    Returns:
        bool: 是否成功更新
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if device:
        device.last_seen_at = datetime.now(timezone.utc)  # type: ignore[attr-defined]
        db.commit()
        return True
    return False


def is_device_online(device: Device) -> bool:
    """
    判断设备是否在线

    规则：设备 last_seen_at 不为空且距当前时间不超过 120 秒

    Args:
        device: 设备对象

    Returns:
        bool: 是否在线
    """
    if not device or not device.last_seen_at:
        return False
    now = datetime.now(timezone.utc)
    diff_seconds = (now - device.last_seen_at).total_seconds()
    return diff_seconds <= HEARTBEAT_TIMEOUT_SECONDS


def get_device_online_status(device: Device) -> dict:
    """
    获取设备在线状态的完整信息

    优先级：
    1. MQTT Will Message 状态（即时，设备连接/断开时 Broker 主动通知）
    2. last_seen_at 心跳时间戳（兜底，兼容旧设备客户端）

    Args:
        device: 设备对象

    Returns:
        dict: 包含 online, last_seen_at, seconds_ago 字段
    """
    if not device or not device.id:
        return {
            "online": False,
            "last_seen_at": None,
            "seconds_ago": None,
        }

    # 优先使用 MQTT Will Message 的即时状态
    if device.id in _online_device_ids:
        now = datetime.now(timezone.utc)
        diff_seconds = (now - device.last_seen_at).total_seconds() if device.last_seen_at else None
        return {
            "online": True,
            "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
            "seconds_ago": round(diff_seconds, 1) if diff_seconds else None,
        }

    # 兜底：基于 last_seen_at 心跳超时判定
    if not device.last_seen_at:
        return {
            "online": False,
            "last_seen_at": None,
            "seconds_ago": None,
        }
    now = datetime.now(timezone.utc)
    diff_seconds = (now - device.last_seen_at).total_seconds()
    return {
        "online": diff_seconds <= HEARTBEAT_TIMEOUT_SECONDS,
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        "seconds_ago": round(diff_seconds, 1),
    }


# =============================================================================
# 设备绑定（MQTT 凭据生成）
# =============================================================================

def generate_device_secret() -> str:
    """生成 32 字符随机设备密钥"""
    return secrets.token_hex(16)


def _modify_passwd_via_temp(mosquitto_args: str) -> subprocess.CompletedProcess:
    """
    通过临时文件方式修改 Mosquitto 密码文件。

    绕过 mosquitto_passwd 在 /etc/mosquitto/ 下创建备份的权限问题：
    1. 将 passwd 复制到 /tmp 下临时文件（通过 sg 获得组读权限）
    2. 在 /tmp 下执行 mosquitto_passwd 操作
    3. 将修改后的文件写回原路径（通过 sg 获得组写权限）

    Args:
        mosquitto_args: mosquitto_passwd 的参数部分，如 "-b /tmp/xxx user pass"

    Returns:
        subprocess.CompletedProcess 或抛异常
    """
    tmp_path = None
    try:
        # 1. 复制到临时文件（需要 mosquitto 组权限读取源文件）
        tmp_fd, tmp_path = tempfile.mkstemp(prefix="green_tracker_passwd_")
        os.close(tmp_fd)
        cp_read = subprocess.run(
            ["sg", "mosquitto", "-c", f"cp /etc/mosquitto/passwd {tmp_path}"],
            capture_output=True, text=True, timeout=10,
        )
        if cp_read.returncode != 0:
            raise RuntimeError(f"读取密码文件失败: {cp_read.stderr.strip()}")

        # 2. 在临时文件上执行 mosquitto_passwd 操作
        cmd = f"mosquitto_passwd {mosquitto_args.replace('/etc/mosquitto/passwd', tmp_path)}"
        result = subprocess.run(
            cmd.split(),
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return result  # 调用方处理错误

        # 3. 写回原路径（需要 mosquitto 组权限）
        cp_write = subprocess.run(
            ["sg", "mosquitto", "-c", f"cp {tmp_path} /etc/mosquitto/passwd"],
            capture_output=True, text=True, timeout=10,
        )
        if cp_write.returncode != 0:
            raise RuntimeError(f"写回密码文件失败: {cp_write.stderr.strip()}")

        return result

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _add_device_to_mosquitto_passwd(device_id: str, password: str) -> bool:
    """
    将设备凭据添加到 Mosquitto 密码文件。

    通过临时文件方式修改，避免在 /etc/mosquitto/ 下创建备份的权限问题。

    Args:
        device_id: 设备 UUID（作为 MQTT 用户名）
        password: MQTT 密码（明文）

    Returns:
        bool: 是否成功
    """
    try:
        result = _modify_passwd_via_temp(
            f"-b /etc/mosquitto/passwd {device_id} {password}"
        )
        if result.returncode != 0:
            logger.error(
                "[provision] mosquitto_passwd 失败 (rc=%d): %s",
                result.returncode, result.stderr.strip()
            )
            return False
        logger.info(f"[provision] 设备 {device_id[:8]}... 已写入 Mosquitto 密码文件")
        return True
    except Exception as e:
        logger.error(f"[provision] 更新 Mosquitto 密码文件异常: {e}")
        return False


def _reload_mosquitto() -> bool:
    """
    重载 Mosquitto 配置使密码文件变更生效

    尝试多种方式：
    1. sudo systemctl reload（推荐，需配置 sudoers）
    2. 直接 systemctl reload（当前用户有权限时）
    3. pkill -HUP / killall -HUP（当前用户与 mosquitto 同用户时）
    """
    for cmd in (
        ["sudo", "systemctl", "reload", "mosquitto"],
        ["systemctl", "reload", "mosquitto"],
        ["pkill", "-HUP", "mosquitto"],
        ["killall", "-HUP", "mosquitto"],
    ):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                logger.info(f"[provision] Mosquitto 重载成功 ({' '.join(cmd)})")
                return True
        except Exception:
            continue
    logger.warning("[provision] Mosquitto 重载失败，密码变更可能需手动重载后生效")
    return False


def remove_device_from_mosquitto_passwd(device_id: str) -> bool:
    """
    从 Mosquitto 密码文件中删除设备凭据

    通过临时文件方式修改，避免在 /etc/mosquitto/ 下创建备份的权限问题。

    Args:
        device_id: 设备 UUID（MQTT 用户名）

    Returns:
        bool: 是否成功
    """
    try:
        result = _modify_passwd_via_temp(
            f"-D /etc/mosquitto/passwd {device_id}"
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            if "not found" in stderr.lower():
                logger.info(
                    "[cleanup] 设备 %s... 不在 Mosquitto 密码文件中，跳过",
                    device_id[:8]
                )
                return True
            logger.error(
                "[cleanup] mosquitto_passwd -D 失败 (rc=%d): %s",
                result.returncode, stderr
            )
            return False
        logger.info("[cleanup] 设备 %s... 已从 Mosquitto 密码文件移除", device_id[:8])
        _ = _reload_mosquitto()
        return True
    except Exception as e:
        logger.error(f"[cleanup] 从 Mosquitto 密码文件移除设备异常: {e}")
        return False


def provision_device(db: Session, device_id: str) -> Optional[str]:
    """
    为设备生成 MQTT 凭据并存储密钥哈希，同时写入 Mosquitto 密码文件

    Args:
        db: 数据库会话
        device_id: 设备ID

    Returns:
        str: 明文密钥（仅返回一次），None 表示设备不存在
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return None

    secret = generate_device_secret()

    # 1. 写入 Mosquitto 密码文件（使设备能连上 Broker）
    passwd_ok = _add_device_to_mosquitto_passwd(device_id, secret)
    if passwd_ok:
        _ = _reload_mosquitto()
    else:
        logger.error(
            "[provision] 设备 %s... Mosquitto 密码文件写入失败，凭据生成中断",
            device_id[:8]
        )
        return None

    # 2. 存储密钥哈希到数据库（用于后续验证）
    secret_hash = hashlib.sha256(secret.encode()).hexdigest()
    device.mqtt_secret_hash = secret_hash  # type: ignore[attr-defined]
    db.commit()

    logger.info("[provision] 设备 %s... 凭据生成成功", device_id[:8])
    return secret


def deprovision_device(db: Session, device_id: str) -> bool:
    """
    清空设备 MQTT 凭据（解除绑定）

    1. 从 Mosquitto 密码文件移除设备
    2. 清除数据库中的 mqtt_secret_hash

    Args:
        db: 数据库会话
        device_id: 设备ID

    Returns:
        bool: 是否成功
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return False

    # 1. 从 Mosquitto 密码文件移除
    if device.mqtt_secret_hash:
        remove_device_from_mosquitto_passwd(device_id)

    # 2. 清空数据库中的密钥哈希
    device.mqtt_secret_hash = None  # type: ignore[attr-defined]
    db.commit()

    logger.info("[deprovision] 设备 %s... 凭据已清空", device_id[:8])
    return True


def is_device_provisioned(device: Device) -> bool:
    """检查设备是否已绑定（是否有 MQTT 凭证）"""
    return bool(device.mqtt_secret_hash)


def record_device_heartbeat(device_id: str, secret: str) -> bool:
    """
    接收设备心跳（HTTP API），验证设备凭据并更新 last_seen_at。

    遍历所有用户数据库查找设备，验证 mqtt_secret_hash 后更新时间戳。

    Args:
        device_id: 设备 UUID
        secret: 设备 MQTT 密钥（明文）

    Returns:
        bool: 是否成功
    """
    _ = os  # keep import
    from database.user_db_manager import db_manager
    from database.main_db import SessionLocal
    from database.db_models.meta_model import UserDatabase

    # 计算密钥哈希
    secret_hash = hashlib.sha256(secret.encode()).hexdigest()

    # 从元数据库获取所有活跃用户
    try:
        with SessionLocal() as meta_db:
            user_dbs = meta_db.query(UserDatabase.user_id).filter(
                UserDatabase.is_active == True
            ).all()
            all_user_ids = [row.user_id for row in user_dbs]
    except Exception as e:
        logger.error(f"[Heartbeat] 查询元数据库失败: {e}")
        return False

    now_utc = datetime.now(timezone.utc)

    for user_id in all_user_ids:
        try:
            db = db_manager.get_db(user_id)
            try:
                device = db.query(Device).filter(Device.id == device_id).first()
                if device:
                    # 验证密钥哈希
                    if device.mqtt_secret_hash != secret_hash:
                        logger.warning(
                            "[Heartbeat] 设备 %s... 密钥验证失败", device_id[:8]
                        )
                        return False

                    device.last_seen_at = now_utc
                    db.commit()
                    logger.info(
                        "[Heartbeat] 设备 %s... HTTP心跳更新 last_seen_at=%s",
                        device_id[:8], now_utc
                    )
                    return True
            finally:
                db.close()
        except Exception as e:
            logger.debug("[Heartbeat] 查询用户 %s 数据库跳过: %s", user_id, e)
            continue

    logger.warning("[Heartbeat] 设备 %s... 未找到", device_id[:8])
    return False
