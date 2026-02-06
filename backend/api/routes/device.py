from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database.user_db_manager import get_user_db
from database.db_models.meta_model import User
from database.db_services.device_service import (
    create_device, get_device_by_id, get_all_devices,
    search_devices, update_device, delete_device, restore_device,
    get_devices_by_type, get_devices_by_platform
)
from api.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceListParams
)
from typing import List, Optional

# 从auth模块导入get_current_user函数
from api.routes.auth import get_current_user

router = APIRouter(prefix="/api/devices", tags=["devices"])


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
        return DeviceResponse.model_validate(db_device)

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
        device_responses = [DeviceResponse.model_validate(device) for device in devices]

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
        return DeviceResponse.model_validate(device)

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
        return DeviceResponse.model_validate(db_device)

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
    soft_delete: Optional[bool] = Query(True, description="是否使用软删除，默认为True"),
    current_user: User = Depends(get_current_user)
):
    """
    删除设备

    删除当前用户的设备。
    默认使用软删除（标记为不活跃），可通过参数hard=true进行硬删除。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求删除设备: {device_id}, 软删除: {soft_delete}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 删除设备
        success = delete_device(
            db=db,
            device_id=device_id,
            soft_delete=soft_delete
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


@router.post("/{device_id}/restore", response_model=DeviceResponse)
async def restore_device_by_id(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    恢复已软删除的设备

    恢复当前用户的设备。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求恢复设备: {device_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 恢复设备
        db_device = restore_device(
            db=db,
            device_id=device_id
        )

        if not db_device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )

        print(f"[API] 设备恢复成功: {db_device.model}")
        return DeviceResponse.model_validate(db_device)

    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 恢复设备失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"恢复设备失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/types/{device_type}", response_model=List[DeviceResponse])
async def get_devices_by_type_endpoint(
    device_type: str,
    active_only: Optional[bool] = Query(True, description="是否只获取活跃设备"),
    current_user: User = Depends(get_current_user)
):
    """
    根据设备类型获取设备列表

    返回当前用户拥有的特定类型的设备。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求获取设备类型: {device_type}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 获取特定类型的设备
        devices = get_devices_by_type(
            db=db,
            device_type=device_type,
            active_only=active_only
        )

        # 转换为响应格式
        device_responses = [DeviceResponse.model_validate(device) for device in devices]

        print(f"[API] 返回 {len(device_responses)} 个{device_type}类型设备")
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


@router.get("/platforms/{platform_level}", response_model=List[DeviceResponse])
async def get_devices_by_platform_endpoint(
    platform_level: str,
    active_only: Optional[bool] = Query(True, description="是否只获取活跃设备"),
    current_user: User = Depends(get_current_user)
):
    """
    根据平台层级获取设备列表

    返回当前用户拥有的特定平台层级的设备。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求获取平台层级: {platform_level}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 获取特定平台层级的设备
        devices = get_devices_by_platform(
            db=db,
            platform_level=platform_level,
            active_only=active_only
        )

        # 转换为响应格式
        device_responses = [DeviceResponse.model_validate(device) for device in devices]

        print(f"[API] 返回 {len(device_responses)} 个{platform_level}平台设备")
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
