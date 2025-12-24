"""
用户特定的原始数据表构建模块
为每个用户创建独立的raw_data表，确保数据隔离
"""

import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Text, Float, Integer, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from database.main_db import Base


def create_user_raw_data_table(table_name: str):
    """
    为指定用户创建raw_data表
    
    Args:
        table_name: 表名，通常格式为 "user_{userid}_raw_data"
    
    Returns:
        动态创建的Table类
    """
    # 动态创建表类
    class UserRawData(Base):
        __tablename__ = table_name
        
        # 主键
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        
        # 逻辑归属
        session_id = Column(UUID(as_uuid=True), nullable=False, index=True)
        
        # 设备信息
        device_id = Column(UUID(as_uuid=True), index=True)
        device_display_name = Column(Text)  # 设备前端显示名称
        
        # 地块信息
        field_id = Column(UUID(as_uuid=True), index=True)
        field_display_name = Column(Text)  # 地块前端显示名称
        
        # 数据类型与值
        data_type = Column(Text, nullable=False, index=True)  # image/video/environmental/soil/multi_spectral
        data_subtype = Column(Text, index=True)  # temperature/humidity/ph/light/ndvi/rgb等
        data_unit = Column(Text)  # 数据单位 (°C/%/ppm/lux等)
        data_value = Column(Text, nullable=False)  # 数据值（图像类型为MinIO存储位置，其他为测量值）
        data_format = Column(Text)  # 数据格式 (jpg/png/csv/json等)
        
        # 对象存储索引（仅图像数据需要）
        bucket_name = Column(Text)  # MinIO bucket
        object_key = Column(Text)  # MinIO 对象路径
        
        # 采集时空信息
        capture_time = Column(DateTime(timezone=True), nullable=False, index=True)
        location_geom = Column(Geometry(geometry_type='POINT', srid=4326), index=True)
        altitude_m = Column(Float)  # 采集高度（米）
        heading = Column(Float)  # 朝向（度）
        
        # 传感器与数据元信息
        sensor_meta = Column(JSONB)  # 传感器参数 / 量程 / 精度
        file_meta = Column(JSONB)  # 文件大小 / 分辨率 / 编码
        acquisition_meta = Column(JSONB)  # 采集参数
        
        # 数据质量
        quality_score = Column(Float)  # 数据质量评分（0-5）
        quality_flags = Column(Text, array=True)  # 质量标记数组
        
        # 校验与状态
        checksum = Column(Text)  # 文件校验（MD5/SHA256）
        is_valid = Column(Boolean, default=True)
        validation_notes = Column(Text)  # 验证备注
        
        # 处理状态
        processing_status = Column(Text, default='pending', index=True)  # pending / processing / completed / failed
        processed_at = Column(DateTime(timezone=True))  # 处理完成时间
        
        # AI分析状态
        ai_status = Column(Text, default='pending', index=True)  # pending / analyzing / completed / failed
        ai_analyzed_at = Column(DateTime(timezone=True))  # AI分析完成时间
        
        # 时间戳
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        def __repr__(self):
            return f"<UserRawData(id={self.id}, data_type={self.data_type}, capture_time={self.capture_time})>"
    
    # 设置表的唯一约束
    # 注意：由于是动态创建表，我们需要在表创建后添加唯一约束
    
    return UserRawData


def create_user_raw_data_tags_table(table_name: str):
    """
    为指定用户创建raw_data_tags表
    
    Args:
        table_name: 表名，通常格式为 "user_{userid}_raw_data_tags"
    
    Returns:
        动态创建的Table类
    """
    class UserRawDataTags(Base):
        __tablename__ = table_name
        
        # 主键
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        
        # 关联用户原始数据表
        raw_data_id = Column(UUID(as_uuid=True), nullable=False, index=True)
        
        # 标签信息
        tag_category = Column(Text, nullable=False, index=True)  # 标签类别：content/quality/weather/crop_stage
        tag_value = Column(Text, nullable=False, index=True)  # 标签值
        confidence = Column(Float)  # 标注置信度（0-1）
        source = Column(Text)  # 标注来源：manual/ai/predefined
        
        # 时间戳
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        
        def __repr__(self):
            return f"<UserRawDataTags(id={self.id}, raw_data_id={self.raw_data_id}, tag_category={self.tag_category})>"
    
    return UserRawDataTags


