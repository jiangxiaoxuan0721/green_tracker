"""
设备控制路由

权限：device_control（云端 → 设备）

调用约定与数据上传接口保持一致：
- 云端/第三方系统：Authorization: Bearer <jwt>  或  X-API-Key: <key>（密钥须持有 device_control 权限）
- 设备侧：同一把密钥 + X-Device-Id: <device_id>

授权口径：密钥与设备不绑定，一把密钥可作用于该用户名下的任意设备，
鉴权只看密钥是否持有 device_control；设备归属由「设备属于密钥所属用户」保证。

接口：
- GET    /api/device-commands/catalog                          支持的指令清单
- POST   /api/device-commands/heartbeat                        设备上报所用密钥（注册/心跳·能力协商）
- GET    /api/device-commands/devices/{device_id}/grant        查询该设备的远程控制授权状态
- GET    /api/device-commands/pending                          设备拉取待执行指令（设备侧）
- POST   /api/device-commands/{command_id}/result              设备上报执行结果（设备侧）
- POST   /api/device-commands                                  下发指令（云端）
- GET    /api/device-commands                                  指令列表（云端）
- POST   /api/device-commands/{command_id}/cancel              取消指令（云端）
- GET    /api/device-commands/{command_id}                     指令详情（云端）
"""

import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session

from ..routes.auth import (
    AuthPrincipal,
    AUTH_METHOD_API_KEY,
    require_device_control,
    require_authenticated
)
from database.db_models.user_models import Device
from database.main_db import get_meta_db
from utils.permissions import (
    PERMISSION_DATA_UPLOAD,
    PERMISSION_DATA_READ,
    PERMISSION_DEVICE_CONTROL
)
from api.dependencies import assert_device_control_granted, get_bound_key_state
from database.db_services.device_key_binding_service import record_binding
from database.db_services.device_command_service import (
    create_command,
    get_command,
    list_commands,
    get_pending_commands,
    mark_delivered,
    mark_result,
    cancel_command
)
from database.db_services.log_service import create_log
from ..schemas.device_command import (
    DeviceCommandCreateRequest,
    DeviceCommandResultRequest,
    DeviceCommandResponse,
    DeviceCommandListResponse,
    DeviceCommandDefinition,
    DeviceCapabilities,
    DeviceHeartbeatResponse,
    DeviceControlGrant
)
from mqtt.command_defs import list_command_definitions

router = APIRouter(prefix="/device-commands", tags=["设备控制"])


def _generate_command_id() -> str:
    """生成指令唯一标识（与 MQTT 下发保持一致的格式）"""
    return f"cmd_{int(time.time() * 1000)}_{secrets.token_hex(3)}"


def _resolve_device_id(
    principal: AuthPrincipal,
    device_id: Optional[str] = None,
    *,
    required: bool = True
) -> Optional[str]:
    """
    解析本次操作的目标设备

    密钥不与设备绑定：只要密钥持有 device_control，即可作用于该用户名下的任意设备，
    设备归属由路由层查库确认（设备属于 principal.user）。
    """
    if not device_id:
        if required:
            raise HTTPException(
                status_code=400,
                detail="请通过 X-Device-Id 请求头或 device_id 参数指定设备"
            )
        return None
    return device_id


def _touch_device(
    db: Session,
    device_id: str,
    principal: Optional[AuthPrincipal] = None,
    source: str = "report"
) -> bool:
    """
    设备来访时刷新心跳时间

    若调用方是 API 密钥，同时刷新「设备 → 密钥」软关联（设备上报制），
    使云端知道这台设备当前用的是哪把密钥，用于控制授权判定。

    Returns:
        bool: 是否成功记录了「设备 → 密钥」关联
    """
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if device:
            device.last_seen_at = datetime.utcnow()
            db.commit()
    except Exception:
        db.rollback()

    if principal is None or principal.auth_method != AUTH_METHOD_API_KEY:
        return False
    if not principal.api_key_id:
        return False

    return record_binding(
        db,
        device_id=device_id,
        api_key_id=principal.api_key_id,
        api_key_name=principal.api_key_name,
        source=source
    )


@router.get("/catalog", summary="获取支持的设备指令清单", response_model=list[DeviceCommandDefinition])
async def get_command_catalog(principal: AuthPrincipal = Depends(require_device_control)):
    """返回云端支持的指令清单（id/名称/说明/参数结构）"""
    return [DeviceCommandDefinition(**item) for item in list_command_definitions()]


