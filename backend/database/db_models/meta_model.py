"""
元数据模型 - 用于管理用户数据库映射和 Schema 版本
这些表存储在 green_tracker 元数据库中
"""

from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, Index, ForeignKey
from datetime import datetime
from sqlalchemy.sql import func
import uuid

from database.main_db import Base as MetaBase


class UserDatabase(MetaBase):
    """
    用户数据库映射表
    存储每个用户的独立数据库信息
    """
    __tablename__ = "user_databases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="记录ID")
    user_id = Column(String(36), ForeignKey('users.userid', ondelete='CASCADE'), nullable=False, unique=True, index=True, comment="用户ID")
    database_name = Column(String(100), nullable=False, unique=True, comment="数据库名称")
    database_host = Column(String(100), nullable=False, default="localhost", comment="数据库主机")
    database_port = Column(Integer, nullable=False, default=5432, comment="数据库端口")
    is_active = Column(Boolean, nullable=False, default=True, comment="是否激活")
    storage_size_mb = Column(Integer, nullable=True, comment="存储大小（MB）")
    table_count = Column(Integer, nullable=True, comment="表数量")
    record_count = Column(Integer, nullable=True, comment="记录数")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 索引
    __table_args__ = (
        Index('idx_user_databases_user_id', 'user_id'),
        Index('idx_user_databases_name', 'database_name'),
        Index('idx_user_databases_active', 'is_active'),
        {'comment': '用户数据库映射表'}
    )

    def __repr__(self):
        return f"<UserDatabase(user_id={self.user_id}, database_name={self.database_name})>"


class SchemaVersion(MetaBase):
    """
    Schema 版本管理表
    记录所有用户数据库的 Schema 版本，便于统一管理和迁移
    """
    __tablename__ = "schema_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="版本ID")
    user_id = Column(String(36), nullable=False, index=True, comment="用户ID")
    version = Column(String(20), nullable=False, comment="版本号（如 v2.0.0）")
    applied_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="应用时间")
    migration_file = Column(String(255), nullable=True, comment="迁移文件路径")
    description = Column(Text, nullable=True, comment="版本说明")

    # 索引
    __table_args__ = (
        Index('idx_schema_versions_version', 'version'),
        Index('idx_schema_versions_applied', 'applied_at'),
        {'comment': 'Schema版本管理表'}
    )

    def __repr__(self):
        return f"<SchemaVersion(user_id={self.user_id}, version={self.version})>"


class User(MetaBase):
    """
    用户账户信息表
    存储用户账户和认证信息
    """
    __tablename__ = "users"

    userid = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="用户ID")
    username = Column(String(50), nullable=False, unique=True, index=True, comment="用户名")
    email = Column(String(100), nullable=True, index=True, comment="邮箱")
    password_hash = Column(String(255), nullable=False, comment="密码哈希（bcrypt）")
    status = Column(String(20), nullable=False, default='active', comment="用户状态：active/suspended/deleted")
    subscription_plan = Column(String(20), nullable=False, default='basic', comment="订阅计划：basic/pro/enterprise")
    storage_quota_gb = Column(Integer, nullable=False, default=10, comment="存储配额（GB）")
    storage_used_gb = Column(Integer, nullable=False, default=0, comment="已用存储（GB）")
    max_databases = Column(Integer, nullable=False, default=1, comment="最大数据库数")
    settings = Column(Text, nullable=False, default='{}', comment="用户偏好设置（JSON）")
    last_login_at = Column(DateTime(timezone=True), nullable=True, comment="最后登录时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    # 索引
    __table_args__ = (
        Index('idx_users_username', 'username'),
        Index('idx_users_email', 'email'),
        Index('idx_users_status', 'status'),
        Index('idx_users_subscription', 'subscription_plan'),
        {'comment': '用户账户信息表'}
    )

    def __repr__(self):
        return f"<User(userid={self.userid}, username={self.username})>"


class Feedback(MetaBase):
    """
    系统反馈表
    存储用户反馈信息
    """
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), comment="反馈ID")
    user_id = Column(String(36), ForeignKey('users.userid', ondelete='SET NULL'), nullable=True, comment="用户ID")
    name = Column(String(100), nullable=True, comment="用户名")
    email = Column(String(100), nullable=True, comment="邮箱")
    subject = Column(String(200), nullable=False, comment="反馈主题")
    content = Column(Text, nullable=False, comment="反馈内容")
    status = Column(String(20), nullable=False, default='pending', comment="状态：pending/reviewed/resolved")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")

    # 索引
    __table_args__ = (
        Index('idx_feedback_user_id', 'user_id'),
        Index('idx_feedback_status', 'status'),
        {'comment': '系统反馈表'}
    )

    def __repr__(self):
        return f"<Feedback(id={self.id}, subject={self.subject})>"
