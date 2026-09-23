from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database.user_db_manager import get_user_db
from api.routes.auth import (
    AUTH_METHOD_API_KEY,
    get_current_user,
    AuthPrincipal,
    require_authenticated
)
from database.db_services.device_key_binding_service import record_binding
from database.db_models.meta_model import User
from database.db_models.user_models import Device
from database.main_db import get_meta_db
from sqlalchemy.orm import Session
from database.db_services.log_service import create_log
from database.db_services.collection_session_service import (
    create_collection_session,
    get_collection_session_with_details,
    update_collection_session,
    delete_collection_session,
    get_collection_sessions_with_field_info,
    count_collection_sessions_with_field_info,
    get_available_sessions_for_device,
    get_latest_collection_session_by_field,
    auto_complete_expired_sessions,
    _UNSET
)
from api.schemas.collection_session import (
    CollectionSessionCreate,
    CollectionSessionUpdate,
    CollectionSessionResponse,
    CollectionSessionWithFieldResponse
)

# 创建路由器
router = APIRouter(prefix="/collection-sessions", tags=["采集任务管理"])

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

def auto_complete_expired_sessions_safely(db):
    """
    读取采集任务前，先将已超过结束时间的任务置为已完成

    后端调度线程会周期性执行同一逻辑，这里在读取时再兜底一次，
    保证即使调度被禁用，用户看到的状态也是最新的。
    失败不影响正常查询。
    """
    try:
        completed = auto_complete_expired_sessions(db)
        if completed:
            print(f"[API] 自动完成超期采集任务: {completed} 个")
    except Exception as e:
        print(f"[API] 自动完成超期采集任务失败: {str(e)}")

