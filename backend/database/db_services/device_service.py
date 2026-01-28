from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session
from database.db_models.user_models import Device
from typing import Optional, List, Dict, Any

def create_device(db: Session, device_type: str, platform_level: str,
                 model: str = "", manufacturer: str = "",
                 sensors: Optional[Dict[str, Any]] = None,
                 actuators: Optional[Dict[str, Any]] = None,
                 description: str = "") -> Device:
    """
    创建新设备

    Args:
        db: 数据库会话
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
    print(f"[后端DeviceService] 开始创建设备: 类型={device_type}, 平台={platform_level}")

    # 创建新设备
    print("[后端DeviceService] 创建新设备对象")
    new_device = Device(
        device_type=device_type,
        platform_level=platform_level,
        model=model,
        manufacturer=manufacturer,
        sensors=sensors,
        actuators=actuators,
        description=description
    )

    print(f"[后端DeviceService] 设备对象创建成功, id={new_device.id}")

    # 保存到数据库
    print("[后端DeviceService] 保存设备到数据库")
    db.add(new_device)
    db.commit()

    # 刷新对象以获取更新后的值
    db.refresh(new_device)

    print(f"[后端DeviceService] 设备保存成功: {new_device.id}")
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


def get_devices_by_type(db: Session, device_type: str, active_only: bool = True) -> List[Device]:
    """
    根据设备类型获取设备列表

    Args:
        db: 数据库会话
        device_type: 设备类型
        active_only: 是否只获取活跃设备，默认为True

    Returns:
        List[Device]: 设备列表
    """
    query = db.query(Device).filter(Device.device_type == device_type)

    if active_only:
        query = query.filter(Device.is_active == True)

    return query.all()


def get_devices_by_platform(db: Session, platform_level: str, active_only: bool = True) -> List[Device]:
    """
    根据平台层级获取设备列表

    Args:
        db: 数据库会话
        platform_level: 平台层级
        active_only: 是否只获取活跃设备，默认为True

    Returns:
        List[Device]: 设备列表
    """
    query = db.query(Device).filter(Device.platform_level == platform_level)

    if active_only:
        query = query.filter(Device.is_active == True)

    return query.all()


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
                device_type: str = "", platform_level: str = "",
                model: str = "", manufacturer: str = "",
                sensors: Optional[Dict[str, Any]] = None,
                actuators: Optional[Dict[str, Any]] = None,
                description: str = "", is_active: bool = False) -> Optional[Device]:
    """
    更新设备信息

    Args:
        db: 数据库会话
        device_id: 设备ID
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
    print(f"[后端DeviceService] 开始更新设备: ID={device_id}")

    # 构建查询条件
    conditions = [Device.id == device_id]

    # 查找设备
    device = db.query(Device).filter(and_(*conditions)).first()
    if not device:
        print("[后端DeviceService] 设备不存在")
        return None

    # 准备更新数据
    update_data = {}

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
        print(f"[后端DeviceService] 更新字段: {list(update_data.keys())}")
        db.query(Device).filter(and_(*conditions)).update(update_data)
        db.commit()

    # 刷新对象以获取更新后的值
    db.refresh(device)

    print(f"[后端DeviceService] 设备更新成功: {device.id}")
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
    print(f"[后端DeviceService] 开始删除设备: ID={device_id}")

    # 构建查询条件
    conditions = [Device.id == device_id]

    # 查找设备
    device = db.query(Device).filter(and_(*conditions)).first()
    if not device:
        print("[后端DeviceService] 设备不存在")
        return False

    if soft_delete:
        # 软删除：标记为不活跃
        print("[后端DeviceService] 执行软删除")
        device.is_active = False # type: ignore
        db.commit()
    else:
        # 硬删除：从数据库中删除
        print("[后端DeviceService] 执行硬删除")
        db.delete(device)
        db.commit()

    print(f"[后端DeviceService] 设备删除成功: {device_id}")
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
    print(f"[后端DeviceService] 开始恢复设备: ID={device_id}")

    # 构建查询条件
    conditions = [
        Device.id == device_id,
        Device.is_active == False
    ]

    # 查找已软删除的设备
    device = db.query(Device).filter(and_(*conditions)).first()

    if not device:
        print("[后端DeviceService] 已删除的设备不存在")
        return None

    # 恢复设备
    print("[后端DeviceService] 恢复设备")
    device.is_active = True # type: ignore
    db.commit()
    db.refresh(device)

    print(f"[后端DeviceService] 设备恢复成功: {device.id}")
    return device
