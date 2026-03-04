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
        # PostGIS 会为 geometry 列自动创建 gist 索引，不需要手动创建
        # Index('idx_fields_location', 'location_geom', postgresql_using='gist'),
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
    # 设备的原始数据现在通过 CollectionSession 间接关联

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
    data_type = Column(Text, nullable=False, index=True, comment="数据类型：image/video/environmental/soil/spectral/multispectral/thermal")
    data_subtype = Column(Text, nullable=True, index=True, comment="数据子类型：rgb/nir/red_edge/thermal/temperature/humidity/ph/moisture/ndvi/evi")
    data_unit = Column(Text, nullable=True, comment="数据单位：°C/%/ppm/lux/cm/ms/mm")
    data_value = Column(Text, nullable=True, comment="数据值（非图像数据使用）")
    data_format = Column(Text, nullable=True, comment="数据格式：jpeg/png/tiff/mp4/csv/json")
    bucket_name = Column(Text, nullable=True, comment="MinIO bucket（图像/视频数据使用，与session_id一致）")
    object_key = Column(Text, nullable=True, comment="MinIO 对象路径（图像/视频数据使用）")
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
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    session = relationship("CollectionSession", back_populates="raw_data")
    tags = relationship("RawDataTag", back_populates="raw_data", cascade="all, delete-orphan")
    processing = relationship("DataProcessing", back_populates="raw_data", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_raw_data_session_id', 'session_id'),
        Index('idx_raw_data_data_type', 'data_type'),
        Index('idx_raw_data_data_subtype', 'data_subtype'),
        Index('idx_raw_data_capture_time', 'capture_time'),
        # PostGIS 会为 geometry 列自动创建 gist 索引，不需要手动创建
        # Index('idx_raw_data_location_geom', 'location_geom', postgresql_using='gist'),
        Index('uniq_raw_data_object', 'session_id', 'bucket_name', 'object_key'),
        Index('idx_raw_data_session_type', 'session_id', 'data_type'),
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
        {'comment': '作物对象表'}
    )

    def __repr__(self):
        return f"<CropObject(id={self.id}, type={self.crop_type})>"


class DataProcessing(UserBase):
    """
    数据处理表 - 管理原始数据的AI/人工处理状态和结果
    """
    __tablename__ = "data_processing"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="处理记录ID")
    raw_data_id = Column(String(36), ForeignKey('raw_data.id', ondelete='CASCADE'), nullable=False, index=True, comment="关联原始数据")
    processing_type = Column(Text, nullable=False, index=True, comment="处理类型：ai_analysis/manual_review/data_validation/feature_extraction")
    processing_status = Column(Text, nullable=False, default='pending', index=True, comment="处理状态：pending/processing/completed/failed/skipped")
    processing_result = Column(JSON, nullable=True, comment="处理结果详情")
    confidence_score = Column(Float, nullable=True, comment="处理置信度（0-1）")
    processing_model = Column(Text, nullable=True, comment="使用的AI模型或算法")
    processing_version = Column(Text, nullable=True, comment="模型版本或算法版本")
    processing_parameters = Column(JSON, nullable=True, comment="处理参数配置")
    error_message = Column(Text, nullable=True, comment="错误信息")
    processing_time_seconds = Column(Float, nullable=True, comment="处理耗时（秒）")
    processed_by = Column(Text, nullable=True, comment="处理者：ai_system/user_id/automation")
    quality_metrics = Column(JSON, nullable=True, comment="质量指标")
    next_processing_step = Column(Text, nullable=True, comment="下一步处理建议")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    started_at = Column(DateTime, nullable=True, comment="开始处理时间")
    completed_at = Column(DateTime, nullable=True, comment="完成处理时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    raw_data = relationship("RawData", back_populates="processing")

    __table_args__ = (
        Index('idx_data_processing_raw_data_id', 'raw_data_id'),
        Index('idx_data_processing_type', 'processing_type'),
        Index('idx_data_processing_status', 'processing_status'),
        Index('idx_data_processing_model', 'processing_model'),
        Index('idx_data_processing_completed', 'completed_at'),
        Index('idx_data_processing_type_status', 'processing_type', 'processing_status'),
        Index('idx_data_processing_raw_type', 'raw_data_id', 'processing_type'),
        {'comment': '数据处理表'}
    )

    def __repr__(self):
        return f"<DataProcessing(id={self.id}, type={self.processing_type}, status={self.processing_status})>"
