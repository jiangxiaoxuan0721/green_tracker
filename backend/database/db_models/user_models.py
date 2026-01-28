"""
用户数据库模型
这些模型用于每个用户的独立数据库中
"""

from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, Text, ForeignKey, Index, JSON, ARRAY
from sqlalchemy.orm import declarative_base, relationship
from geoalchemy2 import Geometry
from datetime import datetime
import uuid

from database.main_db import UserBase


class Field(UserBase):
    """
    地块表 - 存储农田/地块的基本信息和空间数据
    """
    __tablename__ = "fields"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="地块ID")
    name = Column(Text, nullable=False, comment="地块名称")
    description = Column(Text, nullable=True, comment="备注说明")
    location_geom = Column(Geometry('POLYGON', srid=4326), nullable=False, comment="农田边界（PostGIS）")
    area_m2 = Column(Float, nullable=True, comment="农田面积（平方米）")
    crop_type = Column(Text, nullable=True, index=True, comment="当前作物类型")
    soil_type = Column(Text, nullable=True, comment="土壤类型")
    irrigation_type = Column(Text, nullable=True, comment="灌溉方式")
    is_active = Column(Boolean, nullable=False, default=True, index=True, comment="是否活跃")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    collection_sessions = relationship("CollectionSession", back_populates="field", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_fields_name', 'name'),
        Index('idx_fields_location', 'location_geom', postgresql_using='gist'),
        Index('idx_fields_crop_type', 'crop_type'),
        Index('idx_fields_soil_type', 'soil_type'),
        Index('idx_fields_active', 'is_active'),
        Index('idx_fields_created', 'created_at'),
        {'comment': '地块表'}
    )

    def __repr__(self):
        return f"<Field(id={self.id}, name={self.name})>"


class Device(UserBase):
    """
    设备表 - 存储空-天-地-具身平台设备信息
    """
    __tablename__ = "devices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="设备ID")
    name = Column(Text, nullable=False, comment="设备名称")
    device_type = Column(String(50), nullable=False, index=True, comment="设备类型：satellite/uav/ugv/robot/sensor")
    platform_level = Column(String(50), nullable=False, index=True, comment="平台层级：天/空/地/具身")
    model = Column(String(100), nullable=True, comment="设备型号")
    manufacturer = Column(String(100), nullable=True, comment="厂商")
    sensors = Column(JSON, nullable=True, comment="传感器配置")
    actuators = Column(JSON, nullable=True, comment="执行机构配置")
    description = Column(Text, nullable=True, comment="设备说明")
    is_active = Column(Boolean, nullable=False, default=True, index=True, comment="是否在用")
    last_seen_at = Column(DateTime, nullable=True, comment="最后在线时间")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    raw_data = relationship("RawData", back_populates="device", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_devices_name', 'name'),
        Index('idx_devices_type', 'device_type'),
        Index('idx_devices_platform', 'platform_level'),
        Index('idx_devices_active', 'is_active'),
        Index('idx_devices_last_seen', 'last_seen_at'),
        {'comment': '设备表'}
    )

    def __repr__(self):
        return f"<Device(id={self.id}, type={self.device_type})>"


class CollectionSession(UserBase):
    """
    采集任务表 - 管理采集任务/观测会话
    """
    __tablename__ = "collection_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="任务ID")
    field_id = Column(String(36), ForeignKey('fields.id', ondelete='CASCADE'), nullable=False, index=True, comment="所属地块")
    device_id = Column(String(36), ForeignKey('devices.id', ondelete='SET NULL'), nullable=True, index=True, comment="使用设备")
    creator_id = Column(String(36), nullable=True, index=True, comment="任务创建者")
    start_time = Column(DateTime, nullable=False, index=True, comment="任务开始时间")
    end_time = Column(DateTime, nullable=True, comment="任务结束时间")
    mission_type = Column(Text, nullable=False, index=True, comment="任务类型：巡检/定点/路径/应急")
    mission_name = Column(Text, nullable=True, comment="任务名称")
    description = Column(Text, nullable=True, comment="任务说明")
    weather_snapshot = Column(JSON, nullable=True, comment="环境快照")
    status = Column(Text, nullable=False, default='planned', index=True, comment="任务状态：planned/running/completed/failed")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    field = relationship("Field", back_populates="collection_sessions")
    device = relationship("Device", backref="collection_sessions")
    raw_data = relationship("RawData", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_session_field', 'field_id'),
        Index('idx_session_device', 'device_id'),
        Index('idx_session_time', 'start_time', 'end_time'),
        Index('idx_session_type', 'mission_type'),
        Index('idx_session_creator', 'creator_id'),
        Index('idx_session_status', 'status'),
        Index('idx_session_field_status', 'field_id', 'status'),
        Index('idx_session_field_time', 'field_id', 'start_time'),
        Index('idx_session_type_status', 'mission_type', 'status'),
        {'comment': '采集任务表'}
    )

    def __repr__(self):
        return f"<CollectionSession(id={self.id}, type={self.mission_type})>"


