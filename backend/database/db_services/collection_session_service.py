from sqlalchemy import desc
from sqlalchemy.orm import Session
from database.db_models.collection_session_model import CollectionSession
from database.db_models.field_model import Field
from database.db_models.user_model import User
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

def create_collection_session(
    db: Session, 
    field_id: str, 
    start_time: datetime,
    mission_type: str,
    end_time: Optional[datetime] = None,
    mission_name: Optional[str] = None,
    description: Optional[str] = None,
    weather_snapshot: Optional[Dict[str, Any]] = None,
    status: str = "planned",
    creator_id: Optional[str] = None
) -> CollectionSession:
    """
    创建新的采集任务/观测会话
    
    Args:
        db: 数据库会话
        field_id: 农田ID
        start_time: 任务开始时间
        mission_type: 任务类型（巡检/定点/路径/应急）
        end_time: 任务结束时间（可选）
        mission_name: 任务名称（可选）
        description: 任务说明（可选）
        weather_snapshot: 采集时的环境快照（可选）
        status: 任务状态（默认为planned）
        creator_id: 任务创建者ID（可选）
    
    Returns:
        CollectionSession: 创建的采集任务对象
    """
    print(f"[后端CollectionSessionService] 创建采集任务: 农田ID={field_id}, 任务类型={mission_type}, 创建者ID={creator_id}")
    
    # 验证field_id是否为空或无效
    if not field_id:
        raise ValueError("农田ID不能为空")
    
    try:
        # 尝试转换field_id为UUID
        field_uuid = uuid.UUID(field_id) if isinstance(field_id, str) else field_id
    except (ValueError, AttributeError) as e:
        print(f"[后端CollectionSessionService] 无效的农田ID格式: {field_id}, 错误: {str(e)}")
        raise ValueError(f"无效的农田ID格式: {field_id}")
    
    # 生成新的UUID作为ID
    new_id = uuid.uuid4()
    print(f"[后端CollectionSessionService] 生成的新ID: {new_id}")
    
    # 创建新采集任务
    new_session = CollectionSession(
        id=new_id,  # 显式设置新生成的ID
        field_id=field_uuid,
        creator_id=creator_id,
        start_time=start_time,
        end_time=end_time,
        mission_type=mission_type,
        mission_name=mission_name,
        description=description,
        weather_snapshot=weather_snapshot,
        status=status
    )
    
    # 保存到数据库
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    print(f"[后端CollectionSessionService] 成功创建采集任务，ID={new_session.id}")
    return new_session

def get_collection_session_by_id(db: Session, session_id: str) -> Optional[CollectionSession]:
    """
    根据ID获取采集任务
    
    Args:
        db: 数据库会话
        session_id: 采集任务ID
    
    Returns:
        Optional[CollectionSession]: 采集任务对象，如果不存在则返回None
    """
    return db.query(CollectionSession).filter(CollectionSession.id == uuid.UUID(session_id) if isinstance(session_id, str) else session_id).first()

def get_collection_session_with_details(db: Session, session_id: str) -> Optional[Dict[str, Any]]:
    """
    根据ID获取采集任务详情，包含创建者和农田名称
    
    Args:
        db: 数据库会话
        session_id: 采集任务ID
    
    Returns:
        Optional[Dict[str, Any]]: 包含采集任务详情的字典，如果不存在则返回None
    """
    # 执行连接查询
    query = db.query(CollectionSession, Field, User).outerjoin(
        Field, CollectionSession.field_id == Field.id
    ).outerjoin(
        User, CollectionSession.creator_id == User.userid
    ).filter(
        CollectionSession.id == uuid.UUID(session_id) if isinstance(session_id, str) else session_id
    )
    
    result = query.first()
    if not result:
        return None
    
    session, field, user = result
    
    # 构建返回字典
    session_dict = {
        "id": str(session.id),
        "field_id": str(session.field_id),
        "field_name": field.name if field else "未知农田",
        "creator_id": str(session.creator_id) if session.creator_id else None,
        "creator_name": user.username if user else "未知用户",
        "start_time": session.start_time.isoformat() if session.start_time else None,
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "mission_type": session.mission_type,
        "mission_name": session.mission_name,
        "description": session.description,
        "weather_snapshot": session.weather_snapshot,
        "status": session.status,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None
    }
    
    return session_dict

def get_collection_sessions_by_field(
    db: Session, 
    field_id: str, 
    limit: int = 100, 
    offset: int = 0,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    mission_types: Optional[List[str]] = None,
    status: Optional[str] = None
) -> List[CollectionSession]:
    """
    获取指定农田的采集任务列表
    
    Args:
        db: 数据库会话
        field_id: 农田ID
        limit: 返回记录数限制
        offset: 偏移量
        start_date: 开始日期过滤
        end_date: 结束日期过滤
        mission_types: 任务类型过滤列表
        status: 状态过滤
    
    Returns:
        List[CollectionSession]: 采集任务列表
    """
    query = db.query(CollectionSession).filter(
        CollectionSession.field_id == uuid.UUID(field_id) if isinstance(field_id, str) else field_id
    )
    
    # 添加日期过滤
    if start_date:
        query = query.filter(CollectionSession.start_time >= start_date)
    if end_date:
        query = query.filter(CollectionSession.start_time <= end_date)
    
    # 添加任务类型过滤
    if mission_types:
        query = query.filter(CollectionSession.mission_type.in_(mission_types))
    
    # 添加状态过滤
    if status:
        query = query.filter(CollectionSession.status == status)
    
    # 按时间倒序排列
    query = query.order_by(desc(CollectionSession.start_time))
    
    return query.offset(offset).limit(limit).all()

