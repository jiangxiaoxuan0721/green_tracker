"""
用户原始数据服务模块
处理用户特定的原始数据表操作
"""

import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from database.db_builder.user_raw_data_table import (
    create_user_raw_data_tables, 
    get_user_table_name, 
    create_user_indexes,
    drop_user_tables
)
from database.db_models.meta_model import User


def init_user_raw_data_tables(userid: str) -> bool:
    """
    为用户初始化原始数据表
    
    Args:
        userid: 用户ID
    
    Returns:
        bool: 初始化是否成功
    """
    try:
        from database.main_db import engine
        
        # 创建表
        tables = create_user_raw_data_tables(userid)
        
        # 在数据库中创建表结构
        for table_name, table_class in tables.items():
            table_class.__table__.create(engine, checkfirst=True)
            print(f"已创建表: {table_class.__tablename__}")
        
        # 创建索引
        create_user_indexes(engine, userid)
        
        return True
    except Exception as e:
        print(f"初始化用户原始数据表失败: {e}")
        return False


def remove_user_raw_data_tables(userid: str) -> bool:
    """
    删除用户的原始数据表
    
    Args:
        userid: 用户ID
    
    Returns:
        bool: 删除是否成功
    """
    try:
        from database.main_db import engine
        drop_user_tables(engine, userid)
        return True
    except Exception as e:
        print(f"删除用户原始数据表失败: {e}")
        return False