class RawData(UserBase):
    """
    原始数据表 - 索引原始感知数据（PostgreSQL ↔ MinIO 桥梁）
    """
    __tablename__ = "raw_data"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="数据ID")
    session_id = Column(String(36), ForeignKey('collection_sessions.id', ondelete='CASCADE'), nullable=False, index=True, comment="所属任务")
    device_id = Column(String(36), ForeignKey('devices.id', ondelete='SET NULL'), nullable=True, index=True, comment="设备ID")
    field_id = Column(String(36), ForeignKey('fields.id', ondelete='SET NULL'), nullable=True, index=True, comment="地块ID")
    data_type = Column(Text, nullable=False, index=True, comment="数据类型：image/video/environmental/soil/multi_spectral")
    data_subtype = Column(Text, nullable=True, index=True, comment="数据子类型：temperature/humidity/ph/light/ndvi/rgb")
    data_unit = Column(Text, nullable=True, comment="数据单位：°C/%/ppm/lux")
    data_value = Column(Text, nullable=False, comment="数据值")
    data_format = Column(Text, nullable=True, comment="数据格式")
    bucket_name = Column(Text, nullable=True, comment="MinIO bucket")
    object_key = Column(Text, nullable=True, comment="MinIO 对象路径")
    capture_time = Column(DateTime, nullable=False, index=True, comment="采集时间")
    location_geom = Column(Geometry('POINT', srid=4326), nullable=True, comment="采集点位置")
    altitude_m = Column(Float, nullable=True, comment="采集高度（米）")
    heading = Column(Float, nullable=True, comment="朝向（度）")
    sensor_meta = Column(JSON, nullable=True, comment="传感器元数据")
    file_meta = Column(JSON, nullable=True, comment="文件元数据")
    acquisition_meta = Column(JSON, nullable=True, comment="采集参数")
    quality_score = Column(Float, nullable=True, comment="质量评分（0-1）")
    quality_flags = Column(JSON, nullable=True, comment="质量标记")
    checksum = Column(Text, nullable=True, comment="文件校验值")
    is_valid = Column(Boolean, nullable=False, default=True, comment="是否有效")
    validation_notes = Column(Text, nullable=True, comment="验证备注")
    processing_status = Column(Text, nullable=False, default='pending', index=True, comment="处理状态：pending/processing/completed/failed")
    processed_at = Column(DateTime, nullable=True, comment="处理完成时间")
    ai_status = Column(Text, nullable=False, default='pending', index=True, comment="AI状态：pending/analyzing/completed/failed")
    ai_analyzed_at = Column(DateTime, nullable=True, comment="AI分析完成时间")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    session = relationship("CollectionSession", back_populates="raw_data")
    device = relationship("Device", back_populates="raw_data")
    tags = relationship("RawDataTag", back_populates="raw_data", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_raw_data_session_id', 'session_id'),
        Index('idx_raw_data_device_id', 'device_id'),
        Index('idx_raw_data_field_id', 'field_id'),
        Index('idx_raw_data_data_type', 'data_type'),
        Index('idx_raw_data_data_subtype', 'data_subtype'),
        Index('idx_raw_data_capture_time', 'capture_time'),
        Index('idx_raw_data_processing_status', 'processing_status'),
        Index('idx_raw_data_ai_status', 'ai_status'),
        Index('idx_raw_data_location_geom', 'location_geom', postgresql_using='gist'),
        Index('uniq_raw_data_object', 'session_id', 'bucket_name', 'object_key'),
        Index('idx_raw_data_session_type', 'session_id', 'data_type'),
        Index('idx_raw_data_device_field_time', 'device_id', 'field_id', 'capture_time'),
        Index('idx_raw_data_type_time', 'data_type', 'capture_time'),
        {'comment': '原始数据表'}
    )

    def __repr__(self):
        return f"<RawData(id={self.id}, type={self.data_type})>"


