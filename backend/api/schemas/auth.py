from pydantic import BaseModel, EmailStr
from typing import Optional


class SendCodeRequest(BaseModel):
    email: EmailStr


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    code: str  # 邮箱验证码


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str  # 邮箱验证码
    new_password: str


class TokenData(BaseModel):
    user_id: Optional[str] = None