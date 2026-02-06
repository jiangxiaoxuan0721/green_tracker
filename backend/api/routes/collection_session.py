from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.user_db_manager import get_user_db
from api.routes.auth import get_current_user
from database.db_models.meta_model import User
from database.db_services.collection_session_service import (
    create_collection_session,
    get_collection_session_by_id,
    get_collection_session_with_details,
    get_collection_sessions_by_field,
    update_collection_session,
    delete_collection_session,
    get_latest_collection_session_by_field,
    get_collection_sessions_by_status,
    get_collection_sessions_with_field_info
)
from api.schemas.collection_session import (
    CollectionSessionCreate,
    CollectionSessionUpdate,
    CollectionSessionResponse,
    CollectionSessionWithFieldResponse
)

# 创建路由器
router = APIRouter(prefix="/api/collection-sessions", tags=["采集任务管理"])

# 辅助函数：将CollectionSession对象转换为响应字典
def convert_session_to_dict(session, include_user_info=False):
    """将CollectionSession对象转换为字典，处理UUID转换"""
    result = {
        "id": str(session.id),
        "field_id": str(session.field_id),
        "start_time": session.start_time,
        "end_time": session.end_time,
        "mission_type": session.mission_type,
        "mission_name": session.mission_name,
        "description": session.description,
        "weather_snapshot": session.weather_snapshot,
        "status": session.status,
        "created_at": session.created_at,
        "updated_at": session.updated_at
    }

    return result

# API 路由定义
@router.post("/", response_model=CollectionSessionWithFieldResponse, summary="创建采集任务")
async def create_session(
    session_data: CollectionSessionCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建新的采集任务/观测会话
    """
    print(f"[API] 收到创建采集任务请求: 农田ID={session_data.field_id}, 任务类型={session_data.mission_type}")
    print(f"[API] 接收到的完整数据: {session_data}")
    print(f"[API] 当前用户: {current_user.username}, ID: {current_user.userid}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 创建采集任务
        new_session = create_collection_session(
            db=db,
            field_id=session_data.field_id,
            start_time=session_data.start_time,
            mission_type=session_data.mission_type,
            end_time=session_data.end_time,
            mission_name=session_data.mission_name,
            description=session_data.description,
            weather_snapshot=session_data.weather_snapshot,
            status=session_data.status
        )

        # 获取创建后的带有详细信息的采集任务
        session_with_details = get_collection_session_with_details(db, str(new_session.id))

        return CollectionSessionWithFieldResponse(**session_with_details)
    except ValueError as e:
        print(f"[API] 参数验证失败: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[API] 创建采集任务失败: {str(e)}")
        # 检查是否是唯一性约束错误
        if "duplicate key" in str(e).lower() and "collection_session_pkey" in str(e):
            raise HTTPException(status_code=409, detail="任务创建失败: ID冲突，请重试")
        # 检查是否是UUID格式错误
        if "badly formed hexadecimal UUID" in str(e):
            raise HTTPException(status_code=400, detail="农田ID格式错误，请确保选择了有效的农田")
        raise HTTPException(status_code=400, detail=f"创建采集任务失败: {str(e)}")
    finally:
        db.close()

@router.get("/{session_id}", response_model=CollectionSessionWithFieldResponse, summary="获取采集任务详情")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    根据ID获取采集任务详情
    """
    print(f"[API] 收到获取采集任务详情请求: ID={session_id}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        session = get_collection_session_with_details(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        return CollectionSessionWithFieldResponse(**session)
    finally:
        db.close()

@router.get("/field/{field_id}", response_model=List[CollectionSessionWithFieldResponse], summary="获取指定农田的采集任务列表")
async def get_sessions_by_field(
    field_id: str,
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    start_date: Optional[str] = Query(None, description="开始日期过滤 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期过滤 (YYYY-MM-DD)"),
    mission_types: Optional[str] = Query(None, description="任务类型过滤，逗号分隔"),
    status: Optional[str] = Query(None, description="状态过滤"),
    current_user: User = Depends(get_current_user)
):
    """
    获取指定农田的采集任务列表
    """
    print(f"[API] 收到获取农田采集任务列表请求: 农田ID={field_id}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 处理日期过滤
        start_datetime = None
        end_datetime = None
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="开始日期格式无效，请使用YYYY-MM-DD格式")

        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="结束日期格式无效，请使用YYYY-MM-DD格式")

        # 处理任务类型过滤
        mission_type_list = None
        if mission_types:
            mission_type_list = [t.strip() for t in mission_types.split(",")]

        # 使用带有农田信息的查询
        sessions_with_info = get_collection_sessions_with_field_info(
            db=db,
            limit=limit,
            offset=offset,
            field_id=field_id,
            start_date=start_datetime,
            end_date=end_datetime,
            mission_types=mission_type_list,
            status=status
        )

        return [CollectionSessionWithFieldResponse(**session_dict) for session_dict in sessions_with_info]
    finally:
        db.close()

@router.get("/", response_model=List[CollectionSessionWithFieldResponse], summary="获取采集任务列表（含农田信息）")
async def get_sessions_with_field(
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    field_id: Optional[str] = Query(None, description="农田ID过滤"),
    start_date: Optional[str] = Query(None, description="开始日期过滤 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期过滤 (YYYY-MM-DD)"),
    mission_types: Optional[str] = Query(None, description="任务类型过滤，逗号分隔"),
    status: Optional[str] = Query(None, description="状态过滤"),
    current_user: User = Depends(get_current_user)
):
    """
    获取采集任务列表，包含关联的农田信息
    """
    print("[API] 收到获取采集任务列表请求（含农田信息）")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 处理日期过滤
        start_datetime = None
        end_datetime = None
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="开始日期格式无效，请使用YYYY-MM-DD格式")

        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="结束日期格式无效，请使用YYYY-MM-DD格式")

        # 处理任务类型过滤
        mission_type_list = None
        if mission_types:
            mission_type_list = [t.strip() for t in mission_types.split(",")]

        sessions_with_fields = get_collection_sessions_with_field_info(
            db=db,
            limit=limit,
            offset=offset,
            field_id=field_id,
            start_date=start_datetime,
            end_date=end_datetime,
            mission_types=mission_type_list,
            status=status
        )

        return [CollectionSessionWithFieldResponse(**session_dict) for session_dict in sessions_with_fields]
    finally:
        db.close()