# HTTP 轮询通道的建议间隔（MQTT 在线时不需要轮询）
DEFAULT_POLL_INTERVAL_SECONDS = 5


@router.post("/heartbeat", summary="设备上报所使用的API密钥（注册/心跳·能力协商）")
async def device_heartbeat(
    principal: AuthPrincipal = Depends(require_authenticated),
    x_device_id: str = Header(None, alias="X-Device-Id", description="设备ID（必填）"),
    device_id: str = Query(None, description="设备ID，与 X-Device-Id 等价")
):
    """
    设备用自己持有的密钥上报一次，云端据此建立「设备 → 密钥」软关联，
    并把权限翻译成能力开关回给设备

    - 认证：任意有效密钥（X-API-Key）或 JWT；不要求 device_control，
      否则未授权的设备永远无法完成上报
    - 上报后云端才知道该设备用的是哪把密钥，进而判定它能否被远程控制
    - 设备只持有密钥拷贝、读不懂权限，因此响应里直接给出 capabilities，
      设备按开关行事即可，无需判断权限含义
    """
    target_device_id = _resolve_device_id(principal, x_device_id or device_id)

    db = principal.open_user_db()
    try:
        # 写入「设备 → 密钥」关联；写入失败时不能静默成功，否则控制台永远显示未上报
        bound = _touch_device(db, target_device_id, principal, source="heartbeat")

        permissions = principal.permissions
        receive_commands = PERMISSION_DEVICE_CONTROL in permissions

        command_channel = None
        poll_interval = None
        if receive_commands:
            # 在线走 MQTT 实时通道；离线退化为 HTTP 轮询
            try:
                from mqtt.device_manager import get_device_manager
                command_channel = "mqtt" if get_device_manager().is_online(target_device_id) else "http"
            except Exception as e:
                print(f"[DeviceCommand] 设备在线状态查询失败，回退为http轮询: {e}")
                command_channel = "http"
            if command_channel == "http":
                poll_interval = DEFAULT_POLL_INTERVAL_SECONDS

        data = DeviceHeartbeatResponse(
            device_id=target_device_id,
            registered=bound,
            capabilities=DeviceCapabilities(
                upload_data=PERMISSION_DATA_UPLOAD in permissions,
                # 从云端读取/导出已上传的数据到本地，受 data_read 约束
                read_data=PERMISSION_DATA_READ in permissions,
                # 拉取云端下发的采集任务是设备作业通道的默认能力，不占用 data_read
                pull_tasks=True,
                receive_commands=receive_commands
            ),
            command_channel=command_channel,
            poll_interval_seconds=poll_interval,
            server_time=datetime.now(timezone.utc)
        )

        message = "success"
        if principal.auth_method == AUTH_METHOD_API_KEY and not bound:
            message = (
                "密钥关联写入失败，远程控制授权仍无法判定；"
                "请检查该用户库是否缺少 device_key_bindings 表"
            )

        return {
            "code": 200,
            "message": message,
            "data": data.model_dump(mode="json")
        }
    finally:
        db.close()


@router.get("/devices/{device_id}/grant", summary="查询设备的远程控制授权状态", response_model=DeviceControlGrant)
async def get_device_control_grant(
    device_id: str,
    principal: AuthPrincipal = Depends(require_authenticated),
    meta_db: Session = Depends(get_meta_db)
):
    """
    控制台据此决定该设备是否开放远程控制

    判定依据是「设备上报的密钥是否含 device_control」，与调用者身份无关，
    因此界面结论与下发接口的 403 完全一致。
    """
    db = principal.open_user_db()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="设备不存在")

        state = get_bound_key_state(db, meta_db, device_id)
        return DeviceControlGrant(
            device_id=device_id,
            device_name=device.name,
            bound=state["bound"],
            control_granted=state["control_granted"],
            reason=state["reason"],
            api_key_id=state["api_key_id"],
            api_key_name=state["api_key_name"],
            permissions=state["permissions"],
            is_active=state["is_active"],
            is_expired=state["is_expired"],
            expires_at=state["expires_at"],
            last_reported_at=state["last_reported_at"]
        )
    finally:
        db.close()


