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
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query

from .mqtt_client import get_mqtt_client, BROKER_HOST, BROKER_PORT
from .device_manager import get_device_manager
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


@router.get("/stats", response_model=MqttStatsResponse)
async def mqtt_stats(current_user: User = Depends(get_current_user)):
    """MQTT 系统统计信息"""
    dm = get_device_manager()
    mqtt_client = get_mqtt_client()

    all_devices = dm.get_all_devices()
    online_count = dm.get_online_count()

    return MqttStatsResponse(
        total_devices=len(all_devices),
        online_devices=online_count,
        offline_devices=len(all_devices) - online_count,
        pending_commands=dm.get_pending_count(),
        mqtt_broker=f"{BROKER_HOST}:{BROKER_PORT}",
        mqtt_connected=mqtt_client.connected if mqtt_client else False,
        registered_device_ids=[d["device_id"] for d in all_devices],
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

@router.post("/devices/{device_id}/commands")
async def send_device_command(
    device_id: str,
    cmd: CommandRequest,
    current_user: User = Depends(get_current_user),
):
    """
    向指定设备下发命令

    支持的命令（由设备端动态声明，以下为当前版本清单）:
    - ping:          心跳检测
    - get_info:      获取设备基本信息
    - get_metrics:   获取运行指标 (CPU/内存/温度)
    - reboot:        重启设备 (参数: delay, 默认5秒)
    - set_config:    写配置项 (参数: key, value)
    - list_commands: 获取命令列表（内部使用）
    """
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


# ── 命令定义表：云端维护每个命令 ID 的显示信息 ──
# 当设备返回命令名时，在此表中查找 label/icon/require_confirm
# 设备客户端只需返回命令 ID 列表，无需关心展示细节
_COMMAND_DEFS: dict[str, dict] = {
    "ping":          {"label": "心跳检测",   "description": "立即检测设备是否响应",                 "icon": "zap",       "require_confirm": False},
    "get_info":      {"label": "获取设备信息", "description": "获取设备基本信息、平台、主机名等",    "icon": "info",      "require_confirm": False},
    "get_metrics":   {"label": "运行指标",   "description": "获取 CPU/内存/温度等运行指标",        "icon": "sliders",   "require_confirm": False},
    "reboot":        {"label": "重启设备",   "description": "向设备发送重启指令",                  "icon": "rotate-cw", "require_confirm": True,  "params_schema": {"delay": "number"}},
    "set_config":    {"label": "写配置项",   "description": "写入设备配置项（key/value）",          "icon": "settings",  "require_confirm": False, "params_schema": {"key": "string", "value": "string"}},
    "list_commands": {"label": "获取命令列表", "description": "获取设备支持的全部命令",             "icon": "list",      "require_confirm": False, "hidden": True},
}

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
            commands=[SupportedCommand(**c) for c in commands],
        )

    # ── 3. 向设备下发 list_commands ──
    mqtt_client = get_mqtt_client()
    if not mqtt_client or not mqtt_client.connected:
        logger.warning("MQTT 未连接，返回默认命令列表")
        commands = _build_default_commands()
        return DeviceCommandsResponse(
            device_id=device_id,
            commands=[SupportedCommand(**c) for c in commands],
        )

    command_id = mqtt_client.send_command(device_id, "list_commands")
    if not command_id:
        logger.warning(f"list_commands 发送失败: {device_id}")
        commands = _build_default_commands()
        return DeviceCommandsResponse(
            device_id=device_id,
            commands=[SupportedCommand(**c) for c in commands],
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
                commands = _map_commands(raw_commands)
                _command_cache[device_id] = (commands, time.time() + _CACHE_TTL)
                logger.info(f"✅ 从设备获取命令列表成功: {device_id} -> {raw_commands}")
                return DeviceCommandsResponse(
                    device_id=device_id,
                    commands=[SupportedCommand(**c) for c in commands],
                )

    # ── 5. 超时或设备未返回有效列表，回退默认 ──
    logger.warning(f"list_commands 超时或无响应: {device_id}，回退默认列表")
    commands = _build_default_commands()
    return DeviceCommandsResponse(
        device_id=device_id,
        commands=[SupportedCommand(**c) for c in commands],
    )


def _build_default_commands() -> list[dict]:
    """构建默认命令列表（排除 hidden 指令如 list_commands）"""
    return [
        v for v in _COMMAND_DEFS.values()
        if not v.get("hidden")
    ]


def _map_commands(raw_ids: list[str]) -> list[dict]:
    """将设备返回的命令 ID 列表映射为完整格式"""
    result = []
    for cmd_id in raw_ids:
        if cmd_id in _COMMAND_DEFS:
            info = _COMMAND_DEFS[cmd_id]
            if not info.get("hidden"):
                result.append({"id": cmd_id, **info})
        else:
            # 未知命令，使用默认展示信息
            result.append({
                "id": cmd_id,
                "label": cmd_id,
                "description": "",
                "icon": "terminal",
                "require_confirm": False,
            })
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