def get_user_table_name(userid: str, table_type: str = "raw_data") -> str:
    """
    获取用户表的标准命名
    
    Args:
        userid: 用户ID
        table_type: 表类型，raw_data 或 raw_data_tags
    
    Returns:
        格式化的表名
    """
    if table_type == "raw_data":
        return f"user_{userid}_raw_data"
    elif table_type == "raw_data_tags":
        return f"user_{userid}_raw_data_tags"
    else:
        raise ValueError(f"不支持的表类型: {table_type}")


def create_user_raw_data_tables(userid: str):
    """
    为指定用户创建所有相关的原始数据表
    
    Args:
        userid: 用户ID
    
    Returns:
        创建的表类字典
    """
    tables = {}
    
    # 创建原始数据表
    raw_data_table_name = get_user_table_name(userid, "raw_data")
    tables["raw_data"] = create_user_raw_data_table(raw_data_table_name)
    
    # 创建原始数据标签表
    raw_data_tags_table_name = get_user_table_name(userid, "raw_data_tags")
    tables["raw_data_tags"] = create_user_raw_data_tags_table(raw_data_tags_table_name)
    
    return tables


def create_user_indexes(engine, userid: str):
    """
    为用户特定的表创建索引
    
    Args:
        engine: SQLAlchemy引擎
        userid: 用户ID
    """
    raw_data_table_name = get_user_table_name(userid, "raw_data")
    raw_data_tags_table_name = get_user_table_name(userid, "raw_data_tags")
    
    with engine.connect() as conn:
        # 为原始数据表创建索引
        indexes = [
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_session_id ON {raw_data_table_name} (session_id);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_device_id ON {raw_data_table_name} (device_id);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_field_id ON {raw_data_table_name} (field_id);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_data_type ON {raw_data_table_name} (data_type);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_data_subtype ON {raw_data_table_name} (data_subtype);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_capture_time ON {raw_data_table_name} (capture_time DESC);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_processing_status ON {raw_data_table_name} (processing_status);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_ai_status ON {raw_data_table_name} (ai_status);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_session_type ON {raw_data_table_name} (session_id, data_type);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_device_field_time ON {raw_data_table_name} (device_id, field_id, capture_time DESC);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_type_time ON {raw_data_table_name} (data_type, capture_time DESC);"
        ]
        
        # 执行索引创建
        for index_sql in indexes:
            try:
                conn.execute(text(index_sql))
            except Exception as e:
                print(f"创建索引失败: {e}")
        
        # 创建空间索引
        try:
            conn.execute(text(f"""
                CREATE INDEX IF NOT EXISTS idx_{raw_data_table_name}_location_geom 
                ON {raw_data_table_name} 
                USING GIST (location_geom);
            """))
        except Exception as e:
            print(f"创建空间索引失败: {e}")
        
        # 创建唯一约束（仅对图像数据）
        try:
            conn.execute(text(f"""
                CREATE UNIQUE INDEX IF NOT EXISTS uniq_{raw_data_table_name}_image_object
                ON {raw_data_table_name} (session_id, bucket_name, object_key) 
                WHERE data_type IN ('image', 'video');
            """))
        except Exception as e:
            print(f"创建唯一约束失败: {e}")
        
        # 为原始数据标签表创建索引
        tag_indexes = [
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_tags_table_name}_raw_data_id ON {raw_data_tags_table_name} (raw_data_id);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_tags_table_name}_tag_category ON {raw_data_tags_table_name} (tag_category);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_tags_table_name}_tag_value ON {raw_data_tags_table_name} (tag_value);",
            f"CREATE INDEX IF NOT EXISTS idx_{raw_data_tags_table_name}_category_value ON {raw_data_tags_table_name} (tag_category, tag_value);"
        ]
        
        # 执行标签表索引创建
        for index_sql in tag_indexes:
            try:
                conn.execute(text(index_sql))
            except Exception as e:
                print(f"创建标签表索引失败: {e}")
        
        conn.commit()
        
        try:
            conn.execute(f"""
                CREATE UNIQUE INDEX IF NOT EXISTS uniq_{raw_data_table_name}_object 
                ON {raw_data_table_name} (session_id, bucket_name, object_key);
            """)
        except Exception as e:
            print(f"创建唯一约束失败: {e}")
        
        conn.commit()


def drop_user_tables(engine, userid: str):
    """
    删除用户特定的表
    
    Args:
        engine: SQLAlchemy引擎
        userid: 用户ID
    """
    tables = [
        get_user_table_name(userid, "raw_data"),
        get_user_table_name(userid, "raw_data_tags")
    ]
    
    with engine.connect() as conn:
        for table_name in tables:
            try:
                conn.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE;")
                print(f"已删除表: {table_name}")
            except Exception as e:
                print(f"删除表 {table_name} 失败: {e}")
        
        conn.commit()