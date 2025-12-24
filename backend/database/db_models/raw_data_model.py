"""
原始数据模型
用于原始数据的存储和管理
"""

import uuid
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, Boolean, Text, Float, Integer, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from database.main_db import Base

# 仅在类型检查时导入，避免循环导入
if TYPE_CHECKING:
    from typing import Optional

class RawData(Base):
    """原始数据表模型"""
    __tablename__ = "raw_data"
    
    # 主键
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())
    
    # 逻辑归属
    session_id = Column(UUID(as_uuid=True), ForeignKey("collection_session.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.userid"), nullable=False, index=True)
    
    # 设备信息
    device_id = Column(UUID(as_uuid=True), ForeignKey("device.id"), index=True)
    device_display_name = Column(Text)  # 设备前端显示名称
    
    # 地块信息
    field_id = Column(UUID(as_uuid=True), ForeignKey("field.id"), index=True)
    field_display_name = Column(Text)  # 地块前端显示名称
    
    # 数据类型与值
    data_type = Column(Text, nullable=False, index=True)  # image/video/environmental/soil/multi_spectral
    data_subtype = Column(Text, index=True)  # temperature/humidity/ph/light/ndvi/rgb等
    data_unit = Column(Text)  # 数据单位 (°C/%/ppm/lux等)
    data_value = Column(Text, nullable=False)  # 数据值（图像类型为MinIO存储位置，其他为测量值）
    data_format = Column(Text)  # 数据格式 (jpg/png/csv/json等)
    
    # 对象存储索引（仅图像数据需要）
    bucket_name = Column(Text)  # MinIO bucket名称
    object_key = Column(Text)  # MinIO对象路径
    
    # 位置与姿态信息
    location_geom = Column(Geometry(geometry_type='POINT', srid=4326))  # 采集点位置（可选）
    altitude_m = Column(Float)  # 采集高度（米）
    heading = Column(Float)  # 朝向（度）
    
    # 元数据
    sensor_meta = Column(JSONB)  # 传感器参数（焦距/光谱范围/精度等）
    file_meta = Column(JSONB)  # 文件元数据（分辨率/大小/格式等）
    acquisition_meta = Column(JSONB)  # 采集参数（曝光时间/增益等）
    
    # 质量信息
    quality_score = Column(Float)  # 质量评分（0-1）
    quality_flags = Column(JSONB)  # 质量标记列表
    checksum = Column(Text)  # 文件校验值
    is_valid = Column(Boolean, default=True)  # 是否有效
    validation_notes = Column(Text)  # 验证备注
    
    # 状态字段
    processing_status = Column(Text, default="pending")  # pending/processing/completed/failed
    ai_status = Column(Text, default="pending")  # pending/processing/completed/failed
    
    # 时间戳
    capture_time = Column(DateTime(timezone=True), nullable=False)  # 采集时间
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<RawData(id={self.id}, data_type={self.data_type}, user_id={self.user_id})>"


class RawDataTag(Base):
    """原始数据标签表"""
    __tablename__ = "raw_data_tags"
    
    # 主键
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())
    
    # 关联关系
    raw_data_id = Column(UUID(as_uuid=True), ForeignKey("raw_data.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.userid"), nullable=False, index=True)
    
    # 标签内容
    tag_category = Column(Text, nullable=False, index=True)  # 标签类别（病虫害/营养/生长阶段等）
    tag_value = Column(Text, nullable=False, index=True)  # 标签值（蚜虫/缺氮/开花期等）
    confidence = Column(Float)  # 置信度（0-1）
    source = Column(Text, default="manual")  # 标签来源（manual/ai/reviewed）
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<RawDataTag(id={self.id}, category={self.tag_category}, value={self.tag_value})>"