"""
MQTT 云端管理 REST API

提供:
- 设备在线状态查询
- 设备指令下发
- 命令执行结果查询
- 系统统计信息
- MQTT 凭证管理
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from .mqtt_client import get_mqtt_client, BROKER_HOST, BROKER_PORT
from .device_manager import get_device_manager
from .command_defs import COMMAND_DEFS, list_command_definitions
from api.dependencies import assert_device_control_granted
from database.main_db import get_meta_db
from database.user_db_manager import get_user_db
from .service import provision_device_mqtt
from .schemas import (
    CommandRequest, CommandResponse, CommandResult,
    DeviceMqttStatus, DeviceMqttDetail,
    MqttStatsResponse, MqttProvisionRequest, MqttProvisionResponse,
    SupportedCommand, DeviceCommandsResponse,
)

# 从 auth 模块导入认证依赖
from api.routes.auth import get_current_user
from database.db_models.meta_model import User
from database.db_models.user_models import Device
from database.user_db_manager import UserDatabaseManager
from database.db_services.device_service import count_devices_online_status

logger = logging.getLogger("MQTT.Routes")

router = APIRouter(prefix="/mqtt", tags=["mqtt"])


# ============================================================
# 系统状态
# ============================================================

@router.get("/health")
async def mqtt_health():
    """MQTT 服务健康检查"""
    mqtt_client = get_mqtt_client()
    return {
        "status": "ok" if (mqtt_client and mqtt_client.connected) else "disconnected",
        "service": "green-tracker-mqtt-cloud",
        "mqtt_connected": mqtt_client.connected if mqtt_client else False,
        "broker": f"{BROKER_HOST}:{BROKER_PORT}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _count_user_device_status(user: User) -> Optional[tuple]:
    """
    统计当前用户的设备总数与在线数

    口径与设备列表页一致：以用户数据库中的活跃设备为分母，
    从未通过 MQTT 上线过的设备同样计入离线，因此满足
    `在线 + 离线 == 设备总数`。

    在线判定复用 get_device_online_status（MQTT 实时状态优先，其次 DB 心跳），
    与设备卡片上显示的在线状态保持同源，避免出现两处数字打架。

    Returns:
        (设备总数, 在线数, 设备ID列表)；
        数据库不可用时返回 None，由调用方降级
    """
    db = None
    try:
        db_manager = UserDatabaseManager()
        db = db_manager.get_db(str(user.userid))
        return count_devices_online_status(db)
    except Exception as e:
        logger.warning(f"统计用户设备状态失败，降级为 MQTT 侧统计: {e}")
        return None
    finally:
        if db:
            try:
                db.close()
            except Exception:
                pass


@router.get("/stats", response_model=MqttStatsResponse)
async def mqtt_stats(current_user: User = Depends(get_current_user)):
    """
    MQTT 系统统计信息（按当前用户的设备统计）

    分母为用户数据库中的活跃设备，在线数只统计属于该用户的设备，
    因此 `online_devices + offline_devices == total_devices`，
    与设备列表页展示的设备数量一致。
    """
    dm = get_device_manager()
    mqtt_client = get_mqtt_client()

    counted = _count_user_device_status(current_user)
    if counted is not None:
        total_devices, online_devices, device_ids = counted
    else:
        # 用户库不可用时降级：退回 MQTT 侧（全局）统计
        all_devices = dm.get_all_devices()
        total_devices = len(all_devices)
        online_devices = dm.get_online_count()
        device_ids = [d["device_id"] for d in all_devices]

    return MqttStatsResponse(
        total_devices=total_devices,
        online_devices=online_devices,
        offline_devices=total_devices - online_devices,
        pending_commands=dm.get_pending_count(),
        mqtt_broker=f"{BROKER_HOST}:{BROKER_PORT}",
        mqtt_connected=mqtt_client.connected if mqtt_client else False,
        registered_device_ids=device_ids,
    )


# ============================================================
# 设备状态查询
# ============================================================

@router.get("/devices")
async def list_mqtt_devices(
    status: Optional[str] = Query(None, description="过滤状态: online/offline"),
    current_user: User = Depends(get_current_user),
):
    """
    获取所有通过 MQTT 连接的设备状态列表
    """
    dm = get_device_manager()
    devices = dm.get_all_devices()

    if status in ("online", "offline"):
        devices = [d for d in devices if d["status"] == status]

    # 从用户数据库批量查询设备名称
    device_ids = [d["device_id"] for d in devices]
    name_map: dict = {}
    if device_ids:
        try:
            db_manager = UserDatabaseManager()
            session = db_manager.get_db(str(current_user.userid))
            try:
                db_devices = session.query(Device).filter(Device.id.in_(device_ids)).all()
                name_map = {str(d.id): d.name for d in db_devices}
            finally:
                session.close()
        except Exception:
            pass  # DB 不可用时静默降级

    return {
        "total": len(devices),
        "online_count": dm.get_online_count(),
        "devices": [
            {**DeviceMqttStatus(**d).model_dump(), "name": name_map.get(d["device_id"])}
            for d in devices
        ],
    }


@router.get("/devices/{device_id}")
async def get_mqtt_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
):
    """获取指定设备的 MQTT 状态详情"""
    dm = get_device_manager()
    device = dm.get_device(device_id)

    if not device:
        raise HTTPException(status_code=404, detail=f"设备不在线或未注册: {device_id}")

    result = DeviceMqttDetail(**device).model_dump()

    # 从用户数据库查询设备名称
    try:
        db_manager = UserDatabaseManager()
        session = db_manager.get_db(str(current_user.userid))
        try:
            db_device = session.query(Device).filter(Device.id == device_id).first()
            if db_device:
                result["name"] = db_device.name
        finally:
            session.close()
    except Exception:
        pass

    return result


# ============================================================
# 命令下发
# ============================================================

def _persist_mqtt_command(
    user_id: str,
    device_id: str,
    command: str,
    command_id: str,
    params: Optional[dict] = None
) -> None:
    """
    MQTT 下发的指令必须落库

    设备执行成功后会按 command_id 调用
    POST /api/device-commands/{command_id}/result 回执；
    库里没有对应记录时该接口返回 404，表现为「执行成功但回执失败」。
    """
    try:
        from database.db_services.device_command_service import create_command

        user_db = get_user_db(user_id)
        try:
            device_name = None
            device_row = user_db.query(Device).filter(Device.id == device_id).first()
            if device_row:
                device_name = device_row.name

            create_command(
                user_db,
                command_id=command_id,
                device_id=device_id,
                device_name=device_name,
                command=command,
                params=params,
                status="sent",
                transport="mqtt",
                issued_by=user_id,
                sent_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(seconds=300)
            )
        finally:
            user_db.close()
    except Exception as e:
        # 落库失败不阻断下发，但会导致设备回执 404，必须显式告警
        logger.error(f"MQTT 指令落库失败，设备回执将返回404: {command_id}, {e}")


@router.post("/devices/{device_id}/commands")
async def send_device_command(
    device_id: str,
    cmd: CommandRequest,
    current_user: User = Depends(get_current_user),
    meta_db: Session = Depends(get_meta_db),
):
    """
    向指定设备下发命令

    授权：控制台走 JWT，但仍按「设备上报的密钥」判定——
    该设备上报的密钥若没有 device_control，登录用户同样不能操控它。

    支持的命令（由设备端动态声明，以下为当前版本清单）:
    - ping:          心跳检测
    - get_info:      获取设备基本信息
    - get_metrics:   获取运行指标 (CPU/内存/温度)
    - reboot:        重启设备 (参数: delay, 默认5秒)
    - set_config:    写配置项 (参数: key, value)
    - list_commands: 获取命令列表（内部使用）
    """
    # 设备级控制授权（早于连通性检查）：设备上报的密钥无 device_control 时不得下发
    user_db = get_user_db(str(current_user.userid))
    try:
        assert_device_control_granted(user_db, meta_db, device_id)
    finally:
        user_db.close()

    mqtt_client = get_mqtt_client()
    if not mqtt_client or not mqtt_client.connected:
        raise HTTPException(status_code=503, detail="MQTT 服务未连接")

    dm = get_device_manager()
    if not dm.is_online(device_id):
        raise HTTPException(
            status_code=400,
            detail=f"设备不在线: {device_id}。请确保设备已通过 MQTT 连接到 Broker",
        )

    command_id = mqtt_client.send_command(device_id, cmd.command, cmd.params)
    if not command_id:
        raise HTTPException(status_code=500, detail=f"命令发送失败: {device_id}")

    # 落库：设备执行成功后要按 command_id 回执，库里没有记录会回执 404
    _persist_mqtt_command(
        user_id=str(current_user.userid),
        device_id=device_id,
        command=cmd.command,
        params=cmd.params,
        command_id=command_id
    )

    # 记录命令到追踪器
    dm.add_pending_command(
        command_id=command_id,
        device_id=device_id,
        command=cmd.command,
        payload={
            "command_id": command_id,
            "command": cmd.command,
            "params": cmd.params,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "green-tracker-cloud",
        },
    )

    return CommandResponse(
        message="命令已发送",
        command_id=command_id,
        device_id=device_id,
        command=cmd.command,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# 命令定义表已抽取到 mqtt/command_defs.py，与设备控制接口（/api/device-commands）共用
_COMMAND_DEFS: dict[str, dict] = COMMAND_DEFS

# 命令列表缓存（避免每次打开控制台都下发 list_commands）
_command_cache: dict[str, tuple[list, float]] = {}  # device_id -> ([commands], expiry_timestamp)
_CACHE_TTL = 120  # 缓存有效期 2 分钟


@router.get("/devices/{device_id}/commands", response_model=DeviceCommandsResponse)
async def get_device_commands(
    device_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    获取指定设备支持的可执行指令列表

    流程:
    1. 检查缓存（2分钟有效期）
    2. 向设备下发 list_commands 命令，等待响应（最多5秒）
    3. 若成功，从响应中解析命令列表并缓存
    4. 若失败/超时/设备离线，回退到 _COMMAND_DEFS 中的非 hidden 指令
    """
    dm = get_device_manager()

    # ── 1. 缓存命中则直接返回 ──
    cached = _command_cache.get(device_id)
    if cached:
        cmds, expiry = cached
        if time.time() < expiry:
            logger.debug(f"命令列表缓存命中: {device_id}")
            return DeviceCommandsResponse(
                device_id=device_id,
                commands=[SupportedCommand(**c) for c in cmds],
            )

    # ── 2. 检查设备在线 ──
    if not dm.is_online(device_id):
        logger.info(f"设备离线，返回默认命令列表: {device_id}")
        commands = _build_default_commands()
        return DeviceCommandsResponse(
            device_id=device_id,
            commands=_to_supported(commands),
        )

    # ── 3. 向设备下发 list_commands ──
    mqtt_client = get_mqtt_client()
    if not mqtt_client or not mqtt_client.connected:
        logger.warning("MQTT 未连接，返回默认命令列表")
        commands = _build_default_commands()
        return DeviceCommandsResponse(
            device_id=device_id,
            commands=_to_supported(commands),
        )

    command_id = mqtt_client.send_command(device_id, "list_commands")
    if not command_id:
        logger.warning(f"list_commands 发送失败: {device_id}")
        commands = _build_default_commands()
        return DeviceCommandsResponse(
            device_id=device_id,
            commands=_to_supported(commands),
        )

    # 同样落库：设备若对它做 HTTP 回执，否则会 404
    _persist_mqtt_command(
        user_id=str(current_user.userid),
        device_id=device_id,
        command="list_commands",
        command_id=command_id
    )

    dm.add_pending_command(
        command_id=command_id,
        device_id=device_id,
        command="list_commands",
        payload={
            "command_id": command_id,
            "command": "list_commands",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "green-tracker-cloud",
        },
    )

    # ── 4. 轮询等待设备响应（最多 5 秒）──
    for _ in range(50):
        await asyncio.sleep(0.1)
        cmd_state = dm.get_command(command_id)
        if cmd_state and cmd_state.get("acknowledged"):
            response = cmd_state.get("response") or {}
            result = response.get("result") or {}
            raw_commands = result.get("commands", [])

            if raw_commands and isinstance(raw_commands, list):
                mapped = _map_commands(raw_commands)
                if mapped:
                    _command_cache[device_id] = (mapped, time.time() + _CACHE_TTL)
                    logger.info(f"✅ 从设备获取命令列表成功: {device_id} -> {len(mapped)} 条")
                    return DeviceCommandsResponse(
                        device_id=device_id,
                        commands=_to_supported(mapped),
                    )
                logger.warning(f"设备返回的指令列表无法识别，回退默认: {device_id} -> {raw_commands}")

    # ── 5. 超时或设备未返回有效列表，回退默认 ──
    logger.warning(f"list_commands 超时或无响应: {device_id}，回退默认列表")
    commands = _build_default_commands()
    return DeviceCommandsResponse(
        device_id=device_id,
        commands=_to_supported(commands),
    )


