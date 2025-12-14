from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class FeedbackCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    subject: str
    content: str


class FeedbackResponse(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    subject: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True