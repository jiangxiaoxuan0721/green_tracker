from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database.main_db import get_db
from database.db_services.field_service import (
    create_field, get_field_by_id, get_fields_by_owner, get_all_fields,
    search_fields, update_field, delete_field, restore_field,
    get_field_with_wkt, get_fields_by_owner_with_wkt,
    find_fields_containing_point
)
from api.schemas.field import (
    FieldCreate, FieldUpdate, FieldResponse, PointQuery, FieldListParams
)
from typing import List, Optional
from database.db_models.user_model import User

# 从auth模块导入get_current_user函数
from api.routes.auth import get_current_user

router = APIRouter(prefix="/api/fields", tags=["fields"])


@router.post("/", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
async def create_new_field(
    field: FieldCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建新地块
    
    需要登录认证。地块将自动关联到当前用户。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求创建地块: {field.name}")
        
        # 创建地块，使用当前用户ID作为所有者
        db_field = create_field(
            db=db,
            name=field.name,
            description=field.description,
            location_geom=field.location_wkt,
            area_m2=field.area_m2,
            crop_type=field.crop_type,
            soil_type=field.soil_type,
            irrigation_type=field.irrigation_type,
            owner_id=current_user.userid,
            organization_id=field.organization_id
        )
        
        # 转换为响应格式
        field_response = get_field_with_wkt(db, db_field.id)
        if not field_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="创建地块成功但获取数据失败"
            )
        
        print(f"[API] 地块创建成功: {field_response['id']}")
        return field_response
        
    except Exception as e:
        print(f"[API] 创建地块失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建地块失败: {str(e)}"
        )


@router.get("/", response_model=List[FieldResponse])
async def get_fields(
    owner_id: Optional[str] = Query(None, description="所有者ID，不提供则返回当前用户的地块"),
    organization_id: Optional[str] = Query(None, description="组织ID"),
    active_only: Optional[bool] = Query(True, description="是否只获取活跃地块"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    crop_type: Optional[str] = Query(None, description="作物类型"),
    soil_type: Optional[str] = Query(None, description="土壤类型"),
    irrigation_type: Optional[str] = Query(None, description="灌溉方式"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取地块列表
    
    如果不提供owner_id，则返回当前用户的地块。
    提供关键字和作物类型等参数可以进行过滤。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求获取地块列表")
        
        # 如果未提供owner_id，则使用当前用户ID
        if not owner_id:
            owner_id = current_user.userid
        
        # 使用搜索功能，支持多条件过滤
        fields = search_fields(
            db=db,
            owner_id=owner_id,
            organization_id=organization_id,
            keyword=keyword,
            crop_type=crop_type,
            soil_type=soil_type,
            irrigation_type=irrigation_type,
            active_only=active_only
        )
        
        # 转换为响应格式（包含WKT）
        fields_with_wkt = []
        for field in fields:
            field_wkt = get_field_with_wkt(db, field.id)
            if field_wkt:
                fields_with_wkt.append(field_wkt)
        
        print(f"[API] 返回 {len(fields_with_wkt)} 个地块")
        return fields_with_wkt
        
    except Exception as e:
        print(f"[API] 获取地块列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取地块列表失败: {str(e)}"
        )


@router.get("/{field_id}", response_model=FieldResponse)
async def get_field(
    field_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    根据ID获取特定地块
    
    只能获取当前用户拥有或其组织拥有的地块。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求获取地块: {field_id}")
        
        # 获取地块信息
        field_response = get_field_with_wkt(db, field_id)
        
        if not field_response:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在"
            )
        
        # 检查权限（用户只能查看自己的地块）
        if field_response["owner_id"] != current_user.userid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该地块"
            )
        
        print(f"[API] 返回地块信息: {field_response['name']}")
        return field_response
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 获取地块失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取地块失败: {str(e)}"
        )


@router.put("/{field_id}", response_model=FieldResponse)
async def update_field_by_id(
    field_id: str,
    field_update: FieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新地块信息
    
    只能更新当前用户拥有或其组织拥有的地块。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求更新地块: {field_id}")
        
        # 更新地块
        db_field = update_field(
            db=db,
            field_id=field_id,
            owner_id=current_user.userid,
            name=field_update.name,
            description=field_update.description,
            location_geom=field_update.location_wkt,
            area_m2=field_update.area_m2,
            crop_type=field_update.crop_type,
            soil_type=field_update.soil_type,
            irrigation_type=field_update.irrigation_type,
            is_active=field_update.is_active
        )
        
        if not db_field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在或无权访问"
            )
        
        # 转换为响应格式
        field_response = get_field_with_wkt(db, field_id)
        
        print(f"[API] 地块更新成功: {field_response['name']}")
        return field_response
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 更新地块失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新地块失败: {str(e)}"
        )


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_by_id(
    field_id: str,
    soft_delete: Optional[bool] = Query(True, description="是否使用软删除，默认为True"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    删除地块
    
    只能删除当前用户拥有或其组织拥有的地块。
    默认使用软删除（标记为不活跃），可通过参数hard=true进行硬删除。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求删除地块: {field_id}, 软删除: {soft_delete}")
        
        # 删除地块
        success = delete_field(
            db=db,
            field_id=field_id,
            owner_id=current_user.userid,
            soft_delete=soft_delete
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在或无权访问"
            )
        
        print(f"[API] 地块删除成功: {field_id}")
        return
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 删除地块失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除地块失败: {str(e)}"
        )


@router.post("/{field_id}/restore", response_model=FieldResponse)
async def restore_field_by_id(
    field_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    恢复已软删除的地块
    
    只能恢复当前用户拥有或其组织拥有的地块。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求恢复地块: {field_id}")
        
        # 恢复地块
        db_field = restore_field(
            db=db,
            field_id=field_id,
            owner_id=current_user.userid
        )
        
        if not db_field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在或无权访问"
            )
        
        # 转换为响应格式
        field_response = get_field_with_wkt(db, field_id)
        
        print(f"[API] 地块恢复成功: {field_response['name']}")
        return field_response
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        print(f"[API] 恢复地块失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"恢复地块失败: {str(e)}"
        )


@router.post("/point-query", response_model=List[FieldResponse])
async def find_fields_by_point(
    point: PointQuery,
    owner_id: Optional[str] = Query(None, description="所有者ID，不提供则返回当前用户的地块"),
    organization_id: Optional[str] = Query(None, description="组织ID"),
    active_only: Optional[bool] = Query(True, description="是否只获取活跃地块"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    查找包含指定点的地块
    
    根据经纬度查找包含该点的所有地块。
    如果未提供owner_id，则查找当前用户的地块。
    """
    try:
        print(f"[API] 用户 {current_user.username} 请求点查询: ({point.longitude}, {point.latitude})")
        
        # 如果未提供owner_id，则使用当前用户ID
        if not owner_id:
            owner_id = current_user.userid
        
        # 查找包含指定点的地块
        fields = find_fields_containing_point(
            db=db,
            longitude=point.longitude,
            latitude=point.latitude,
            owner_id=owner_id,
            organization_id=organization_id,
            active_only=active_only
        )
        
        # 转换为响应格式（包含WKT）
        fields_with_wkt = []
        for field in fields:
            field_wkt = get_field_with_wkt(db, field.id)
            if field_wkt:
                fields_with_wkt.append(field_wkt)
        
        print(f"[API] 点查询返回 {len(fields_with_wkt)} 个地块")
        return fields_with_wkt
        
    except Exception as e:
        print(f"[API] 点查询失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"点查询失败: {str(e)}"
        )