@router.put("/{session_id}", response_model=CollectionSessionWithFieldResponse, summary="更新采集任务")
async def update_session(
    session_id: str,
    session_update: CollectionSessionUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新采集任务信息
    """
    print(f"[API] 收到更新采集任务请求: ID={session_id}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 首先获取任务详情以验证权限
        session_with_details = get_collection_session_with_details(db, session_id)
        if not session_with_details:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        updated_session = update_collection_session(
            db=db,
            session_id=session_id,
            end_time=session_update.end_time,
            mission_name=session_update.mission_name,
            description=session_update.description,
            weather_snapshot=session_update.weather_snapshot,
            status=session_update.status
        )

        if not updated_session:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        # 获取更新后的带有详细信息的采集任务
        session_with_details = get_collection_session_with_details(db, session_id)

        return CollectionSessionWithFieldResponse(**session_with_details)
    finally:
        db.close()

@router.delete("/{session_id}", summary="删除采集任务")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    删除采集任务
    """
    print(f"[API] 收到删除采集任务请求: ID={session_id}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 首先获取任务详情以验证权限
        session_with_details = get_collection_session_with_details(db, session_id)
        if not session_with_details:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        success = delete_collection_session(db, session_id)

        if not success:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        return {"message": "采集任务删除成功"}
    finally:
        db.close()

@router.get("/field/{field_id}/latest", response_model=CollectionSessionWithFieldResponse, summary="获取指定农田的最新采集任务")
async def get_latest_session_by_field(
    field_id: str,
    mission_type: Optional[str] = Query(None, description="任务类型过滤"),
    current_user: User = Depends(get_current_user)
):
    """
    获取指定农田的最新采集任务
    """
    print(f"[API] 收到获取最新采集任务请求: 农田ID={field_id}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 先获取最新的采集任务
        session = get_latest_collection_session_by_field(db, field_id, mission_type)

        if not session:
            raise HTTPException(status_code=404, detail="未找到符合条件的采集任务")

        # 然后获取带有详细信息的采集任务
        session_with_details = get_collection_session_with_details(db, str(session.id))

        return CollectionSessionWithFieldResponse(**session_with_details)
    finally:
        db.close()

@router.get("/status/{status}", response_model=List[CollectionSessionWithFieldResponse], summary="根据状态获取采集任务列表")
async def get_sessions_by_status(
    status: str,
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    current_user: User = Depends(get_current_user)
):
    """
    根据状态获取采集任务列表
    """
    print(f"[API] 收到根据状态获取采集任务列表请求: 状态={status}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 使用带有农田信息的查询
        sessions_with_info = get_collection_sessions_with_field_info(
            db=db,
            limit=limit,
            offset=offset,
            status=status
        )

        return [CollectionSessionWithFieldResponse(**session_dict) for session_dict in sessions_with_info]
    finally:
        db.close()