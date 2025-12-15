import uuid
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from database.main_db import Base

# 仅在类型检查时导入，避免循环导入
if TYPE_CHECKING:
    from typing import Optional

class Device(Base):
    __tablename__ = "device"
    
    # 主键
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())
    
    # 平台抽象
    device_type = Column(String(50), nullable=False)  # satellite / uav / ugv / robot / sensor
    platform_level = Column(String(50), nullable=False)  # 天 / 空 / 地 / 具身
    model = Column(String(100), nullable=True)  # 设备型号
    manufacturer = Column(String(100), nullable=True)  # 厂商
    
    # 能力描述
    sensors = Column(JSON, nullable=True)  # 传感器配置（RGB/多光谱/LiDAR）
    actuators = Column(JSON, nullable=True)  # 执行机构（轮式/履带/机械臂）
    description = Column(Text, nullable=True)  # 设备说明
    
    # 管理属性
    owner_id = Column(UUID(as_uuid=True), nullable=True)  # 设备所有者/负责人
    
    # 状态字段
    is_active = Column(Boolean, default=True, nullable=False)  # 是否在用
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Device(id={self.id}, type={self.device_type}, owner_id={self.owner_id})>"