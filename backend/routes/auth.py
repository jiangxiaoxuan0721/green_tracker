from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database.main_db import get_db
from database.db_services import create_user, verify_user, get_user_by_id
from api.schemas.auth import UserRegister, UserLogin, UserResponse
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

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
async def register(user: UserRegister, db: Session = Depends(get_db)):
    """
    用户注册
    """
    print(f"[后端Auth] 收到注册请求: 用户名={user.username}, 邮箱={user.email}, 密码=***")
    
    try:
        # 检查用户是否已存在
        print("[后端Auth] 开始创建用户")
        existing_user = create_user(db, user.username, user.email, get_password_hash(user.password))
        print(f"[后端Auth] 用户创建成功: 用户ID={existing_user.userid}")
        
        # 创建访问令牌
        print("[后端Auth] 开始创建访问令牌")
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": existing_user.userid}, expires_delta=access_token_expires
        )
        print("[后端Auth] 访问令牌创建成功")
        
        return UserResponse(user_id=str(existing_user.userid), token=access_token)
    except Exception as e:
        print(f"[后端Auth] 注册失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=UserResponse)
async def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录验证
    """
    print(f"[后端Auth] 收到登录请求: 用户名={user.username}, 密码=***")
    
    # 查找用户
    print("[后端Auth] 开始验证用户")
    db_user = verify_user(db, user.username, user.password)
    
    if not db_user:
        print(f"[后端Auth] 用户验证失败: 用户名={user.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"[后端Auth] 用户验证成功: 用户ID={db_user.userid}")
    
    # 创建访问令牌
    print("[后端Auth] 开始创建访问令牌")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.userid}, expires_delta=access_token_expires
    )
    print("[后端Auth] 访问令牌创建成功")
    
    return UserResponse(user_id=str(db_user.userid), token=access_token)


@router.get("/verify")
async def verify_token(token: str = "", db: Session = Depends(get_db)):
    """
    验证token有效性
    """
    # 从请求头获取token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少token"
        )
    
    try:
        # 解码token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub") # type: ignore
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的token"
            )
        
        # 查找用户
        user = get_user_by_id(db, user_id)
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )
        
        return {"valid": True, "user_id": user_id}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的token"
        )