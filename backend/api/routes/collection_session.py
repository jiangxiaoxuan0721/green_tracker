from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from database.main_db import get_db
from database.db_services.collection_session_service import (
    create_collection_session,
    get_collection_session_by_id,
    get_collection_sessions_by_field,
    update_collection_session,
    delete_collection_session,
    get_latest_collection_session_by_field,
    get_collection_sessions_by_status,
    get_collection_sessions_with_field_info
)

# 创建路由器
router = APIRouter(prefix="/api/collection-sessions", tags=["采集任务管理"])

# Pydantic 模型定义
class CollectionSessionBase(BaseModel):
    field_id: str = Field(..., description="农田ID")
    creator_id: Optional[str] = Field(None, description="任务创建者ID")
    start_time: datetime = Field(..., description="任务开始时间")
    mission_type: str = Field(..., description="任务类型（巡检/定点/路径/应急）")
    end_time: Optional[datetime] = Field(None, description="任务结束时间")
    mission_name: Optional[str] = Field(None, description="任务名称")
    description: Optional[str] = Field(None, description="任务说明")
    weather_snapshot: Optional[Dict[str, Any]] = Field(None, description="采集时的环境快照")
    status: str = Field("planned", description="任务状态")

class CollectionSessionCreate(CollectionSessionBase):
    pass

class CollectionSessionUpdate(BaseModel):
    end_time: Optional[datetime] = Field(None, description="任务结束时间")
    mission_name: Optional[str] = Field(None, description="任务名称")
    description: Optional[str] = Field(None, description="任务说明")
    weather_snapshot: Optional[Dict[str, Any]] = Field(None, description="采集时的环境快照")
    status: Optional[str] = Field(None, description="任务状态")

class CollectionSessionResponse(BaseModel):
    id: str
    field_id: str
    creator_id: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    mission_type: str
    mission_name: Optional[str]
    description: Optional[str]
    weather_snapshot: Optional[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class CollectionSessionWithFieldResponse(BaseModel):
    id: str
    field_id: str
    creator_id: Optional[str]
    field_name: str
    start_time: Optional[str]
    end_time: Optional[str]
    mission_type: str
    mission_name: Optional[str]
    description: Optional[str]
    weather_snapshot: Optional[Dict[str, Any]]
    status: str
    created_at: Optional[str]
    updated_at: Optional[str]

# API 路由定义
@router.post("/", response_model=CollectionSessionResponse, summary="创建采集任务")
async def create_session(
    session_data: CollectionSessionCreate,
    db: Session = Depends(get_db)
):
    """
    创建新的采集任务/观测会话
    """
    print(f"[API] 收到创建采集任务请求: 农田ID={session_data.field_id}, 任务类型={session_data.mission_type}")
    
    try:
        new_session = create_collection_session(
            db=db,
            field_id=session_data.field_id,
            creator_id=session_data.creator_id,
            start_time=session_data.start_time,
            mission_type=session_data.mission_type,
            end_time=session_data.end_time,
            mission_name=session_data.mission_name,
            description=session_data.description,
            weather_snapshot=session_data.weather_snapshot,
            status=session_data.status
        )
        
        return CollectionSessionResponse.from_orm(new_session)
    except Exception as e:
        print(f"[API] 创建采集任务失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"创建采集任务失败: {str(e)}")

@router.get("/{session_id}", response_model=CollectionSessionResponse, summary="获取采集任务详情")
async def get_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    根据ID获取采集任务详情
    """
    print(f"[API] 收到获取采集任务详情请求: ID={session_id}")
    
    session = get_collection_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="采集任务不存在")
    
    return CollectionSessionResponse.from_orm(session)

@router.get("/field/{field_id}", response_model=List[CollectionSessionResponse], summary="获取指定农田的采集任务列表")
async def get_sessions_by_field(
    field_id: str,
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    start_date: Optional[str] = Query(None, description="开始日期过滤 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期过滤 (YYYY-MM-DD)"),
    mission_types: Optional[str] = Query(None, description="任务类型过滤，逗号分隔"),
    status: Optional[str] = Query(None, description="状态过滤"),
    db: Session = Depends(get_db)
):
    """
    获取指定农田的采集任务列表
    """
    print(f"[API] 收到获取农田采集任务列表请求: 农田ID={field_id}")
    
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
    
    sessions = get_collection_sessions_by_field(
        db=db,
        field_id=field_id,
        limit=limit,
        offset=offset,
        start_date=start_datetime,
        end_date=end_datetime,
        mission_types=mission_type_list,
        status=status
    )
    
    return [CollectionSessionResponse.from_orm(session) for session in sessions]

@router.get("/", response_model=List[CollectionSessionWithFieldResponse], summary="获取采集任务列表（含农田信息）")
async def get_sessions_with_field(
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    field_id: Optional[str] = Query(None, description="农田ID过滤"),
    start_date: Optional[str] = Query(None, description="开始日期过滤 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期过滤 (YYYY-MM-DD)"),
    mission_types: Optional[str] = Query(None, description="任务类型过滤，逗号分隔"),
    status: Optional[str] = Query(None, description="状态过滤"),
    db: Session = Depends(get_db)
):
    """
    获取采集任务列表，包含关联的农田信息
    """
    print("[API] 收到获取采集任务列表请求（含农田信息）")
    
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

@router.put("/{session_id}", response_model=CollectionSessionResponse, summary="更新采集任务")
async def update_session(
    session_id: str,
    session_update: CollectionSessionUpdate,
    db: Session = Depends(get_db)
):
    """
    更新采集任务信息
    """
    print(f"[API] 收到更新采集任务请求: ID={session_id}")
    
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
    
    return CollectionSessionResponse.from_orm(updated_session)

@router.delete("/{session_id}", summary="删除采集任务")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    删除采集任务
    """
    print(f"[API] 收到删除采集任务请求: ID={session_id}")
    
    success = delete_collection_session(db, session_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="采集任务不存在")
    
    return {"message": "采集任务删除成功"}

@router.get("/field/{field_id}/latest", response_model=CollectionSessionResponse, summary="获取指定农田的最新采集任务")
async def get_latest_session_by_field(
    field_id: str,
    mission_type: Optional[str] = Query(None, description="任务类型过滤"),
    db: Session = Depends(get_db)
):
    """
    获取指定农田的最新采集任务
    """
    print(f"[API] 收到获取最新采集任务请求: 农田ID={field_id}")
    
    session = get_latest_collection_session_by_field(db, field_id, mission_type)
    
    if not session:
        raise HTTPException(status_code=404, detail="未找到符合条件的采集任务")
    
    return CollectionSessionResponse.from_orm(session)

@router.get("/status/{status}", response_model=List[CollectionSessionResponse], summary="根据状态获取采集任务列表")
async def get_sessions_by_status(
    status: str,
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    db: Session = Depends(get_db)
):
    """
    根据状态获取采集任务列表
    """
    print(f"[API] 收到根据状态获取采集任务列表请求: 状态={status}")
    
    sessions = get_collection_sessions_by_status(db, status, limit, offset)
    
    return [CollectionSessionResponse.from_orm(session) for session in sessions]