def update_collection_session(
    db: Session, 
    session_id: str, 
    end_time: Optional[datetime] = None,
    mission_name: Optional[str] = None,
    description: Optional[str] = None,
    weather_snapshot: Optional[Dict[str, Any]] = None,
    status: Optional[str] = None
) -> Optional[CollectionSession]:
    """
    更新采集任务信息
    
    Args:
        db: 数据库会话
        session_id: 采集任务ID
        end_time: 任务结束时间（可选）
        mission_name: 任务名称（可选）
        description: 任务说明（可选）
        weather_snapshot: 采集时的环境快照（可选）
        status: 任务状态（可选）
    
    Returns:
        Optional[CollectionSession]: 更新后的采集任务对象，如果不存在则返回None
    """
    session = get_collection_session_by_id(db, session_id)
    if not session:
        return None
    
    # 更新字段
    if end_time is not None:
        session.end_time = end_time # type: ignore
    if mission_name is not None:
        session.mission_name = mission_name # type: ignore
    if description is not None:
        session.description = description # type: ignore
    if weather_snapshot is not None:
        session.weather_snapshot = weather_snapshot # type: ignore
    if status is not None:
        session.status = status # type: ignore
    
    db.commit()
    db.refresh(session)
    
    return session

def delete_collection_session(db: Session, session_id: str) -> bool:
    """
    删除采集任务
    
    Args:
        db: 数据库会话
        session_id: 采集任务ID
    
    Returns:
        bool: 删除成功返回True，否则返回False
    """
    session = get_collection_session_by_id(db, session_id)
    if not session:
        return False
    
    db.delete(session)
    db.commit()
    
    return True

def get_latest_collection_session_by_field(db: Session, field_id: str, mission_type: Optional[str] = None) -> Optional[CollectionSession]:
    """
    获取指定农田的最新采集任务
    
    Args:
        db: 数据库会话
        field_id: 农田ID
        mission_type: 任务类型过滤（可选）
    
    Returns:
        Optional[CollectionSession]: 最新的采集任务对象，如果不存在则返回None
    """
    query = db.query(CollectionSession).filter(
        CollectionSession.field_id == uuid.UUID(field_id) if isinstance(field_id, str) else field_id
    )
    
    if mission_type:
        query = query.filter(CollectionSession.mission_type == mission_type)
    
    return query.order_by(desc(CollectionSession.start_time)).first()

def get_collection_sessions_by_status(
    db: Session, 
    status: str, 
    limit: int = 100, 
    offset: int = 0
) -> List[CollectionSession]:
    """
    根据状态获取采集任务列表
    
    Args:
        db: 数据库会话
        status: 任务状态
        limit: 返回记录数限制
        offset: 偏移量
    
    Returns:
        List[CollectionSession]: 采集任务列表
    """
    return db.query(CollectionSession).filter(
        CollectionSession.status == status
    ).order_by(desc(CollectionSession.start_time)).offset(offset).limit(limit).all()

def get_collection_sessions_with_field_info(
    db: Session, 
    limit: int = 100, 
    offset: int = 0,
    field_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    mission_types: Optional[List[str]] = None,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    获取采集任务列表，包含关联的农田和创建者信息
    
    Args:
        db: 数据库会话
        limit: 返回记录数限制
        offset: 偏移量
        field_id: 农田ID过滤（可选）
        start_date: 开始日期过滤（可选）
        end_date: 结束日期过滤（可选）
        mission_types: 任务类型过滤列表（可选）
        status: 状态过滤（可选）
    
    Returns:
        List[Dict[str, Any]]: 包含采集任务、农田和创建者信息的字典列表
    """
    # 构建查询
    query = db.query(CollectionSession, Field, User).outerjoin(
        Field, CollectionSession.field_id == Field.id
    ).outerjoin(
        User, CollectionSession.creator_id == User.userid
    )
    
    # 添加过滤条件
    if field_id:
        query = query.filter(
            CollectionSession.field_id == uuid.UUID(field_id) if isinstance(field_id, str) else field_id
        )
    
    if start_date:
        query = query.filter(CollectionSession.start_time >= start_date)
    
    if end_date:
        query = query.filter(CollectionSession.start_time <= end_date)
    
    if mission_types:
        query = query.filter(CollectionSession.mission_type.in_(mission_types))
    
    if status:
        query = query.filter(CollectionSession.status == status)
    
    # 按时间倒序排列
    query = query.order_by(desc(CollectionSession.start_time))
    
    # 执行查询
    results = query.offset(offset).limit(limit).all()
    
    # 转换为字典列表
    sessions_with_fields = []
    for session, field, user in results:
        session_dict = {
            "id": str(session.id),
            "field_id": str(session.field_id),
            "creator_id": str(session.creator_id) if session.creator_id else None,
            "field_name": field.name if field else "未知农田",
            "creator_name": user.username if user else "未知用户",
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "mission_type": session.mission_type,
            "mission_name": session.mission_name,
            "description": session.description,
            "weather_snapshot": session.weather_snapshot,
            "status": session.status,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None
        }
        sessions_with_fields.append(session_dict)
    
    return sessions_with_fields