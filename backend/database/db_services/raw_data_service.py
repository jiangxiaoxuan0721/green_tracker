"""
原始数据服务模块
提供原始数据的增删改查功能

注意：每个用户有独立的数据库，因此不需要 user_id 过滤
"""

from sqlalchemy import and_, or_, func, desc, asc
from sqlalchemy.orm import Session
from database.db_models.user_models import RawData, RawDataTag, CollectionSession
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

def create_raw_data(
    db: Session,
    session_id: str,
    data_type: str,
    data_value: str,
    capture_time: Optional[datetime] = None,
    data_subtype: Optional[str] = None,
    data_unit: Optional[str] = None,
    data_format: Optional[str] = None,
    bucket_name: Optional[str] = None,
    object_key: Optional[str] = None,
    location_geom: Optional[str] = None,
    altitude_m: Optional[float] = None,
    heading: Optional[float] = None,
    sensor_meta: Optional[Dict[str, Any]] = None,
    file_meta: Optional[Dict[str, Any]] = None,
    acquisition_meta: Optional[Dict[str, Any]] = None,
    quality_score: Optional[float] = None,
    quality_flags: Optional[List[str]] = None,
    checksum: Optional[str] = None,
    is_valid: Optional[bool] = True,
    validation_notes: Optional[str] = None
) -> Optional[str]:
    """
    创建新的原始数据记录

    Args:
        db: 数据库会话
        session_id: 采集会话ID
        data_type: 数据类型
        data_value: 数据值
        capture_time: 采集时间
        data_subtype: 数据子类型
        data_unit: 数据单位
        data_format: 数据格式
        bucket_name: MinIO bucket名称
        object_key: MinIO对象路径
        location_geom: 位置几何信息
        altitude_m: 采集高度
        heading: 朝向
        sensor_meta: 传感器元数据
        file_meta: 文件元数据
        acquisition_meta: 采集元数据
        quality_score: 质量评分
        quality_flags: 质量标记
        checksum: 文件校验值
        is_valid: 是否有效
        validation_notes: 验证备注

    Returns:
        str: 创建的原始数据ID，失败返回None
    """
    print(f"[后端RawDataService] 创建原始数据: 类型={data_type}")

    try:
        new_raw_data = RawData(
            session_id=uuid.UUID(session_id) if isinstance(session_id, str) else session_id,
            data_type=data_type,
            data_value=data_value,
            capture_time=capture_time or datetime.now(),
            data_subtype=data_subtype,
            data_unit=data_unit,
            data_format=data_format,
            bucket_name=bucket_name,
            object_key=object_key,
            location_geom=location_geom,
            altitude_m=altitude_m,
            heading=heading,
            sensor_meta=sensor_meta,
            file_meta=file_meta,
            acquisition_meta=acquisition_meta,
            quality_score=quality_score,
            quality_flags=quality_flags,
            checksum=checksum,
            is_valid=is_valid,
            validation_notes=validation_notes
        )

        db.add(new_raw_data)
        db.commit()
        db.refresh(new_raw_data)

        print(f"[后端RawDataService] 成功创建原始数据，ID={new_raw_data.id}")
        return str(new_raw_data.id)

    except Exception as e:
        print(f"[后端RawDataService] 创建原始数据失败: {str(e)}")
        db.rollback()
        return None


