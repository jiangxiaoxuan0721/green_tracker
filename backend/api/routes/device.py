from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database.main_db import get_db
from database.db_services.device_service import (
    create_device, get_device_by_id, get_devices_by_owner, get_all_devices,
    search_devices, update_device, delete_device, restore_device,
    get_devices_by_type, get_devices_by_platform
)
from api.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceListParams
)
from typing import List, Optional
from database.db_models.user_model import User

# 从auth模块导入get_current_user函数
from api.routes.auth import get_current_user

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post("/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_new_device(
    device: DeviceCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建新设备
    
    需要登录认证。设备将自动关联到当前用户。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求创建设备: {device.model}")
        
        # 创建设备，使用当前用户ID作为所有者
        db_device = create_device(
            db=db,
            device_type=device.device_type,
            platform_level=device.platform_level,
            model=device.model,
            manufacturer=device.manufacturer,
            sensors=device.sensors,
            actuators=device.actuators,
            description=device.description,
            owner_id=current_user.userid
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


@router.get("/", response_model=List[DeviceResponse])
async def get_devices(
    owner_id: Optional[str] = Query(None, description="所有者ID，不提供则返回当前用户的设备"),
    device_type: Optional[str] = Query(None, description="设备类型"),
    platform_level: Optional[str] = Query(None, description="平台层级"),
    active_only: Optional[bool] = Query(True, description="是否只获取活跃设备"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    has_sensor: Optional[str] = Query(None, description="包含特定传感器的设备"),
    has_actuator: Optional[str] = Query(None, description="包含特定执行机构的设备"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取设备列表
    
    如果不提供owner_id，则返回当前用户的设备。
    提供关键字、设备类型等参数可以进行过滤。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求获取设备列表")
        
        # 如果未提供owner_id，则使用当前用户ID
        if not owner_id:
            owner_id = current_user.userid
        
        # 使用搜索功能，支持多条件过滤
        devices = search_devices(
            db=db,
            owner_id=owner_id,
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


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    根据ID获取特定设备
    
    只能获取当前用户拥有的设备。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求获取设备: {device_id}")
        
        # 获取设备信息
        device = get_device_by_id(db, device_id)
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在"
            )
        
        # 检查权限（用户只能查看自己的设备）
        if device.owner_id != current_user.userid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该设备"
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


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device_by_id(
    device_id: str,
    device_update: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新设备信息
    
    只能更新当前用户拥有的设备。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求更新设备: {device_id}")
        
        # 更新设备
        db_device = update_device(
            db=db,
            device_id=device_id,
            owner_id=current_user.userid,
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
                detail="设备不存在或无权访问"
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


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device_by_id(
    device_id: str,
    soft_delete: Optional[bool] = Query(True, description="是否使用软删除，默认为True"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    删除设备
    
    只能删除当前用户拥有的设备。
    默认使用软删除（标记为不活跃），可通过参数hard=true进行硬删除。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求删除设备: {device_id}, 软删除: {soft_delete}")
        
        # 删除设备
        success = delete_device(
            db=db,
            device_id=device_id,
            owner_id=current_user.userid,
            soft_delete=soft_delete
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在或无权访问"
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


@router.post("/{device_id}/restore", response_model=DeviceResponse)
async def restore_device_by_id(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    恢复已软删除的设备
    
    只能恢复当前用户拥有的设备。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求恢复设备: {device_id}")
        
        # 恢复设备
        db_device = restore_device(
            db=db,
            device_id=device_id,
            owner_id=current_user.userid
        )
        
        if not db_device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="设备不存在或无权访问"
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


@router.get("/types/{device_type}", response_model=List[DeviceResponse])
async def get_devices_by_type_endpoint(
    device_type: str,
    active_only: Optional[bool] = Query(True, description="是否只获取活跃设备"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    根据设备类型获取设备列表
    
    返回当前用户拥有的特定类型的设备。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求获取设备类型: {device_type}")
        
        # 获取特定类型的设备
        devices = get_devices_by_owner(
            db=db,
            owner_id=current_user.userid,
            active_only=active_only
        )
        
        # 过滤特定类型的设备
        filtered_devices = [device for device in devices if device.device_type == device_type]
        
        # 转换为响应格式
        device_responses = [DeviceResponse.model_validate(device) for device in filtered_devices]
        
        print(f"[API] 返回 {len(device_responses)} 个{device_type}类型设备")
        return device_responses
        
    except Exception as e:
        print(f"[API] 获取设备列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取设备列表失败: {str(e)}"
        )


@router.get("/platforms/{platform_level}", response_model=List[DeviceResponse])
async def get_devices_by_platform_endpoint(
    platform_level: str,
    active_only: Optional[bool] = Query(True, description="是否只获取活跃设备"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    根据平台层级获取设备列表
    
    返回当前用户拥有的特定平台层级的设备。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求获取平台层级: {platform_level}")
        
        # 获取特定平台层级的设备
        devices = get_devices_by_owner(
            db=db,
            owner_id=current_user.userid,
            active_only=active_only
        )
        
        # 过滤特定平台层级的设备
        filtered_devices = [device for device in devices if device.platform_level == platform_level]
        
        # 转换为响应格式
        device_responses = [DeviceResponse.model_validate(device) for device in filtered_devices]
        
        print(f"[API] 返回 {len(device_responses)} 个{platform_level}平台设备")
        return device_responses
        
    except Exception as e:
        print(f"[API] 获取设备列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取设备列表失败: {str(e)}"
        )