def _build_default_commands() -> list[dict]:
    """构建默认命令列表（排除 hidden 指令如 list_commands）

    必须带 id 字段：SupportedCommand.id 为必填，
    早期实现直接取 _COMMAND_DEFS.values() 会缺 id，导致回退路径必然 500。
    """
    return [dict(item) for item in list_command_definitions()]


def _to_supported(commands: list[dict]) -> list[SupportedCommand]:
    """
    安全构造响应模型

    任何缺少 id 或字段非法的条目一律跳过并记录告警，
    避免单条脏数据让整个接口 500（指令面板直接不可用）。
    """
    items: list[SupportedCommand] = []
    for command in commands or []:
        if not isinstance(command, dict) or not command.get("id"):
            logger.warning(f"指令定义缺少 id，已跳过: {command!r}")
            continue
        try:
            items.append(SupportedCommand(**command))
        except Exception as e:
            logger.warning(f"指令定义非法，已跳过: {command!r}, {e}")
    return items


def _map_commands(raw_commands: list) -> list[dict]:
    """
    将设备返回的命令映射为完整展示格式

    兼容设备侧两种返回：
    - 字符串 ID 列表：["ping", "get_info"]
    - 对象列表：{"id"/"command"/"name": "ping", "label": ...}

    无法识别的条目跳过并告警，不抛异常。
    """
    result = []
    for item in raw_commands:
        if isinstance(item, str):
            cmd_id, device_info = item, {}
        elif isinstance(item, dict):
            cmd_id = item.get("id") or item.get("command") or item.get("name")
            device_info = item
        else:
            logger.warning(f"设备返回的指令条目格式无法识别，已跳过: {item!r}")
            continue

        if not cmd_id:
            logger.warning(f"设备返回的指令条目缺少 id/command 字段，已跳过: {item!r}")
            continue

        cmd_id = str(cmd_id)
        info = _COMMAND_DEFS.get(cmd_id)

        if info:
            if info.get("hidden"):
                continue
            merged = {"id": cmd_id, **info}
        else:
            # 云端未知指令：优先采用设备自带的展示信息
            merged = {
                "id": cmd_id,
                "label": device_info.get("label") or cmd_id,
                "description": device_info.get("description", ""),
                "icon": device_info.get("icon", "terminal"),
                "require_confirm": bool(device_info.get("require_confirm", False)),
            }
            if device_info.get("params_schema"):
                merged["params_schema"] = device_info["params_schema"]

        result.append(merged)
    return result