def get_raw_data_by_id(db: Session, raw_data_id: str) -> Optional[Dict[str, Any]]:
    """
    根据ID获取原始数据详情

    Args:
        db: 数据库会话
        raw_data_id: 原始数据ID

    Returns:
        Dict[str, Any]: 原始数据详情，如果不存在则返回None
    """
    # 添加错误处理，确保ID是有效的UUID
    try:
        # 如果是字符串，尝试转换为UUID
        if isinstance(raw_data_id, str):
            # 检查是否是有效的UUID格式
            try:
                raw_data_uuid = uuid.UUID(raw_data_id)
            except ValueError:
                print(f"[后端RawDataService] 无效的UUID格式: {raw_data_id}")
                return None
        else:
            raw_data_uuid = raw_data_id

        raw_data = db.query(RawData).filter(RawData.id == raw_data_uuid).first()

        if not raw_data:
            return None

        return {
            "id": str(raw_data.id),
            "session_id": str(raw_data.session_id) if raw_data.session_id is not None else None,
            "data_type": raw_data.data_type,
            "data_subtype": raw_data.data_subtype,
            "data_unit": raw_data.data_unit,
            "data_value": raw_data.data_value,
            "data_format": raw_data.data_format,
            "bucket_name": raw_data.bucket_name,
            "object_key": raw_data.object_key,
            "altitude_m": raw_data.altitude_m,
            "heading": raw_data.heading,
            "sensor_meta": raw_data.sensor_meta,
            "file_meta": raw_data.file_meta,
            "acquisition_meta": raw_data.acquisition_meta,
            "quality_score": raw_data.quality_score,
            "quality_flags": raw_data.quality_flags,
            "checksum": raw_data.checksum,
            "is_valid": raw_data.is_valid,
            "validation_notes": raw_data.validation_notes,
            "processing_status": raw_data.processing_status,
            "ai_status": raw_data.ai_status,
            "capture_time": raw_data.capture_time.isoformat() if raw_data.capture_time is not None else None,
            "created_at": raw_data.created_at.isoformat() if raw_data.created_at is not None else None,
            "updated_at": raw_data.updated_at.isoformat() if raw_data.updated_at is not None else None
        }
    except Exception as e:
        print(f"[后端RawDataService] 获取原始数据详情失败: {str(e)}")
        return None


def get_raw_data_list_for_frontend(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    session_id: Optional[str] = None,
    data_type: Optional[str] = None,
    data_subtype: Optional[str] = None
) -> Dict[str, Any]:
    """
    获取原始数据列表（前端展示）

    Args:
        db: 数据库会话
        page: 页码
        page_size: 每页数量
        session_id: 会话ID过滤
        data_type: 数据类型过滤
        data_subtype: 数据子类型过滤

    Returns:
        Dict[str, Any]: 分页数据列表和分页信息
    """
    # 构建查询，包含关联的会话信息
    query = db.query(RawData, CollectionSession).outerjoin(
        CollectionSession, RawData.session_id == CollectionSession.id
    )

    # 添加过滤条件
    if session_id:
        try:
            # 确保session_id是字符串格式进行匹配
            session_str = str(session_id)
            query = query.filter(RawData.session_id == session_str)
        except Exception as e:
            print(f"[后端RawDataService] 处理会话ID时出错: {session_id}, 错误: {e}")
            return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_count": 0, "total_pages": 0}}

    if data_type:
        query = query.filter(RawData.data_type == data_type)

    if data_subtype:
        query = query.filter(RawData.data_subtype == data_subtype)

    # 计算总数
    total_count = query.count()

    # 分页
    offset = (page - 1) * page_size
    raw_data_list = query.order_by(desc(RawData.capture_time)).offset(offset).limit(page_size).all()

    # 转换为前端显示格式
    items = []
    for item in raw_data_list:
        # 由于现在使用关联查询，item可能是元组(RawData, CollectionSession)
        if isinstance(item, tuple):
            raw_data_item = item[0]
            session_item = item[1]
        else:
            raw_data_item = item
            session_item = None

        # 构建会话信息
        session_info = None
        if session_item:
            session_info = {
                "id": str(session_item.id),
                "mission_name": session_item.mission_name,
                "mission_type": session_item.mission_type
            }

        # 根据数据类型显示不同的值
        if raw_data_item.data_type == "image":
            # 图像显示缩略图
            display_value = f"/api/raw-data/{raw_data_item.id}/thumbnail"
        elif raw_data_item.data_unit and raw_data_item.data_value:
            # 数值类型添加单位
            display_value = f"{raw_data_item.data_value} {raw_data_item.data_unit}"
        else:
            display_value = raw_data_item.data_value or ""

        items.append({
            "id": str(raw_data_item.id),
            "session": session_info,
            "data_type": raw_data_item.data_type,
            "data_subtype": raw_data_item.data_subtype,
            "data_value": display_value,
            "data_format": raw_data_item.data_format,
            "quality_score": raw_data_item.quality_score,
            "capture_time": raw_data_item.capture_time.isoformat() if raw_data_item.capture_time is not None else None,
            "is_valid": raw_data_item.is_valid
        })

    # 构建分页信息
    total_pages = (total_count + page_size - 1) // page_size

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


