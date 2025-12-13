from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    token: str


class TokenData(BaseModel):
    user_id: Optional[str] = None