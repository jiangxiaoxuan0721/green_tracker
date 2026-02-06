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
    device_id: Optional[str] = None,
    device_display_name: Optional[str] = None,
    field_id: Optional[str] = None,
    field_display_name: Optional[str] = None,
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
        device_id: 设备ID
        device_display_name: 设备显示名称
        field_id: 农田ID
        field_display_name: 农田显示名称
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
            device_id=uuid.UUID(device_id) if device_id and isinstance(device_id, str) else device_id,
            field_id=uuid.UUID(field_id) if field_id and isinstance(field_id, str) else field_id,
            data_subtype=data_subtype,
            data_unit=data_unit,
            data_format=data_format,
            bucket_name=bucket_name,
            object_key=object_key,
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

        # 如果有位置信息，设置几何点
        if location_geom:
            new_raw_data.location_geom = location_geom

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
            "session_id": str(raw_data.session_id) if raw_data.session_id else None,
            "device_id": str(raw_data.device_id) if raw_data.device_id else None,
            "field_id": str(raw_data.field_id) if raw_data.field_id else None,
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
            "capture_time": raw_data.capture_time.isoformat() if raw_data.capture_time else None,
            "created_at": raw_data.created_at.isoformat() if raw_data.created_at else None,
            "updated_at": raw_data.updated_at.isoformat() if raw_data.updated_at else None
        }
    except Exception as e:
        print(f"[后端RawDataService] 获取原始数据详情失败: {str(e)}")
        return None


def get_raw_data_list_for_frontend(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    device_id: Optional[str] = None,
    field_id: Optional[str] = None,
    data_type: Optional[str] = None,
    data_subtype: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    获取原始数据列表（前端展示）

    Args:
        db: 数据库会话
        page: 页码
        page_size: 每页数量
        device_id: 设备ID过滤
        field_id: 农田ID过滤
        data_type: 数据类型过滤
        data_subtype: 数据子类型过滤
        start_time: 开始时间过滤
        end_time: 结束时间过滤

    Returns:
        Dict[str, Any]: 分页数据列表和分页信息
    """
    # 构建查询
    query = db.query(RawData)

    # 添加过滤条件
    if device_id:
        try:
            device_uuid = uuid.UUID(device_id) if isinstance(device_id, str) else device_id
            query = query.filter(RawData.device_id == device_uuid)
        except ValueError:
            print(f"[后端RawDataService] 无效的设备UUID格式: {device_id}")
            return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_count": 0, "total_pages": 0}}

    if field_id:
        try:
            field_uuid = uuid.UUID(field_id) if isinstance(field_id, str) else field_id
            query = query.filter(RawData.field_id == field_uuid)
        except ValueError:
            print(f"[后端RawDataService] 无效的地块UUID格式: {field_id}")
            return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_count": 0, "total_pages": 0}}

    if data_type:
        query = query.filter(RawData.data_type == data_type)

    if data_subtype:
        query = query.filter(RawData.data_subtype == data_subtype)

    if start_time:
        query = query.filter(RawData.capture_time >= start_time)

    if end_time:
        query = query.filter(RawData.capture_time <= end_time)

    # 计算总数
    total_count = query.count()

    # 分页
    offset = (page - 1) * page_size
    raw_data_list = query.order_by(desc(RawData.capture_time)).offset(offset).limit(page_size).all()

    # 转换为前端显示格式
    items = []
    for item in raw_data_list:
        # 获取设备名称
        device_name = None
        if item.device:
            device_name = item.device.name

        # 获取农田名称
        field_name = None
        if item.field:
            field_name = item.field.name

        # 根据数据类型显示不同的值
        if item.data_type == "image":
            # 图像显示缩略图
            display_value = f"/api/raw-data/{item.id}/thumbnail"
        elif item.data_unit:
            # 数值类型添加单位
            display_value = f"{item.data_value} {item.data_unit}"
        else:
            display_value = item.data_value

        items.append({
            "id": str(item.id),
            "device_name": device_name or "未知设备",
            "field_name": field_name or "未知农田",
            "data_type": item.data_type,
            "data_value": display_value,
            "capture_time": item.capture_time.isoformat() if item.capture_time else None,
            "processing_status": item.processing_status,
            "ai_status": item.ai_status,
            "is_valid": item.is_valid
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
            "created_at": tag.created_at.isoformat() if tag.created_at else None
        }
        for tag in tags
    ]