def update_processing_status(db: Session, raw_data_id: str, processing_status: str) -> bool:
    """
    更新原始数据处理状态

    Args:
        db: 数据库会话
        raw_data_id: 原始数据ID
        processing_status: 处理状态

    Returns:
        bool: 更新是否成功
    """
    try:
        # 添加错误处理，确保ID是有效的UUID
        if isinstance(raw_data_id, str):
            try:
                raw_data_uuid = uuid.UUID(raw_data_id)
            except ValueError:
                print(f"[后端RawDataService] 无效的UUID格式: {raw_data_id}")
                return False
        else:
            raw_data_uuid = raw_data_id

        affected_rows = db.query(RawData).filter(
            RawData.id == raw_data_uuid
        ).update({"processing_status": processing_status})

        db.commit()
        return affected_rows > 0
    except Exception as e:
        print(f"[后端RawDataService] 更新处理状态失败: {str(e)}")
        db.rollback()
        return False


def update_ai_status(db: Session, raw_data_id: str, ai_status: str) -> bool:
    """
    更新原始数据AI分析状态

    Args:
        db: 数据库会话
        raw_data_id: 原始数据ID
        ai_status: AI分析状态

    Returns:
        bool: 更新是否成功
    """
    try:
        # 添加错误处理，确保ID是有效的UUID
        if isinstance(raw_data_id, str):
            try:
                raw_data_uuid = uuid.UUID(raw_data_id)
            except ValueError:
                print(f"[后端RawDataService] 无效的UUID格式: {raw_data_id}")
                return False
        else:
            raw_data_uuid = raw_data_id

        affected_rows = db.query(RawData).filter(
            RawData.id == raw_data_uuid
        ).update({"ai_status": ai_status})

        db.commit()
        return affected_rows > 0
    except Exception as e:
        print(f"[后端RawDataService] 更新AI状态失败: {str(e)}")
        db.rollback()
        return False


def delete_raw_data(db: Session, raw_data_id: str) -> bool:
    """
    删除原始数据

    Args:
        db: 数据库会话
        raw_data_id: 原始数据ID

    Returns:
        bool: 删除是否成功
    """
    try:
        # 添加错误处理，确保ID是有效的UUID
        if isinstance(raw_data_id, str):
            try:
                raw_data_uuid = uuid.UUID(raw_data_id)
            except ValueError:
                print(f"[后端RawDataService] 无效的UUID格式: {raw_data_id}")
                return False
        else:
            raw_data_uuid = raw_data_id

        # 先删除关联的标签
        db.query(RawDataTag).filter(
            RawDataTag.raw_data_id == raw_data_uuid
        ).delete()

        # 再删除原始数据
        affected_rows = db.query(RawData).filter(
            RawData.id == raw_data_uuid
        ).delete()

        db.commit()
        return affected_rows > 0
    except Exception as e:
        print(f"[后端RawDataService] 删除原始数据失败: {str(e)}")
        db.rollback()
        return False