def add_raw_data(
    userid: str,
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
        userid: 用户ID
        session_id: 采集会话ID
        data_type: 数据类型 (image/video/environmental/soil/multi_spectral)
        data_value: 数据值（图像类型为MinIO存储位置，其他为测量值）
        capture_time: 采集时间
        device_id: 设备ID
        device_display_name: 设备前端显示名称
        field_id: 地块ID
        field_display_name: 地块前端显示名称
        data_subtype: 数据子类型 (temperature/humidity/ph/light/ndvi/rgb等)
        data_unit: 数据单位 (°C/%/ppm/lux等)
        data_format: 数据格式 (jpg/png/csv/json等)
        bucket_name: MinIO bucket名称（仅图像数据需要）
        object_key: MinIO对象路径（仅图像数据需要）
        location_geom: 位置几何信息
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
        from database.main_db import engine
        
        # 生成新的UUID
        new_id = str(uuid.uuid4())
        
        # 获取表名
        table_name = get_user_table_name(userid, "raw_data")
        
        # 构建插入SQL
        insert_sql = f"""
            INSERT INTO {table_name} (
                id, session_id, data_type, data_value, capture_time,
                device_id, device_display_name, field_id, field_display_name,
                data_subtype, data_unit, data_format, bucket_name, object_key,
                location_geom, altitude_m, heading,
                sensor_meta, file_meta, acquisition_meta, quality_score, quality_flags,
                checksum, is_valid, validation_notes, created_at
            ) VALUES (
                :id, :session_id, :data_type, :data_value, :capture_time,
                :device_id, :device_display_name, :field_id, :field_display_name,
                :data_subtype, :data_unit, :data_format, :bucket_name, :object_key,
                ST_GeomFromText(:location_geom, 4326), :altitude_m, :heading,
                :sensor_meta, :file_meta, :acquisition_meta, :quality_score, :quality_flags,
                :checksum, :is_valid, :validation_notes, NOW()
            )
            RETURNING id;
        """
        
        with engine.connect() as conn:
            # 准备参数
            params = {
                'id': new_id,
                'session_id': session_id,
                'data_type': data_type,
                'data_value': data_value,
                'capture_time': capture_time,
                'device_id': device_id,
                'device_display_name': device_display_name,
                'field_id': field_id,
                'field_display_name': field_display_name,
                'data_subtype': data_subtype,
                'data_unit': data_unit,
                'data_format': data_format,
                'bucket_name': bucket_name,
                'object_key': object_key,
                'location_geom': location_geom,
                'altitude_m': altitude_m,
                'heading': heading,
                'sensor_meta': sensor_meta,
                'file_meta': file_meta,
                'acquisition_meta': acquisition_meta,
                'quality_score': quality_score,
                'quality_flags': quality_flags,
                'checksum': checksum,
                'is_valid': is_valid,
                'validation_notes': validation_notes
            }
            
            result = conn.execute(text(insert_sql), params)
            conn.commit()
            
            # 返回新创建的ID
            return new_id
    
    except Exception as e:
        print(f"添加原始数据失败: {e}")
        return None


def get_raw_data_by_id(userid: str, raw_data_id: str) -> Optional[Dict[str, Any]]:
    """
    根据ID获取原始数据
    
    Args:
        userid: 用户ID
        raw_data_id: 原始数据ID
    
    Returns:
        Dict: 原始数据信息，不存在返回None
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        query_sql = f"""
            SELECT *, ST_AsText(location_geom) as location_text 
            FROM {table_name} 
            WHERE id = :raw_data_id;
        """
        
        with engine.connect() as conn:
            result = conn.execute(text(query_sql), {'raw_data_id': raw_data_id}).fetchone()
            
            if result:
                # 将结果转换为字典
                row = dict(result)
                
                # 根据数据类型处理数据值
                if row['data_type'] in ['image', 'video', 'multi_spectral']:
                    # 图像数据类型，返回MinIO存储路径
                    if row['bucket_name'] and row['object_key']:
                        row['display_value'] = f"minio://{row['bucket_name']}/{row['object_key']}"
                    else:
                        row['display_value'] = row['data_value']
                else:
                    # 其他数据类型，返回数值和单位
                    if row['data_unit']:
                        row['display_value'] = f"{row['data_value']} {row['data_unit']}"
                    else:
                        row['display_value'] = row['data_value']
                
                return row
            return None
    
    except Exception as e:
        print(f"获取原始数据失败: {e}")
        return None


def get_raw_data_by_session(userid: str, session_id: str) -> List[Dict[str, Any]]:
    """
    根据会话ID获取原始数据列表
    
    Args:
        userid: 用户ID
        session_id: 采集会话ID
    
    Returns:
        List[Dict]: 原始数据列表
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        query_sql = f"""
            SELECT *, ST_AsText(location_geom) as location_text 
            FROM {table_name} 
            WHERE session_id = :session_id
            ORDER BY capture_time DESC;
        """
        
        with engine.connect() as conn:
            result = conn.execute(text(query_sql), {'session_id': session_id}).fetchall()
            
            # 将结果转换为字典列表
            return [dict(row) for row in result]
    
    except Exception as e:
        print(f"获取原始数据列表失败: {e}")
        return []


def get_raw_data_by_time_range(
    userid: str, 
    start_time, 
    end_time, 
    data_type: str = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    根据时间范围获取原始数据
    
    Args:
        userid: 用户ID
        start_time: 开始时间
        end_time: 结束时间
        data_type: 数据类型（可选）
        limit: 返回结果数量限制
    
    Returns:
        List[Dict]: 原始数据列表
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        # 基础查询
        query_sql = f"""
            SELECT *, ST_AsText(location_geom) as location_text 
            FROM {table_name} 
            WHERE capture_time BETWEEN :start_time AND :end_time
        """
        
        # 添加数据类型过滤
        if data_type:
            query_sql += " AND data_type = :data_type"
        
        query_sql += " ORDER BY capture_time DESC LIMIT :limit"
        
        # 准备参数
        params = {
            'start_time': start_time,
            'end_time': end_time,
            'limit': limit
        }
        
        if data_type:
            params['data_type'] = data_type
        
        with engine.connect() as conn:
            result = conn.execute(text(query_sql), params).fetchall()
            
            # 将结果转换为字典列表
            return [dict(row) for row in result]
    
    except Exception as e:
        print(f"获取时间范围原始数据失败: {e}")
        return []


def get_raw_data_by_location(
    userid: str, 
    longitude: float, 
    latitude: float, 
    radius_meters: float = 100,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    根据位置获取原始数据
    
    Args:
        userid: 用户ID
        longitude: 经度
        latitude: 纬度
        radius_meters: 搜索半径（米）
        limit: 返回结果数量限制
    
    Returns:
        List[Dict]: 原始数据列表
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        query_sql = f"""
            SELECT *, ST_AsText(location_geom) as location_text,
                   ST_Distance(location_geom::geography, 
                              ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) as distance_m
            FROM {table_name} 
            WHERE ST_DWithin(
                location_geom::geography,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                :radius_meters
            )
            ORDER BY distance_m
            LIMIT :limit;
        """
        
        with engine.connect() as conn:
            params = {
                'longitude': longitude,
                'latitude': latitude,
                'radius_meters': radius_meters,
                'limit': limit
            }
            
            result = conn.execute(text(query_sql), params).fetchall()
            
            # 将结果转换为字典列表
            return [dict(row) for row in result]
    
    except Exception as e:
        print(f"获取位置原始数据失败: {e}")
        return []


def update_processing_status(userid: str, raw_data_id: str, status: str) -> bool:
    """
    更新原始数据处理状态
    
    Args:
        userid: 用户ID
        raw_data_id: 原始数据ID
        status: 新状态
    
    Returns:
        bool: 更新是否成功
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        update_sql = f"""
            UPDATE {table_name} 
            SET processing_status = :status,
                processed_at = CASE 
                    WHEN :status = 'completed' THEN NOW()
                    ELSE processed_at
                END,
                updated_at = NOW()
            WHERE id = :raw_data_id;
        """
        
        with engine.connect() as conn:
            conn.execute(text(update_sql), {
                'status': status,
                'raw_data_id': raw_data_id
            })
            conn.commit()
            
            return True
    
    except Exception as e:
        print(f"更新处理状态失败: {e}")
        return False


def update_ai_status(userid: str, raw_data_id: str, status: str) -> bool:
    """
    更新原始数据AI分析状态
    
    Args:
        userid: 用户ID
        raw_data_id: 原始数据ID
        status: 新状态
    
    Returns:
        bool: 更新是否成功
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        update_sql = f"""
            UPDATE {table_name} 
            SET ai_status = :status,
                ai_analyzed_at = CASE 
                    WHEN :status = 'completed' THEN NOW()
                    ELSE ai_analyzed_at
                END,
                updated_at = NOW()
            WHERE id = :raw_data_id;
        """
        
        with engine.connect() as conn:
            conn.execute(text(update_sql), {
                'status': status,
                'raw_data_id': raw_data_id
            })
            conn.commit()
            
            return True
    
    except Exception as e:
        print(f"更新AI状态失败: {e}")
        return False


def add_raw_data_tag(
    userid: str,
    raw_data_id: str,
    tag_category: str,
    tag_value: str,
    confidence: float = None,
    source: str = "manual"
) -> Optional[str]:
    """
    添加原始数据标签
    
    Args:
        userid: 用户ID
        raw_data_id: 原始数据ID
        tag_category: 标签类别
        tag_value: 标签值
        confidence: 置信度
        source: 标签来源
    
    Returns:
        str: 创建的标签ID，失败返回None
    """
    try:
        from database.main_db import engine
        
        # 生成新的UUID
        new_id = str(uuid.uuid4())
        
        # 获取表名
        table_name = get_user_table_name(userid, "raw_data_tags")
        
        # 构建插入SQL
        insert_sql = f"""
            INSERT INTO {table_name} (
                id, raw_data_id, tag_category, tag_value, confidence, source, created_at
            ) VALUES (
                :id, :raw_data_id, :tag_category, :tag_value, :confidence, :source, NOW()
            )
            RETURNING id;
        """
        
        with engine.connect() as conn:
            # 准备参数
            params = {
                'id': new_id,
                'raw_data_id': raw_data_id,
                'tag_category': tag_category,
                'tag_value': tag_value,
                'confidence': confidence,
                'source': source
            }
            
            result = conn.execute(text(insert_sql), params)
            conn.commit()
            
            # 返回新创建的ID
            return new_id
    
    except Exception as e:
        print(f"添加原始数据标签失败: {e}")
        return None


def delete_raw_data(userid: str, raw_data_id: str) -> bool:
    """
    删除原始数据
    
    Args:
        userid: 用户ID
        raw_data_id: 原始数据ID
    
    Returns:
        bool: 删除是否成功
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        tags_table_name = get_user_table_name(userid, "raw_data_tags")
        
        with engine.connect() as conn:
            # 删除相关标签
            conn.execute(text(f"""
                DELETE FROM {tags_table_name} 
                WHERE raw_data_id = :raw_data_id;
            """), {'raw_data_id': raw_data_id})
            
            # 删除原始数据
            conn.execute(text(f"""
                DELETE FROM {table_name} 
                WHERE id = :raw_data_id;
            """), {'raw_data_id': raw_data_id})
            
            conn.commit()
            
            return True
    
    except Exception as e:
        print(f"删除原始数据失败: {e}")
        return False


def get_raw_data_tags(userid: str, raw_data_id: str) -> List[Dict[str, Any]]:
    """
    获取原始数据的所有标签
    
    Args:
        userid: 用户ID
        raw_data_id: 原始数据ID
    
    Returns:
        List[Dict]: 标签列表
    """
    try:
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data_tags")
        
        query_sql = f"""
            SELECT * FROM {table_name} 
            WHERE raw_data_id = :raw_data_id
            ORDER BY created_at DESC;
        """
        
        with engine.connect() as conn:
            result = conn.execute(text(query_sql), {'raw_data_id': raw_data_id}).fetchall()
            
            # 将结果转换为字典列表
            return [dict(row) for row in result]
    
    except Exception as e:
        print(f"获取原始数据标签失败: {e}")
        return []


def get_raw_data_list_for_frontend(
    userid: str, 
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
        userid: 用户ID
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
        from database.main_db import engine
        
        table_name = get_user_table_name(userid, "raw_data")
        
        # 构建基础查询
        base_query = f"""
            FROM {table_name} 
            WHERE 1=1
        """
        
        # 构建计数查询
        count_query = f"SELECT COUNT(*) as total {base_query}"
        
        # 构建数据查询
        data_query = f"""
            SELECT 
                id, device_display_name, field_display_name, 
                data_type, data_subtype, data_value, data_unit, data_format,
                capture_time, is_valid, processing_status, ai_status
            {base_query}
            ORDER BY capture_time DESC
            LIMIT :limit OFFSET :offset
        """
        
        # 准备查询参数
        params = {
            'limit': page_size,
            'offset': (page - 1) * page_size
        }
        
        # 添加过滤条件
        if device_id:
            base_query += f" AND device_id = :device_id"
            params['device_id'] = device_id
        
        if field_id:
            base_query += f" AND field_id = :field_id"
            params['field_id'] = field_id
        
        if data_type:
            base_query += f" AND data_type = :data_type"
            params['data_type'] = data_type
        
        if data_subtype:
            base_query += f" AND data_subtype = :data_subtype"
            params['data_subtype'] = data_subtype
        
        if start_time:
            base_query += f" AND capture_time >= :start_time"
            params['start_time'] = start_time
        
        if end_time:
            base_query += f" AND capture_time <= :end_time"
            params['end_time'] = end_time
        
        # 重新构建完整查询
        count_query = f"SELECT COUNT(*) as total {base_query}"
        data_query = f"""
            SELECT 
                id, device_display_name, field_display_name, 
                data_type, data_subtype, data_value, data_unit, data_format,
                capture_time, is_valid, processing_status, ai_status
            {base_query}
            ORDER BY capture_time DESC
            LIMIT :limit OFFSET :offset
        """
        
        with engine.connect() as conn:
            # 获取总数
            total_result = conn.execute(text(count_query), params).fetchone()
            total = total_result['total']
            
            # 获取数据
            data_result = conn.execute(text(data_query), params).fetchall()
            
            # 处理数据
            items = []
            for row in data_result:
                item = dict(row)
                
                # 根据数据类型处理显示值
                if item['data_type'] in ['image', 'video', 'multi_spectral']:
                    # 图像数据类型，返回MinIO存储路径
                    item['display_value'] = item['data_value']
                else:
                    # 其他数据类型，返回数值和单位
                    if item['data_unit']:
                        item['display_value'] = f"{item['data_value']} {item['data_unit']}"
                    else:
                        item['display_value'] = item['data_value']
                
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