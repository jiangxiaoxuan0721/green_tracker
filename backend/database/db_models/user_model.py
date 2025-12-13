import uuid
import os
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from database.main_db import Base

# 从环境变量或使用默认值获取用户名
DB_USER = os.getenv("DB_USER", "jiangxiaoxuan")

# 仅在类型检查时导入，避免循环导入
if TYPE_CHECKING:
    from typing import Optional

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": DB_USER}
    
    userid = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<User(userid={self.userid}, username={self.username})>"