def add_raw_data_tag(
    db: Session,
    raw_data_id: str,
    tag_category: str,
    tag_value: str,
    confidence: Optional[float] = None,
    source: str = "manual"
) -> Optional[str]:
    """
    为原始数据添加标签

    Args:
        db: 数据库会话
        raw_data_id: 原始数据ID
        tag_category: 标签类别
        tag_value: 标签值
        confidence: 置信度
        source: 标签来源

    Returns:
        str: 创建的标签ID，失败返回None
    """
    try:
        # 添加错误处理，确保ID是有效的UUID
        if isinstance(raw_data_id, str):
            try:
                raw_data_uuid = uuid.UUID(raw_data_id)
            except ValueError:
                print(f"[后端RawDataService] 无效的UUID格式: {raw_data_id}")
                return None
        else:
            raw_data_uuid = raw_data_id

        new_tag = RawDataTag(
            raw_data_id=raw_data_uuid,
            tag_category=tag_category,
            tag_value=tag_value,
            confidence=confidence,
            source=source
        )

        db.add(new_tag)
        db.commit()
        db.refresh(new_tag)

        return str(new_tag.id)
    except Exception as e:
        print(f"[后端RawDataService] 添加标签失败: {str(e)}")
        db.rollback()
        return None


def get_raw_data_tags(db: Session, raw_data_id: str) -> List[Dict[str, Any]]:
    """
    获取原始数据的所有标签

    Args:
        db: 数据库会话
        raw_data_id: 原始数据ID

    Returns:
        List[Dict[str, Any]]: 标签列表
    """
    # 添加错误处理，确保ID是有效的UUID
    try:
        if isinstance(raw_data_id, str):
            try:
                raw_data_uuid = uuid.UUID(raw_data_id)
            except ValueError:
                print(f"[后端RawDataService] 无效的UUID格式: {raw_data_id}")
                return []
        else:
            raw_data_uuid = raw_data_id

        tags = db.query(RawDataTag).filter(
            RawDataTag.raw_data_id == raw_data_uuid
        ).all()
    except Exception as e:
        print(f"[后端RawDataService] 获取标签失败: {str(e)}")
        return []

    return [
        {
            "id": str(tag.id),
            "tag_category": tag.tag_category,
            "tag_value": tag.tag_value,
            "confidence": tag.confidence,
            "source": tag.source,
            "created_at": tag.created_at.isoformat() if tag.created_at is not None else None
        }
        for tag in tags
    ]


def get_session_data_types(db: Session, session_id: str, data_type: Optional[str] = None) -> Dict[str, Any]:
    """
    获取指定会话中可用的数据类型和子类型

    Args:
        db: 数据库会话
        session_id: 会话ID
        data_type: 可选的数据类型过滤，用于过滤子类型

    Returns:
        Dict[str, Any]: 包含dataTypes和dataSubtypes的字典
    """
    try:
        # 确保session_id是字符串格式进行匹配
        session_str = str(session_id)

        # 查询该会话中的所有数据类型和子类型
        data_types = db.query(RawData.data_type).filter(
            RawData.session_id == session_str,
            RawData.is_valid == True
        ).distinct().all()

        # 构建子类型查询
        subtypes_query = db.query(RawData.data_subtype).filter(
            RawData.session_id == session_str,
            RawData.is_valid == True,
            RawData.data_subtype.isnot(None),
            RawData.data_subtype != ""
        )
        
        # 如果指定了数据类型，添加过滤条件
        if data_type and data_type != 'all':
            subtypes_query = subtypes_query.filter(RawData.data_type == data_type)
            
        data_subtypes = subtypes_query.distinct().all()

        # 转换为列表格式
        data_types_list = [{"value": dt[0], "label": dt[0]} for dt in data_types if dt[0]]
        data_subtypes_list = [{"value": dst[0], "label": dst[0]} for dst in data_subtypes if dst[0]]

        return {
            "dataTypes": data_types_list,
            "dataSubtypes": data_subtypes_list
        }

    except Exception as e:
        print(f"[后端RawDataService] 获取会话数据类型失败: {str(e)}")
        return {"dataTypes": [], "dataSubtypes": []}
