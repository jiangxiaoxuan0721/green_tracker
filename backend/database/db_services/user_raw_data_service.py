"""
用户原始数据服务模块
处理用户特定的原始数据表操作
"""

import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
from database.db_models.user_models import RawData, RawDataTag
from database.user_db_manager import get_user_db


def add_raw_data(
    user_id: str,
    session_id: str,
    data_type: str,
    data_value: str,
    capture_time,
    device_id: str = None,
    device_display_name: str = None,
    field_id: str = None,
    field_display_name: str = None,
    data_subtype: str = None,
    data_unit: str = None,
    data_format: str = None,
    bucket_name: str = None,
    object_key: str = None,
    location_geom = None,
    altitude_m: float = None,
    heading: float = None,
    sensor_meta: Dict[str, Any] = None,
    file_meta: Dict[str, Any] = None,
    acquisition_meta: Dict[str, Any] = None,
    quality_score: float = None,
    quality_flags: List[str] = None,
    checksum: str = None,
    is_valid: bool = True,
    validation_notes: str = None
) -> Optional[str]:
    """
    添加原始数据

    Args:
        user_id: 用户ID
        session_id: 采集会话ID
        data_type: 数据类型 (image/video/environmental/soil/multi_spectral)
        data_value: 数据值（图像类型为MinIO存储位置，其他为测量值）
        capture_time: 采集时间
        device_id: 设备ID
        device_display_name: 设备前端显示名称（已废弃，保留兼容性）
        field_id: 地块ID
        field_display_name: 地块前端显示名称（已废弃，保留兼容性）
        data_subtype: 数据子类型 (temperature/humidity/ph/light/ndvi/rgb等)
        data_unit: 数据单位 (°C/%/ppm/lux等)
        data_format: 数据格式 (jpg/png/csv/json等)
        bucket_name: MinIO bucket名称（仅图像数据需要）
        object_key: MinIO对象路径（仅图像数据需要）
        location_geom: 位置几何信息 (WKT格式: 'POINT(lng lat)')
        altitude_m: 采集高度
        heading: 朝向
        sensor_meta: 传感器元数据
        file_meta: 文件元数据
        acquisition_meta: 采集元数据
        quality_score: 质量评分
        quality_flags: 质量标记数组
        checksum: 校验值
        is_valid: 是否有效
        validation_notes: 验证备注

    Returns:
        str: 创建的原始数据ID，失败返回None
    """
    try:
        db = get_user_db(user_id)

        # 创建新的原始数据记录
        new_data = RawData(
            id=str(uuid.uuid4()),
            session_id=session_id,
            device_id=device_id,
            field_id=field_id,
            data_type=data_type,
            data_subtype=data_subtype,
            data_unit=data_unit,
            data_value=data_value,
            data_format=data_format,
            bucket_name=bucket_name,
            object_key=object_key,
            capture_time=capture_time,
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

        # 处理几何数据 (从WKT格式转换为PostGIS几何对象)
        if location_geom:
            from geoalchemy2 import functions
            new_data.location_geom = functions.ST_GeomFromText(location_geom, 4326)

        db.add(new_data)
        db.commit()
        db.refresh(new_data)

        return new_data.id

    except Exception as e:
        print(f"添加原始数据失败: {e}")
        return None
    finally:
        if 'db' in locals():
            db.close()


def get_raw_data_by_id(user_id: str, raw_data_id: str) -> Optional[Dict[str, Any]]:
    """
    根据ID获取原始数据

    Args:
        user_id: 用户ID
        raw_data_id: 原始数据ID

    Returns:
        Dict: 原始数据信息，不存在返回None
    """
    try:
        db = get_user_db(user_id)

        raw_data = db.query(RawData).filter(RawData.id == raw_data_id).first()

        if not raw_data:
            return None

        # 转换为字典
        result = {
            'id': raw_data.id,
            'session_id': raw_data.session_id,
            'device_id': raw_data.device_id,
            'field_id': raw_data.field_id,
            'data_type': raw_data.data_type,
            'data_subtype': raw_data.data_subtype,
            'data_unit': raw_data.data_unit,
            'data_value': raw_data.data_value,
            'data_format': raw_data.data_format,
            'bucket_name': raw_data.bucket_name,
            'object_key': raw_data.object_key,
            'capture_time': raw_data.capture_time.isoformat() if raw_data.capture_time else None,
            'location_text': None,
            'altitude_m': raw_data.altitude_m,
            'heading': raw_data.heading,
            'sensor_meta': raw_data.sensor_meta,
            'file_meta': raw_data.file_meta,
            'acquisition_meta': raw_data.acquisition_meta,
            'quality_score': raw_data.quality_score,
            'quality_flags': raw_data.quality_flags,
            'checksum': raw_data.checksum,
            'is_valid': raw_data.is_valid,
            'validation_notes': raw_data.validation_notes,
            'processing_status': raw_data.processing_status,
            'ai_status': raw_data.ai_status
        }

        # 处理几何数据
        if raw_data.location_geom:
            from geoalchemy2 import functions
            location_text = db.execute(
                text("SELECT ST_AsText(:geom)"),
                {'geom': raw_data.location_geom}
            ).scalar()
            result['location_text'] = location_text

        # 根据数据类型处理显示值
        if raw_data.data_type in ['image', 'video', 'multi_spectral']:
            if raw_data.bucket_name and raw_data.object_key:
                result['display_value'] = f"minio://{raw_data.bucket_name}/{raw_data.object_key}"
            else:
                result['display_value'] = raw_data.data_value
        else:
            if raw_data.data_unit:
                result['display_value'] = f"{raw_data.data_value} {raw_data.data_unit}"
            else:
                result['display_value'] = raw_data.data_value

        return result

    except Exception as e:
        print(f"获取原始数据失败: {e}")
        return None
    finally:
        if 'db' in locals():
            db.close()


def get_raw_data_by_session(user_id: str, session_id: str) -> List[Dict[str, Any]]:
    """
    根据会话ID获取原始数据列表

    Args:
        user_id: 用户ID
        session_id: 采集会话ID

    Returns:
        List[Dict]: 原始数据列表
    """
    try:
        db = get_user_db(user_id)

        raw_data_list = db.query(RawData).filter(
            RawData.session_id == session_id
        ).order_by(RawData.capture_time.desc()).all()

        # 转换为字典列表
        results = []
        for data in raw_data_list:
            result = {
                'id': data.id,
                'data_type': data.data_type,
                'data_value': data.data_value,
                'capture_time': data.capture_time.isoformat() if data.capture_time else None,
                'location_text': None
            }

            # 处理几何数据
            if data.location_geom:
                from geoalchemy2 import functions
                location_text = db.execute(
                    text("SELECT ST_AsText(:geom)"),
                    {'geom': data.location_geom}
                ).scalar()
                result['location_text'] = location_text

            results.append(result)

        return results

    except Exception as e:
        print(f"获取原始数据列表失败: {e}")
        return []
    finally:
        if 'db' in locals():
            db.close()


def get_raw_data_by_time_range(
    user_id: str,
    start_time,
    end_time,
    data_type: str = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    根据时间范围获取原始数据

    Args:
        user_id: 用户ID
        start_time: 开始时间
        end_time: 结束时间
        data_type: 数据类型（可选）
        limit: 返回结果数量限制

    Returns:
        List[Dict]: 原始数据列表
    """
    try:
        db = get_user_db(user_id)

        query = db.query(RawData).filter(
            RawData.capture_time >= start_time,
            RawData.capture_time <= end_time
        )

        if data_type:
            query = query.filter(RawData.data_type == data_type)

        raw_data_list = query.order_by(RawData.capture_time.desc()).limit(limit).all()

        # 转换为字典列表
        return [data_to_dict(data) for data in raw_data_list]

    except Exception as e:
        print(f"获取时间范围原始数据失败: {e}")
        return []
    finally:
        if 'db' in locals():
            db.close()


def get_raw_data_by_location(
    user_id: str,
    longitude: float,
    latitude: float,
    radius_meters: float = 100,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    根据位置获取原始数据

    Args:
        user_id: 用户ID
        longitude: 经度
        latitude: 纬度
        radius_meters: 搜索半径（米）
        limit: 返回结果数量限制

    Returns:
        List[Dict]: 原始数据列表
    """
    try:
        db = get_user_db(user_id)

        # 使用 PostGIS 的 ST_DWithin 进行空间查询
        query = text("""
            SELECT *, ST_AsText(location_geom) as location_text,
                   ST_Distance(location_geom::geography,
                              ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) as distance_m
            FROM raw_data
            WHERE ST_DWithin(
                location_geom::geography,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                :radius_meters
            )
            ORDER BY distance_m
            LIMIT :limit
        """)

        results = db.execute(query, {
            'longitude': longitude,
            'latitude': latitude,
            'radius_meters': radius_meters,
            'limit': limit
        }).fetchall()

        # 转换为字典列表
        return [dict(row) for row in results]

    except Exception as e:
        print(f"获取位置原始数据失败: {e}")
        return []
    finally:
        if 'db' in locals():
            db.close()


def update_processing_status(user_id: str, raw_data_id: str, status: str) -> bool:
    """
    更新原始数据处理状态

    Args:
        user_id: 用户ID
        raw_data_id: 原始数据ID
        status: 新状态

    Returns:
        bool: 更新是否成功
    """
    try:
        db = get_user_db(user_id)

        raw_data = db.query(RawData).filter(RawData.id == raw_data_id).first()
        if not raw_data:
            return False

        raw_data.processing_status = status
        if status == 'completed':
            from datetime import datetime
            raw_data.processed_at = datetime.utcnow()

        db.commit()
        return True

    except Exception as e:
        print(f"更新处理状态失败: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


def update_ai_status(user_id: str, raw_data_id: str, status: str) -> bool:
    """
    更新原始数据AI分析状态

    Args:
        user_id: 用户ID
        raw_data_id: 原始数据ID
        status: 新状态

    Returns:
        bool: 更新是否成功
    """
    try:
        db = get_user_db(user_id)

        raw_data = db.query(RawData).filter(RawData.id == raw_data_id).first()
        if not raw_data:
            return False

        raw_data.ai_status = status
        if status == 'completed':
            from datetime import datetime
            raw_data.ai_analyzed_at = datetime.utcnow()

        db.commit()
        return True

    except Exception as e:
        print(f"更新AI状态失败: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


def add_raw_data_tag(
    user_id: str,
    raw_data_id: str,
    tag_category: str,
    tag_value: str,
    confidence: float = None,
    source: str = "manual"
) -> Optional[str]:
    """
    添加原始数据标签

    Args:
        user_id: 用户ID
        raw_data_id: 原始数据ID
        tag_category: 标签类别
        tag_value: 标签值
        confidence: 置信度
        source: 标签来源

    Returns:
        str: 创建的标签ID，失败返回None
    """
    try:
        db = get_user_db(user_id)

        # 创建新的标签
        new_tag = RawDataTag(
            id=str(uuid.uuid4()),
            raw_data_id=raw_data_id,
            tag_category=tag_category,
            tag_value=tag_value,
            confidence=confidence,
            source=source
        )

        db.add(new_tag)
        db.commit()
        db.refresh(new_tag)

        return new_tag.id

    except Exception as e:
        print(f"添加原始数据标签失败: {e}")
        return None
    finally:
        if 'db' in locals():
            db.close()


def delete_raw_data(user_id: str, raw_data_id: str) -> bool:
    """
    删除原始数据

    Args:
        user_id: 用户ID
        raw_data_id: 原始数据ID

    Returns:
        bool: 删除是否成功
    """
    try:
        db = get_user_db(user_id)

        raw_data = db.query(RawData).filter(RawData.id == raw_data_id).first()
        if not raw_data:
            return False

        db.delete(raw_data)
        db.commit()
        return True

    except Exception as e:
        print(f"删除原始数据失败: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


def get_raw_data_tags(user_id: str, raw_data_id: str) -> List[Dict[str, Any]]:
    """
    获取原始数据的所有标签

    Args:
        user_id: 用户ID
        raw_data_id: 原始数据ID

    Returns:
        List[Dict]: 标签列表
    """
    try:
        db = get_user_db(user_id)

        tags = db.query(RawDataTag).filter(
            RawDataTag.raw_data_id == raw_data_id
        ).order_by(RawDataTag.created_at.desc()).all()

        # 转换为字典列表
        results = []
        for tag in tags:
            results.append({
                'id': tag.id,
                'raw_data_id': tag.raw_data_id,
                'tag_category': tag.tag_category,
                'tag_value': tag.tag_value,
                'confidence': tag.confidence,
                'source': tag.source,
                'created_at': tag.created_at.isoformat() if tag.created_at else None
            })

        return results

    except Exception as e:
        print(f"获取原始数据标签失败: {e}")
        return []
    finally:
        if 'db' in locals():
            db.close()


def get_raw_data_list_for_frontend(
    user_id: str,
    page: int = 1,
    page_size: int = 20,
    device_id: str = None,
    field_id: str = None,
    data_type: str = None,
    data_subtype: str = None,
    start_time = None,
    end_time = None
) -> Dict[str, Any]:
    """
    获取前端列表显示的原始数据

    Args:
        user_id: 用户ID
        page: 页码
        page_size: 每页数量
        device_id: 设备ID过滤
        field_id: 地块ID过滤
        data_type: 数据类型过滤
        data_subtype: 数据子类型过滤
        start_time: 开始时间过滤
        end_time: 结束时间过滤

    Returns:
        Dict: 包含分页信息和数据列表的字典
    """
    try:
        db = get_user_db(user_id)

        # 构建查询
        query = db.query(RawData)

        # 添加过滤条件
        if device_id:
            query = query.filter(RawData.device_id == device_id)

        if field_id:
            query = query.filter(RawData.field_id == field_id)

        if data_type:
            query = query.filter(RawData.data_type == data_type)

        if data_subtype:
            query = query.filter(RawData.data_subtype == data_subtype)

        if start_time:
            query = query.filter(RawData.capture_time >= start_time)

        if end_time:
            query = query.filter(RawData.capture_time <= end_time)

        # 获取总数
        total = query.count()

        # 获取数据
        offset = (page - 1) * page_size
        raw_data_list = query.order_by(
            RawData.capture_time.desc()
        ).offset(offset).limit(page_size).all()

        # 处理数据
        items = []
        for data in raw_data_list:
            item = {
                'id': data.id,
                'device_display_name': None,  # 需要通过关联查询获取
                'field_display_name': None,   # 需要通过关联查询获取
                'data_type': data.data_type,
                'data_subtype': data.data_subtype,
                'data_value': data.data_value,
                'data_unit': data.data_unit,
                'data_format': data.data_format,
                'capture_time': data.capture_time.isoformat() if data.capture_time else None,
                'is_valid': data.is_valid,
                'processing_status': data.processing_status,
                'ai_status': data.ai_status
            }

            # 根据数据类型处理显示值
            if data.data_type in ['image', 'video', 'multi_spectral']:
                item['display_value'] = data.data_value
            else:
                if data.data_unit:
                    item['display_value'] = f"{data.data_value} {data.data_unit}"
                else:
                    item['display_value'] = data.data_value

            items.append(item)

        return {
            'total': total,
            'page': page,
            'page_size': page_size,
            'items': items
        }

    except Exception as e:
        print(f"获取前端原始数据列表失败: {e}")
        return {
            'total': 0,
            'page': page,
            'page_size': page_size,
            'items': []
        }
    finally:
        if 'db' in locals():
            db.close()


def data_to_dict(raw_data: RawData) -> Dict[str, Any]:
    """
    将 RawData 对象转换为字典

    Args:
        raw_data: RawData 对象

    Returns:
        Dict: 字典
    """
    return {
        'id': raw_data.id,
        'session_id': raw_data.session_id,
        'device_id': raw_data.device_id,
        'field_id': raw_data.field_id,
        'data_type': raw_data.data_type,
        'data_subtype': raw_data.data_subtype,
        'data_unit': raw_data.data_unit,
        'data_value': raw_data.data_value,
        'data_format': raw_data.data_format,
        'bucket_name': raw_data.bucket_name,
        'object_key': raw_data.object_key,
        'capture_time': raw_data.capture_time.isoformat() if raw_data.capture_time else None,
        'altitude_m': raw_data.altitude_m,
        'heading': raw_data.heading,
        'sensor_meta': raw_data.sensor_meta,
        'file_meta': raw_data.file_meta,
        'acquisition_meta': raw_data.acquisition_meta,
        'quality_score': raw_data.quality_score,
        'quality_flags': raw_data.quality_flags,
        'checksum': raw_data.checksum,
        'is_valid': raw_data.is_valid,
        'validation_notes': raw_data.validation_notes,
        'processing_status': raw_data.processing_status,
        'ai_status': raw_data.ai_status
    }