class RawDataTag(UserBase):
    """
    原始数据标签表 - 存储原始数据的标签信息
    """
    __tablename__ = "raw_data_tags"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="标签ID")
    raw_data_id = Column(String(36), ForeignKey('raw_data.id', ondelete='CASCADE'), nullable=False, index=True, comment="关联原始数据")
    tag_category = Column(Text, nullable=False, comment="标签类别：病虫害/营养/生长阶段等")
    tag_value = Column(Text, nullable=False, comment="标签值：蚜虫/缺氮/开花期等")
    confidence = Column(Float, nullable=True, comment="置信度（0-1）")
    source = Column(Text, nullable=False, default='manual', comment="标注来源：manual/ai/reviewed")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")

    # 关系
    raw_data = relationship("RawData", back_populates="tags")

    __table_args__ = (
        Index('idx_raw_data_tags_raw_data_id', 'raw_data_id'),
        Index('idx_raw_data_tags_category', 'tag_category'),
        Index('idx_raw_data_tags_value', 'tag_value'),
        Index('idx_raw_data_tags_category_value', 'tag_category', 'tag_value'),
        {'comment': '原始数据标签表'}
    )

    def __repr__(self):
        return f"<RawDataTag(id={self.id}, category={self.tag_category}, value={self.tag_value})>"


class CropObject(UserBase):
    """
    作物对象表 - 从原始感知数据中抽象出的具身作物实体
    """
    __tablename__ = "crop_objects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="作物对象ID")
    field_id = Column(String(36), ForeignKey('fields.id', ondelete='CASCADE'), nullable=False, index=True, comment="所属农田")
    crop_type = Column(Text, nullable=False, comment="作物种类：wheat/corn/rice")
    object_level = Column(Text, nullable=False, comment="对象层级：plant/row/patch")
    object_code = Column(Text, nullable=True, comment="业务可读编号")
    geometry = Column(Geometry('GEOMETRY', srid=4326), nullable=True, comment="对象空间形态")
    growth_stage = Column(Text, nullable=True, comment="生长阶段：出苗/拔节/抽穗/成熟")
    health_status = Column(Text, nullable=True, comment="健康状态：healthy/stress/disease/unknown")
    source_raw_data_id = Column(String(36), ForeignKey('raw_data.id', ondelete='SET NULL'), nullable=True, comment="首次识别来源")
    first_seen_at = Column(DateTime, nullable=False, index=True, comment="首次观测时间")
    last_seen_at = Column(DateTime, nullable=False, index=True, comment="最近观测时间")
    attributes = Column(JSON, nullable=True, comment="属性：高度/叶面积指数/颜色指数")
    is_active = Column(Boolean, nullable=False, default=True, index=True, comment="是否仍存在")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    __table_args__ = (
        Index('uniq_crop_object_code', 'field_id', 'object_code'),
        Index('idx_crop_objects_field_id', 'field_id'),
        Index('idx_crop_objects_crop_type', 'crop_type'),
        Index('idx_crop_objects_growth_stage', 'growth_stage'),
        Index('idx_crop_objects_health_status', 'health_status'),
        Index('idx_crop_objects_first_seen', 'first_seen_at'),
        Index('idx_crop_objects_last_seen', 'last_seen_at'),
        Index('idx_crop_objects_active', 'is_active'),
        Index('idx_crop_objects_geometry', 'geometry', postgresql_using='gist'),
        {'comment': '作物对象表'}
    )

    def __repr__(self):
        return f"<CropObject(id={self.id}, type={self.crop_type})>"
