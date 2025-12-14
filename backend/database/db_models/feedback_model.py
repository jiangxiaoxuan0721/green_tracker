import uuid
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from database.main_db import Base

# 仅在类型检查时导入，避免循环导入
if TYPE_CHECKING:
    from typing import Optional

class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    subject = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<Feedback(id={self.id}, subject={self.subject})>"