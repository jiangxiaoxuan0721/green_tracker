import uuid
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, Boolean, Text, Float
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from database.main_db import Base
from geoalchemy2 import Geometry
HAS_POSTGIS = True

# 仅在类型检查时导入，避免循环导入
if TYPE_CHECKING:
    from typing import Optional

class Field(Base):
    __tablename__ = "field"
    
    # 主键
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())
    
    # 基本信息
    name = Column(Text, nullable=False)  # 地块名称
    description = Column(Text, nullable=True)  # 备注说明
    
    # 空间信息（核心字段）- 根据PostGIS是否可用使用不同类型
    if HAS_POSTGIS:
        location_geom = Column(Geometry(geometry_type='POLYGON', srid=4326), nullable=False)  # 农田边界
    else:
        location_geom = Column(Text, nullable=False)  # 农田边界（以WKT格式存储）
    
    area_m2 = Column(Float, nullable=True)  # 农田面积（平方米）
    
    # 农业属性
    crop_type = Column(Text, nullable=True)  # 当前作物类型
    soil_type = Column(Text, nullable=True)  # 土壤类型
    irrigation_type = Column(Text, nullable=True)  # 灌溉方式
    
    # 管理属性（为多用户/多组织扩展预留）
    owner_id = Column(UUID(as_uuid=True), nullable=True)  # 地块负责人
    organization_id = Column(UUID(as_uuid=True), nullable=True)  # 所属组织
    
    # 状态字段
    is_active = Column(Boolean, default=True, nullable=False)  # 是否有效
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Field(id={self.id}, name={self.name}, owner_id={self.owner_id})>"