import uuid
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database.main_db import Base

# 仅在类型检查时导入，避免循环导入
if TYPE_CHECKING:
    from typing import Optional

class CollectionSession(Base):
    """采集任务/观测会话表 - 任务管理核心表"""
    __tablename__ = "collection_session"
    
    # 主键
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())
    
    # 关联实体
    field_id = Column(UUID(as_uuid=True), ForeignKey("field.id", ondelete="CASCADE"), nullable=False)
    
    # 创建者信息 - 任务执行负责人/创建者
    creator_id = Column(String(36), ForeignKey("users.userid", ondelete="SET NULL"), nullable=True)
    
    # 时间信息（核心）
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    # 任务语义
    mission_type = Column(Text, nullable=False)  # 巡检 / 定点 / 路径 / 应急
    mission_name = Column(Text, nullable=True)   # 任务名称（可读）
    description = Column(Text, nullable=True)    # 任务说明
    
    # 任务环境快照（可选）
    weather_snapshot = Column(JSONB, nullable=True)  # 温度/湿度/风速/天气
    
    # 状态字段
    status = Column(Text, default="completed")  # planned / running / completed / failed
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 定义索引以提高查询性能
    __table_args__ = (
        Index('idx_session_field_id', 'field_id'),
        Index('idx_session_time_range', 'start_time', 'end_time'),
        Index('idx_session_mission_type', 'mission_type'),
        Index('idx_session_creator_id', 'creator_id'),
        Index('idx_session_status', 'status'),
        # 复合索引，用于常见查询组合
        Index('idx_session_field_status', 'field_id', 'status'),
        Index('idx_session_field_time', 'field_id', 'start_time'),
        Index('idx_session_type_status', 'mission_type', 'status'),
    )
    
    def __repr__(self):
        return f"<CollectionSession(id={self.id}, mission_type={self.mission_type}, status={self.status})>"