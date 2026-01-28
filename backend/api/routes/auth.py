from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database.main_db import get_meta_db
from database.db_services import create_user, verify_user
from database.db_models.meta_model import User
from api.schemas.auth import UserRegister, UserLogin, UserResponse
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
import logging
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

# 加载环境变量 - 从项目根目录加载.env文件
# 获取项目根目录路径
project_root = Path(__file__).parent.parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def verify_password(plain_password, hashed_password):
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """获取密码哈希"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta = None): # type: ignore
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


@router.post("/register", response_model=UserResponse)
async def register(user: UserRegister, db: Session = Depends(get_meta_db)):
    """
    用户注册
    """
    try:
        # 1. 检查用户是否已存在并创建用户
        existing_user = create_user(db, user.username, user.email, get_password_hash(user.password))

        # 2. 为用户创建独立数据库
        try:
            from database.create_user_database import create_user_database
            db_info = create_user_database(existing_user.userid)
            logger.info(f"User database created successfully: {db_info}")
        except Exception as db_error:
            # 如果创建数据库失败，回滚用户创建
            logger.error(f"Failed to create user database: {db_error}")
            db.delete(existing_user)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建用户数据库失败: {str(db_error)}"
            )

        # 3. 创建访问令牌
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": existing_user.userid}, expires_delta=access_token_expires
        )

        return UserResponse(user_id=str(existing_user.userid), token=access_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=UserResponse)
async def login(user: UserLogin, db: Session = Depends(get_meta_db)):
    """
    用户登录验证
    """
    # 查找用户
    db_user = verify_user(db, user.username, user.password)

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.userid}, expires_delta=access_token_expires
    )

    return UserResponse(user_id=str(db_user.userid), token=access_token)


# 安全方案
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_meta_db)):
    """
    从JWT令牌中获取当前用户
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 解码JWT令牌
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub") # type: ignore
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 从数据库获取用户
    user = db.query(User).filter(User.userid == user_id).first()
    if user is None:
        raise credentials_exception

    return user


@router.get("/verify")
async def verify_token(current_user: User = Depends(get_current_user)):
    """
    验证token有效性
    """
    # 如果能通过get_current_user依赖，说明token有效
    return {"valid": True, "user_id": str(current_user.userid)}