@router.get("/pending", summary="设备拉取待执行指令", response_model=list[DeviceCommandResponse])
async def pull_pending_commands(
    principal: AuthPrincipal = Depends(require_device_control),
    x_device_id: str = Header(None, alias="X-Device-Id", description="设备ID（设备侧调用必填）"),
    device_id: str = Query(None, description="设备ID，与 X-Device-Id 等价"),
    limit: int = Query(20, ge=1, le=100, description="单次最多拉取的指令数")
):
    """
    设备侧拉取指令

    认证：X-API-Key（须持有 device_control 权限）+ X-Device-Id（目标设备）
    返回 pending/sent 状态且未过期的指令；被拉取的指令（含已推送到 Broker 但设备
    可能未收到的 sent）统一标记为 delivered，不会在后续轮询中重复返回。
    适用于设备未连接 MQTT、只能走 HTTP 轮询的场景。
    """
    target_device_id = _resolve_device_id(principal, x_device_id or device_id)

    db = principal.open_user_db()
    try:
        _touch_device(db, target_device_id, principal, source="pending")
        commands = get_pending_commands(db, target_device_id, limit=limit)

        # 拉取即视为已投递：pending / sent 都会推进为 delivered，避免同一条指令被反复返回
        for command in commands:
            mark_delivered(db, command["command_id"])

        return [DeviceCommandResponse(**command) for command in commands]
    finally:
        db.close()


@router.post("/{command_id}/result", summary="设备上报指令执行结果")
async def report_command_result(
    command_id: str,
    request: DeviceCommandResultRequest,
    principal: AuthPrincipal = Depends(require_device_control),
    meta_db: Session = Depends(get_meta_db),
    x_device_id: str = Header(None, alias="X-Device-Id", description="设备ID（设备侧调用必填）"),
    device_id: str = Query(None, description="设备ID，与 X-Device-Id 等价")
):
    """
    设备侧回执

    status 取 acked（执行成功）或 failed（执行失败）。

    归属校验（仅 API 密钥调用方）：声明的 X-Device-Id 必须与指令的目标设备一致，
    且该设备当前上报的密钥就是本次调用的密钥，否则返回 403。
    两步都过了才允许回执，避免持 device_control 的密钥伪造其它设备的执行结果。

    JWT 调用方是账号所有者，不做归属校验。
    """
    if request.status not in ("acked", "failed"):
        raise HTTPException(status_code=400, detail="status 仅支持 acked 或 failed")

    db = principal.open_user_db()
    try:
        command = get_command(db, command_id)
        if not command:
            raise HTTPException(status_code=404, detail="指令不存在")

        # 先校验再写关联：否则越权调用方会先把自己的密钥绑定上去，等于自我授权
        if principal.auth_method == AUTH_METHOD_API_KEY:
            caller_device_id = x_device_id or device_id
            if not caller_device_id:
                raise HTTPException(
                    status_code=400,
                    detail="设备回执请通过 X-Device-Id 请求头或 device_id 参数声明设备身份"
                )
            if caller_device_id != command["device_id"]:
                raise HTTPException(
                    status_code=403,
                    detail="该指令不属于当前设备，只能回执下发给自己的指令"
                )

            bound_state = get_bound_key_state(db, meta_db, command["device_id"])
            if not bound_state.get("api_key_id") or \
                    str(bound_state["api_key_id"]) != str(principal.api_key_id):
                raise HTTPException(
                    status_code=403,
                    detail="该设备当前上报的密钥不是本次调用的密钥，请先用该密钥重新签到"
                )

        _touch_device(db, command["device_id"], principal, source="result")

        updated = mark_result(
            db,
            command_id,
            status=request.status,
            result=request.result,
            error_message=request.error_message
        )
        if not updated:
            raise HTTPException(status_code=500, detail="记录指令结果失败")

        try:
            create_log(
                db, "info" if request.status == "acked" else "warning",
                "device.command_result",
                f"设备 {command['device_name'] or command['device_id']} 回执指令 {command['command']}: {request.status}",
                related_id=command_id, related_type="device_command"
            )
        except Exception:
            pass

        return {"code": 200, "message": "success", "data": updated}
    finally:
        db.close()


