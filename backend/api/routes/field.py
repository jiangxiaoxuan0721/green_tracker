from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database.user_db_manager import get_user_db
from database.db_models.meta_model import User
from database.db_services.field_service import (
    create_field, get_field_by_id, get_all_fields,
    search_fields, update_field, delete_field,
    get_field_with_wkt, get_all_fields_with_wkt,
    search_fields_with_wkt,
    find_fields_containing_point
)
from api.schemas.field import (
    FieldCreate, FieldUpdate, FieldResponse, PointQuery, FieldListParams
)
from typing import List, Optional

# 从auth模块导入get_current_user函数
from api.routes.auth import get_current_user

router = APIRouter(prefix="/api/fields", tags=["fields"])


@router.post("/", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
async def create_new_field(
    field: FieldCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建新地块

    需要登录认证。地块将创建在当前用户的数据库中。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求创建地块: {field.name}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 创建地块
        db_field = create_field(
            db=db,
            name=field.name,
            description=field.description,
            location_geom=field.location_wkt,
            area_m2=field.area_m2,
            crop_type=field.crop_type,
            soil_type=field.soil_type,
            irrigation_type=field.irrigation_type
        )

        # 转换为响应格式
        field_response = get_field_with_wkt(db, str(db_field.id))
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
    finally:
        if db:
            db.close()


@router.get("/", response_model=List[FieldResponse])
async def get_fields(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    crop_type: Optional[str] = Query(None, description="作物类型"),
    soil_type: Optional[str] = Query(None, description="土壤类型"),
    irrigation_type: Optional[str] = Query(None, description="灌溉方式"),
    current_user: User = Depends(get_current_user)
):
    """
    获取地块列表

    返回当前用户的所有地块。
    提供关键字和作物类型等参数可以进行过滤。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求获取地块列表")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 使用带WKT的搜索功能，支持多条件过滤
        fields = search_fields_with_wkt(
            db=db,
            keyword=keyword or None,
            crop_type=crop_type or None,
            soil_type=soil_type or None,
            irrigation_type=irrigation_type or None,
            active_only=True
        )

        print(f"[API] 返回 {len(fields)} 个地块")
        return fields

    except Exception as e:
        print(f"[API] 获取地块列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取地块列表失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/{field_id}", response_model=FieldResponse)
async def get_field(
    field_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    根据ID获取特定地块

    获取当前用户的地块。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求获取地块: {field_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 获取地块信息
        field_response = get_field_with_wkt(db, field_id)

        if not field_response:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在"
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
    finally:
        if db:
            db.close()


@router.put("/{field_id}", response_model=FieldResponse)
async def update_field_by_id(
    field_id: str,
    field_update: FieldUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新地块信息

    更新当前用户的地块。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求更新地块: {field_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 更新地块
        db_field = update_field(
            db=db,
            field_id=field_id,
            name=field_update.name or None,
            description=field_update.description or None,
            location_geom=field_update.location_wkt or None,
            area_m2=field_update.area_m2,
            crop_type=field_update.crop_type or None,
            soil_type=field_update.soil_type or None,
            irrigation_type=field_update.irrigation_type or None
        )

        if not db_field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在"
            )

        # 转换为响应格式
        field_response = get_field_with_wkt(db, field_id)

        if field_response:
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
    finally:
        if db:
            db.close()


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_by_id(
    field_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    删除地块（硬删除）

    删除当前用户的地块。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求删除地块: {field_id}")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 删除地块
        success = delete_field(
            db=db,
            field_id=field_id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="地块不存在"
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
    finally:
        if db:
            db.close()


@router.post("/point-query", response_model=List[FieldResponse])
async def find_fields_by_point(
    point: PointQuery,
    current_user: User = Depends(get_current_user)
):
    """
    查找包含指定点的地块

    根据经纬度查找包含该点的所有地块。
    """
    db = None
    try:
        print(f"[API] 用户 {current_user.username} 请求点查询: ({point.longitude}, {point.latitude})")

        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))

        # 查找包含指定点的地块（已包含WKT）
        fields = find_fields_containing_point(
            db=db,
            longitude=point.longitude,
            latitude=point.latitude
        )

        print(f"[API] 点查询返回 {len(fields)} 个地块")
        return fields

    except Exception as e:
        print(f"[API] 点查询失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"点查询失败: {str(e)}"
        )
    finally:
        if db:
            db.close()