# API 路由定义
@router.post("/", response_model=CollectionSessionWithFieldResponse, summary="创建采集任务")
async def create_session(
    session_data: CollectionSessionCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建新的采集任务/观测会话
    """
    print(f"[API] 收到创建采集任务请求: 农田ID={session_data.field_id}, 任务类型={session_data.mission_type}, 指定设备={session_data.device_id}")
    print(f"[API] 接收到的完整数据: {session_data}")
    print(f"[API] 当前用户: {current_user.username}, ID: {current_user.userid}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        # 创建采集任务（device_id 为空表示不限制设备，所有设备均可执行）
        new_session = create_collection_session(
            db=db,
            field_id=session_data.field_id,
            start_time=session_data.start_time,
            mission_type=session_data.mission_type,
            end_time=session_data.end_time,
            mission_name=session_data.mission_name,
            description=session_data.description,
            weather_snapshot=session_data.weather_snapshot,
            status=session_data.status,
            device_id=session_data.device_id
        )

        # 获取创建后的带有详细信息的采集任务
        session_with_details = get_collection_session_with_details(db, str(new_session.id))

        # 记录操作日志
        try:
            create_log(db, "info", "collection.create",
                       f"用户 {current_user.username} 创建采集任务: {session_data.mission_name or session_data.mission_type}",
                       related_id=str(new_session.id), related_type="collection_session")
        except Exception:
            pass

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
        auto_complete_expired_sessions_safely(db)

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

        auto_complete_expired_sessions_safely(db)

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

@router.get("/field/{field_id}/latest", response_model=CollectionSessionResponse, summary="获取指定农田的最新采集任务")
async def get_latest_session_by_field(
    field_id: str,
    mission_type: Optional[str] = Query(None, description="任务类型过滤"),
    current_user: User = Depends(get_current_user)
):
    """
    获取指定农田的最新采集任务（按开始时间倒序取第一条）

    不存在符合条件的任务时返回 404。
    """
    print(f"[API] 收到获取农田最新采集任务请求: 农田ID={field_id}")

    # 获取用户的数据库会话
    db = get_user_db(str(current_user.userid))

    try:
        auto_complete_expired_sessions_safely(db)

        session = get_latest_collection_session_by_field(
            db=db,
            field_id=field_id,
            mission_type=mission_type
        )

        if not session:
            raise HTTPException(status_code=404, detail="该农田暂无符合条件的采集任务")

        return CollectionSessionResponse(**convert_session_to_dict(session))
    finally:
        db.close()

@router.get("/", response_model=List[CollectionSessionWithFieldResponse], summary="获取采集任务列表（含农田信息）")
async def get_sessions_with_field(
    response: Response,
    limit: int = Query(100, description="返回记录数限制"),
    offset: int = Query(0, description="偏移量"),
    field_id: Optional[str] = Query(None, description="农田ID过滤"),
    device_id: Optional[str] = Query(None, description="指定设备过滤"),
    start_date: Optional[str] = Query(None, description="开始日期过滤 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期过滤 (YYYY-MM-DD)"),
    mission_types: Optional[str] = Query(None, description="任务类型过滤，逗号分隔"),
    status: Optional[str] = Query(None, description="状态过滤"),
    current_user: User = Depends(get_current_user)
):
    """
    获取采集任务列表，包含关联的农田和设备信息

    响应体为任务数组（兼容既有调用方），符合条件的总条数通过响应头 `X-Total-Count` 返回，供分页使用。
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

        auto_complete_expired_sessions_safely(db)

        # 总条数通过响应头返回，保证响应体仍是数组，兼容既有调用方
        total = count_collection_sessions_with_field_info(
            db=db,
            field_id=field_id,
            start_date=start_datetime,
            end_date=end_datetime,
            mission_types=mission_type_list,
            status=status,
            device_id=device_id
        )
        response.headers["X-Total-Count"] = str(total)

        sessions_with_fields = get_collection_sessions_with_field_info(
            db=db,
            limit=limit,
            offset=offset,
            field_id=field_id,
            start_date=start_datetime,
            end_date=end_datetime,
            mission_types=mission_type_list,
            status=status,
            device_id=device_id
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

        # device_id 需区分"未传"（保持原样）与"显式传 null"（取消指定），
        # 因此只在请求体显式包含该字段时才传给 service
        device_id = (
            session_update.device_id
            if "device_id" in session_update.model_fields_set
            else _UNSET
        )

        updated_session = update_collection_session(
            db=db,
            session_id=session_id,
            end_time=session_update.end_time,
            mission_name=session_update.mission_name,
            description=session_update.description,
            weather_snapshot=session_update.weather_snapshot,
            status=session_update.status,
            device_id=device_id
        )

        if not updated_session:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        # 获取更新后的带有详细信息的采集任务
        session_with_details = get_collection_session_with_details(db, session_id)

        # 记录操作日志
        try:
            create_log(db, "info", "collection.update",
                       f"用户 {current_user.username} 更新采集任务: {session_id}",
                       related_id=session_id, related_type="collection_session")
        except Exception:
            pass

        return CollectionSessionWithFieldResponse(**session_with_details)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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

        # user_id 用于一并清理该会话在 MinIO 上的文件
        success = delete_collection_session(
            db, session_id, user_id=str(current_user.userid)
        )

        if not success:
            raise HTTPException(status_code=404, detail="采集任务不存在")

        # 记录操作日志
        try:
            create_log(db, "warning", "collection.delete",
                       f"用户 {current_user.username} 删除采集任务: {session_id}",
                       related_id=session_id, related_type="collection_session")
        except Exception:
            pass

        return {"message": "采集任务删除成功"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        # 删除失败时回滚并暴露原因，避免前端只看到「无响应」
        db.rollback()
        print(f"[API] 删除采集任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除采集任务失败: {str(e)}")
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
        auto_complete_expired_sessions_safely(db)

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

# 远程设备作业通道（JWT 或任意有效 API 密钥）
@router.post("/active_sessions", summary="获取设备可执行的采集任务（云端下发的作业）")
async def get_active_sessions_via_api_key(
    principal: AuthPrincipal = Depends(require_authenticated),
    device_id: Optional[str] = Query(None, description="请求任务的设备ID。不传表示不限制设备"),
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id",
                                        description="请求任务的设备ID，与 device_id 查询参数等价")
):
    """
    根据API密钥获取该设备可执行的采集任务，只返回ID、名称、描述和设备ID

    认证：JWT（Web）或 X-API-Key（任意有效密钥均可）

    权限口径：data_read 只约束「数据（raw_data）读取」接口；
    拉取云端下发的采集任务属于设备作业通道，不占用 data_read 权限。

    下发规则：
    - 任务指定了 device_id：只有该设备能拉到此任务
    - 任务未指定 device_id：所有设备都能拉到此任务

    设备可用 `?device_id=xxx` 或 `X-Device-Id` 请求头标识自己（二者等价）。
    """
    # 设备标识：查询参数与请求头任选其一
    requester_device_id = device_id or x_device_id

    print(f"[API] 收到获取可用采集任务请求: 调用方={principal.describe()}, 设备={requester_device_id}")

    # 认证（JWT 或持有 data_read 权限的 API 密钥）已在依赖中完成
    user = principal.user
    print(f"[API] 认证通过: 用户={user.username}")
    
    # 获取用户的数据库会话
    db = get_user_db(str(user.userid))
    
    try:
        # 校验设备标识，避免设备ID填错时被静默降级为"所有设备可执行"
        if requester_device_id:
            device = db.query(Device).filter(Device.id == requester_device_id).first()
            if not device:
                raise HTTPException(status_code=404, detail=f"设备不存在: {requester_device_id}")

            # 设备用密钥拉取作业时顺带刷新「设备 → 密钥」软关联（与控制授权判定同源）
            if principal.auth_method == AUTH_METHOD_API_KEY and principal.api_key_id:
                record_binding(
                    db,
                    device_id=requester_device_id,
                    api_key_id=principal.api_key_id,
                    api_key_name=principal.api_key_name,
                    source="active_sessions"
                )

        # 只返回该设备可执行的运行中任务
        sessions_with_info = get_available_sessions_for_device(
            db=db,
            device_id=requester_device_id,
            status="running",
            limit=100,
            offset=0
        )

        # 只返回ID、名称和描述（附带 device_id 便于设备确认任务归属）
        result = []
        for session in sessions_with_info:
            result.append({
                "id": session["id"],
                "mission_name": session["mission_name"],
                "description": session["description"],
                "device_id": session["device_id"]
            })
        
        print(f"[API] 找到 {len(result)} 个可执行的采集任务")
        return result
    finally:
        db.close()