@router.post("/", summary="下发设备控制指令")
async def issue_device_command(
    request: DeviceCommandCreateRequest,
    principal: AuthPrincipal = Depends(require_device_control),
    meta_db: Session = Depends(get_meta_db)
):
    """
    云端向设备下发控制指令

    - API 密钥调用：密钥须持有 device_control（由依赖校验）
    - JWT 调用：账号全权，但仍受设备级授权约束——
      设备上报的密钥若无 device_control，云端同样不得下发
    - 密钥不与设备绑定，可作用于多台设备；控制能力由「该设备上报的密钥」决定
    - 投递通道优先 MQTT；MQTT 不可用时指令落为 pending，由设备通过 GET /pending 轮询拉取
    """
    db = principal.open_user_db()
    try:
        device = db.query(Device).filter(Device.id == request.device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="设备不存在")

        # 设备级控制授权：以该设备上报的密钥权限为准
        assert_device_control_granted(db, meta_db, device.id, device.name)

        if not device.is_active:
            raise HTTPException(status_code=400, detail="设备已停用，无法下发指令")

        # 优先通过 MQTT 投递
        command_id = None
        transport = None
        status = "pending"
        sent_at = None

        try:
            from mqtt.mqtt_client import get_mqtt_client
            from mqtt.device_manager import get_device_manager

            mqtt_client = get_mqtt_client()
            if mqtt_client and getattr(mqtt_client, "connected", False):
                command_id = mqtt_client.send_command(
                    device.id, request.command, request.params
                )
                if command_id:
                    transport = "mqtt"
                    status = "sent"
                    sent_at = datetime.utcnow()

                    # 同步到内存追踪器，保证 MQTT 控制台也能查到该指令
                    device_manager = get_device_manager()
                    if device_manager:
                        device_manager.add_pending_command(
                            command_id=command_id,
                            device_id=device.id,
                            command=request.command,
                            payload={
                                "command_id": command_id,
                                "command": request.command,
                                "params": request.params or {},
                                "timestamp": datetime.utcnow().isoformat(),
                                "source": "green-tracker-cloud"
                            }
                        )
        except Exception as e:  # MQTT 异常不影响指令落库，降级为 HTTP 轮询
            print(f"[设备控制] MQTT 投递失败，降级为轮询模式: {e}")

        if not command_id:
            command_id = _generate_command_id()

        expires_at = datetime.utcnow() + timedelta(seconds=request.timeout_seconds or 300)

        command = create_command(
            db,
            command_id=command_id,
            device_id=device.id,
            device_name=device.name,
            command=request.command,
            params=request.params,
            status=status,
            transport=transport,
            api_key_id=principal.api_key_id,
            issued_by=principal.user_id,
            expires_at=expires_at,
            sent_at=sent_at
        )

        if not command:
            raise HTTPException(status_code=500, detail="指令创建失败")

        try:
            create_log(
                db, "warning" if request.command == "reboot" else "info",
                "device.command",
                f"{principal.describe()} 向设备 {device.name} 下发指令: {request.command}",
                related_id=command_id, related_type="device_command"
            )
        except Exception:
            pass

        return {"code": 200, "message": "success", "data": command}
    finally:
        db.close()


@router.get("/", summary="查询设备指令列表", response_model=DeviceCommandListResponse)
async def get_command_list(
    principal: AuthPrincipal = Depends(require_device_control),
    device_id: str = Query(None, description="按设备过滤"),
    status: str = Query(None, description="按状态过滤：pending/sent/delivered/acked/failed/cancelled/expired"),
    command: str = Query(None, description="按指令名称过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """分页查询指令下发历史与执行结果（范围固定为该用户名下的数据）"""
    target_device_id = _resolve_device_id(principal, device_id, required=False)

    db = principal.open_user_db()
    try:
        result = list_commands(
            db,
            device_id=target_device_id,
            status=status,
            command=command,
            page=page,
            page_size=page_size
        )
        return DeviceCommandListResponse(
            items=[DeviceCommandResponse(**item) for item in result["items"]],
            pagination=result["pagination"]
        )
    finally:
        db.close()


@router.post("/{command_id}/cancel", summary="取消设备指令")
async def cancel_device_command(
    command_id: str,
    principal: AuthPrincipal = Depends(require_device_control)
):
    """取消一条尚未完成的指令（已处于终态的指令不会被修改）"""
    db = principal.open_user_db()
    try:
        command = get_command(db, command_id)
        if not command:
            raise HTTPException(status_code=404, detail="指令不存在")

        updated = cancel_command(db, command_id)
        if not updated:
            raise HTTPException(status_code=500, detail="取消指令失败")

        return {"code": 200, "message": "success", "data": updated}
    finally:
        db.close()


@router.get("/{command_id}", summary="查询指令详情", response_model=DeviceCommandResponse)
async def get_command_detail(
    command_id: str,
    principal: AuthPrincipal = Depends(require_device_control)
):
    """查询单条指令的状态与执行结果"""
    db = principal.open_user_db()
    try:
        command = get_command(db, command_id)
        if not command:
            raise HTTPException(status_code=404, detail="指令不存在")

        return DeviceCommandResponse(**command)
    finally:
        db.close()
