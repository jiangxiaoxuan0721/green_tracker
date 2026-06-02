from fastapi import APIRouter, Depends, Header, HTTPException, status, Query
from database.user_db_manager import get_user_db
from database.db_models.meta_model import User
from database.db_services.device_service import (
    create_device, get_device_by_id,
    search_devices, update_device, delete_device,
    get_device_online_status, provision_device, deprovision_device,
    is_device_provisioned, remove_device_from_mosquitto_passwd,
    record_device_heartbeat,
)
from api.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceProvisionResponse,
)
from typing import List, Optional

# 从auth模块导入get_current_user函数
from api.routes.auth import get_current_user

router = APIRouter(prefix="/devices", tags=["devices"])


def _enrich_device_response(device) -> DeviceResponse:
    """
    将设备对象转换为响应格式，并注入在线状态和绑定状态
    """
    status_info = get_device_online_status(device)
    data = DeviceResponse.model_validate(device).model_dump()
    data["online"] = status_info["online"]
    data["last_seen_at"] = status_info["last_seen_at"]
    data["provisioned"] = is_device_provisioned(device)
    return DeviceResponse(**data)


@router.post("/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_new_device(
    device: DeviceCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建新设备

    需要登录认证。设备将创建在当前用户的数据库中。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求创建设备: {device.name}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 创建设备
        db_device = create_device(
            db=db,
            name=device.name,
            device_type=device.device_type,
            platform_level=device.platform_level,
            model=device.model,
            manufacturer=device.manufacturer,
            sensors=device.sensors,
            actuators=device.actuators,
            description=device.description
        )

        print(f"[API] 设备创建成功: {db_device.id}")

        # 转换为响应格式
        return _enrich_device_response(db_device)

    except Exception as e:
        print(f"[API] 创建设备失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建设备失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/", response_model=List[DeviceResponse])
async def get_devices(
    device_type: Optional[str] = Query(None, description="设备类型"),
    platform_level: Optional[str] = Query(None, description="平台层级"),
    active_only: Optional[bool] = Query(True, description="是否只获取活跃设备"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    has_sensor: Optional[str] = Query(None, description="包含特定传感器的设备"),
    has_actuator: Optional[str] = Query(None, description="包含特定执行机构的设备"),
    current_user: User = Depends(get_current_user)
):
    """
    获取设备列表

    返回当前用户的所有设备。
    提供关键字、设备类型等参数可以进行过滤。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求获取设备列表")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 使用搜索功能，支持多条件过滤
        devices = search_devices(
            db=db,
            device_type=device_type,
            platform_level=platform_level,
            keyword=keyword,
            has_sensor=has_sensor,
            has_actuator=has_actuator,
            active_only=active_only
        )

        # 转换为响应格式
        device_responses = [_enrich_device_response(device) for device in devices]

        print(f"[API] 返回 {len(device_responses)} 个设备")
        return device_responses

    except Exception as e:
        print(f"[API] 获取设备列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取设备列表失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    根据ID获取特定设备

    获取当前用户的设备。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求获取设备: {device_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 获取设备信息
        device = get_device_by_id(db, device_id)

        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        print(f"[API] 返回设备信息: {device.model}")
        return _enrich_device_response(device)

    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 获取设备失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取设备失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device_by_id(
    device_id: str,
    device_update: DeviceUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新设备信息

    更新当前用户的设备。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求更新设备: {device_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 更新设备
        db_device = update_device(
            db=db,
            device_id=device_id,
            name=device_update.name,
            device_type=device_update.device_type,
            platform_level=device_update.platform_level,
            model=device_update.model,
            manufacturer=device_update.manufacturer,
            sensors=device_update.sensors,
            actuators=device_update.actuators,
            description=device_update.description,
            is_active=device_update.is_active
        )

        if not db_device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        print(f"[API] 设备更新成功: {db_device.model}")
        return _enrich_device_response(db_device)

    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 更新设备失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新设备失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device_by_id(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    删除设备（硬删除）

    删除当前用户的设备，同时清理 Mosquitto 中的设备凭据。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求删除设备: {device_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 先获取设备，检查是否已绑定（需要清理 MQTT 凭据）
        device = get_device_by_id(db, device_id)
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        # 清理 Mosquitto 密码文件中的设备凭据
        if device.mqtt_secret_hash:
            print(f"[API] 清理设备 {device_id[:8]}... 的 MQTT 凭据")
            _ = remove_device_from_mosquitto_passwd(device_id)

        # 删除设备（硬删除）
        success = delete_device(
            db=db,
            device_id=device_id,
            soft_delete=False
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        print(f"[API] 设备删除成功: {device_id}")
        return

    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 删除设备失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除设备失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


# =============================================================================
# 设备绑定（MQTT 凭据下发）
# =============================================================================

@router.post("/{device_id}/provision", response_model=DeviceProvisionResponse)
async def provision_device_credentials(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    为设备生成 MQTT 连接凭据（设备绑定/实例化）

    返回设备连接所需的完整配置，包括一次性显示的 MQTT 密钥。
    重复调用会重新生成密钥（旧密钥失效）。
    """
    import os
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求绑定设备 {device_id[:8]}...")

        db = get_user_db(str(current_user.userid))
        device = get_device_by_id(db, device_id)

        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        secret = provision_device(db, device_id)
        if secret is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="凭据生成失败"
            )

        broker_host = os.getenv("MQTT_PUBLIC_HOST", os.getenv("MQTT_BROKER_HOST", "localhost"))
        broker_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))

        return DeviceProvisionResponse(
            device_id=device_id,
            device_name=device.name,
            mqtt_broker_host=broker_host,
            mqtt_broker_port=broker_port,
            mqtt_username=device_id,
            mqtt_password=secret,
            heartbeat_topic=f"device/{device_id}/heartbeat",
            cmd_topic=f"device/{device_id}/cmd",
            status_topic=f"device/{device_id}/status",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] 设备绑定失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"设备绑定失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.delete("/{device_id}/provision", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_device_credentials(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    清空设备 MQTT 凭据（解除绑定）

    从 Mosquitto 密码文件移除设备用户，并清除数据库中的密钥哈希。
    设备将无法再连接 MQTT Broker。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求清空设备凭据: {device_id[:8]}...")

        db = get_user_db(str(current_user.userid))
        device = get_device_by_id(db, device_id)

        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        if not device.mqtt_secret_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="设备未绑定，无需清空凭据"
            )

        success = deprovision_device(db, device_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="清空凭据失败"
            )

        print(f"[API] 设备凭据已清空: {device_id[:8]}...")
        return

    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] 清空设备凭据失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"清空设备凭据失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


# =============================================================================
# 设备心跳（HTTP API）- 无需用户登录，设备凭据认证
# =============================================================================

@router.post("/{device_id}/heartbeat", status_code=status.HTTP_200_OK)
async def device_heartbeat(
    device_id: str,
    x_device_secret: str = Header(..., alias="X-Device-Secret", description="设备MQTT密钥"),
):
    """
    设备心跳上报（HTTP API）

    设备通过 HTTP 上报心跳，替代 MQTT heartbeat topic。
    认证方式：Header 中传入 X-Device-Secret（即 provision 时下发的 mqtt_password）。

    curl 示例:
      curl -X POST https://green-tracker.cn:6130/api/devices/{device_id}/heartbeat \\
        -H "X-Device-Secret: <设备密钥>"
    """
    success = record_device_heartbeat(device_id, x_device_secret)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="设备验证失败或设备不存在"
        )

    return {"status": "ok", "device_id": device_id}

