import logging
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session
from database.db_models.user_models import Device
from typing import Optional, List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


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
    更新设备最后在线时间

    Args:
        db: 数据库会话
        device_id: 设备ID

    Returns:
        bool: 是否成功更新
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if device:
        device.last_seen_at = datetime.utcnow()
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

    优先查询 MQTT DeviceStateManager 实时状态，
    其次 fallback 到 DB 的 last_seen_at 心跳时间戳。

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

    device_id = str(device.id)

    # 1) 优先查询 MQTT 设备管理器的实时状态
    try:
        from mqtt.device_manager import get_device_manager
        dm = get_device_manager()
        mqtt_device = dm.get_device(device_id)
        if mqtt_device:
            mqtt_online = mqtt_device.get("status") == "online"
            mqtt_last_seen = mqtt_device.get("last_seen")
            if mqtt_last_seen:
                try:
                    last_seen_dt = datetime.strptime(mqtt_last_seen[:19], "%Y-%m-%dT%H:%M:%S")
                    diff_seconds = (datetime.utcnow() - last_seen_dt).total_seconds()
                except (ValueError, TypeError):
                    diff_seconds = 0
            else:
                diff_seconds = 0
            return {
                "online": mqtt_online,
                "last_seen_at": mqtt_last_seen,
                "seconds_ago": round(diff_seconds, 1),
            }
    except Exception:
        pass  # MQTT 模块不可用时静默 fallback

    # 2) Fallback: 基于 DB last_seen_at 判定
    if not device.last_seen_at:
        return {
            "online": False,
            "last_seen_at": None,
            "seconds_ago": None,
        }
    now = datetime.utcnow()
    diff_seconds = (now - device.last_seen_at).total_seconds()
    return {
        "online": diff_seconds <= HEARTBEAT_TIMEOUT_SECONDS,
        "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        "seconds_ago": round(diff_seconds, 1),
    }