@router.get("/commands/{command_id}")
async def get_command_result(
    command_id: str,
    current_user: User = Depends(get_current_user),
):
    """查询命令执行结果"""
    dm = get_device_manager()
    cmd = dm.get_command(command_id)

    if not cmd:
        raise HTTPException(status_code=404, detail=f"命令不存在: {command_id}")

    return CommandResult(**cmd).model_dump()


# ============================================================
# 设备 MQTT 凭证管理
# ============================================================

@router.post("/devices/{device_id}/provision")
async def provision_device(
    device_id: str,
    body: Optional[MqttProvisionRequest] = None,
    current_user: User = Depends(get_current_user),
):
    """
    为设备配置 MQTT 连接凭证

    设备需要这些凭证才能通过 MQTT 协议连接到 Broker：
    - mqtt_username: 设备ID（UUID）
    - mqtt_secret: MQTT 连接密钥

    物理设备需要在代码中配置：
    - DEVICE_ID={mqtt_username}
    - DEVICE_SECRET={mqtt_secret}
    - BROKER_HOST={MQTT Broker 地址}
    """
    try:
        secret = body.mqtt_secret if body else None
        regen = body.regenerate if body else False
        result = provision_device_mqtt(
            device_id=device_id,
            user_id=str(current_user.userid),
            mqtt_secret=secret,
            regenerate=regen,
        )
        result["mqtt_broker_host"] = BROKER_HOST
        result["mqtt_broker_port"] = BROKER_PORT
        return MqttProvisionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"设备凭证配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"凭证配置失败: {str(e)}")


@router.get("/devices/{device_id}/credentials")
async def get_device_credentials(
    device_id: str,
    current_user: User = Depends(get_current_user),
):
    """获取设备的 MQTT 连接凭证"""
    from .service import get_mqtt_credentials_for_device

    creds = get_mqtt_credentials_for_device(
        device_id=device_id,
        user_id=str(current_user.userid),
    )

    if not creds:
        raise HTTPException(status_code=404, detail=f"设备不存在或无 MQTT 凭证: {device_id}")

    creds["mqtt_broker_host"] = BROKER_HOST
    creds["mqtt_broker_port"] = BROKER_PORT
    return creds
