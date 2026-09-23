from typing import Any, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database.main_db import get_meta_db
from database.user_db_manager import get_user_db
from database.db_services import create_user, verify_user, get_user_by_email, save_verification_code, verify_and_clear_code, reset_password
from database.db_services.log_service import create_log
from database.db_models.meta_model import User
from api.schemas.auth import SendCodeRequest, UserRegister, UserLogin, EmailLoginRequest, UserResponse, ForgotPasswordRequest, ResetPasswordRequest
from utils.email_service import generate_verification_code, send_verification_email, send_password_reset_email
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
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

router = APIRouter(prefix="/auth", tags=["authentication"])


def verify_password(plain_password, hashed_password):
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """获取密码哈希"""
    return pwd_context.hash(password)


def create_access_token(data: dict[str, Optional[Any]], expires_delta: Optional[timedelta] = None): # type: ignore
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


@router.post("/send-code")
async def send_verification_code(request: SendCodeRequest, db: Session = Depends(get_meta_db)):
    """
    发送邮箱验证码（用于注册或登录）
    """
    try:
        # 生成6位验证码
        code = generate_verification_code(6)

        # 保存验证码到数据库
        save_verification_code(db, request.email, code)

        # 发送邮件
        try:
            purpose = request.purpose if hasattr(request, 'purpose') and request.purpose else "register"
            send_verification_email(request.email, code, purpose)
        except Exception as e:
            logger.error(f"发送邮件失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"验证码发送失败: {str(e)}"
            )

        return {"message": "验证码已发送", "email": request.email}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发送验证码异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"发送验证码失败: {str(e)}"
        )


@router.post("/register", response_model=UserResponse)
async def register(user: UserRegister, db: Session = Depends(get_meta_db)):
    """
    用户注册（需邮箱验证码）
    """
    try:
        # 1. 验证邮箱验证码
        if not verify_and_clear_code(db, user.email, user.code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码错误或已过期"
            )

        # 2. 检查用户名是否已存在，创建用户
        existing_user = create_user(db, user.username, user.email, get_password_hash(user.password))

        # 标记邮箱已验证
        existing_user.email_verified = True
        db.commit()

        # 3. 为用户创建独立数据库
        try:
            from database.create_user_database import create_user_database
            db_info = create_user_database(str(existing_user.userid))
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

        # 4. 创建访问令牌
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": existing_user.userid}, expires_delta=access_token_expires
        )

        # 记录注册日志
        try:
            user_db = get_user_db(str(existing_user.userid))
            create_log(user_db, "success", "auth.register", f"用户 {user.username} 注册成功")
            user_db.close()
        except Exception:
            pass

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

    # 记录登录日志
    try:
        user_db = get_user_db(str(db_user.userid))
        create_log(user_db, "info", "auth.login", f"用户 {db_user.username} 登录成功")
        user_db.close()
    except Exception:
        pass

    return UserResponse(user_id=str(db_user.userid), token=access_token)


@router.post("/login-by-code", response_model=UserResponse)
async def login_by_code(request: EmailLoginRequest, db: Session = Depends(get_meta_db)):
    """
    邮箱验证码登录
    """
    # 1. 验证验证码
    if not verify_and_clear_code(db, request.email, request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )

    # 2. 查找已验证邮箱的用户
    db_user = get_user_by_email(db, request.email)
    if not db_user or not db_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="该邮箱未注册或未验证",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.userid}, expires_delta=access_token_expires
    )

    # 记录登录日志
    try:
        user_db = get_user_db(str(db_user.userid))
        create_log(user_db, "info", "auth.login", f"用户 {db_user.username} 通过验证码登录成功")
        user_db.close()
    except Exception:
        pass

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


def _send_reset_email_background(email: str, code: str):
    """后台任务：发送密码重置邮件（不阻塞响应）"""
    try:
        send_password_reset_email(email, code)
    except Exception as e:
        logger.error(f"后台发送密码重置邮件失败 [{email}]: {e}")


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_meta_db)):
    """
    忘记密码 - 发送重置密码验证码到邮箱
    """
    try:
        # 查找已注册且已验证邮箱的用户
        user = get_user_by_email(db, request.email)
        if not user or not user.email_verified:
            # 为安全考虑，不暴露用户是否存在，统一返回成功消息
            return {"message": "如果该邮箱已注册，验证码已发送"}

        # 生成6位验证码
        code = generate_verification_code(6)

        # 保存验证码到数据库
        save_verification_code(db, request.email, code)

        # 使用后台任务发送邮件，避免 SMTP 超时阻塞响应
        background_tasks.add_task(_send_reset_email_background, request.email, code)

        # 记录密码重置请求日志
        try:
            user_db = get_user_db(str(user.userid))
            create_log(user_db, "info", "auth.password_reset", f"用户 {user.username} 请求密码重置")
            user_db.close()
        except Exception:
            pass

        return {"message": "验证码已发送", "email": request.email}

    except Exception as e:
        logger.error(f"忘记密码处理异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"操作失败: {str(e)}"
        )


@router.post("/reset-password")
async def reset_user_password(request: ResetPasswordRequest, db: Session = Depends(get_meta_db)):
    """
    重置密码 - 通过验证码设置新密码
    """
    try:
        # 验证密码强度
        if len(request.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码长度不能少于6位"
            )

        # 查找用户
        user = get_user_by_email(db, request.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码错误或已过期"
            )

        # 重置密码
        result = reset_password(db, request.email, request.code, get_password_hash(request.new_password))
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码错误或已过期"
            )

        # 记录密码重置成功日志
        try:
            user_db = get_user_db(str(user.userid))
            create_log(user_db, "success", "auth.password_reset", f"用户 {user.username} 密码重置成功")
            user_db.close()
        except Exception:
            pass

        return {"message": "密码重置成功，请使用新密码登录"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置密码异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重置密码失败: {str(e)}"
        )


async def get_current_user_from_api_key(
    x_api_key: Optional[str] = None, db: Session = Depends(get_meta_db)
):
    """
    从API密钥中获取当前用户
    用于设备上传数据时的认证
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API密钥缺失",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # 验证API密钥
    from database.db_services.api_key_service import validate_api_key
    key_info = validate_api_key(db, x_api_key)

    if not key_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的API密钥",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # 从数据库获取用户
    user = db.query(User).filter(User.userid == key_info['user_id']).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # API密钥使用记录已在validate_api_key函数中更新
    return user


# ============================================================
# 统一认证 + 权限校验依赖
# ============================================================
# 设计目标：所有对外接口使用同一套认证约定：
#   1. Authorization: Bearer <jwt>   —— Web 控制台登录用户（账号所有者，不做权限项校验）
#   2. X-API-Key: green-xxx          —— 远程设备/第三方系统（按 permissions 逐项校验）
# 两者都未提供时返回 401；API 密钥缺少所需权限时返回 403。

from utils.permissions import (  # noqa: E402  （放在此处导入，避免影响上方既有逻辑）
    ALL_PERMISSIONS,
    PERMISSION_DATA_UPLOAD,
    PERMISSION_DATA_READ,
    PERMISSION_DEVICE_CONTROL,
    parse_permissions,
)


AUTH_METHOD_JWT = "jwt"
AUTH_METHOD_API_KEY = "api_key"


class AuthPrincipal:
    """
    统一的调用主体

    同时承载「是谁」和「凭什么调用」两类信息，供路由层复用：
    - user        : meta 库中的 User 对象（数据归属方）
    - auth_method : jwt / api_key
    - permissions : API 密钥携带的权限列表（JWT 为空，表示账号全权）
    """

    def __init__(self, user: User, auth_method: str, api_key: Optional[dict] = None):
        self.user = user
        self.auth_method = auth_method
        self.api_key = api_key or {}

    # ---- 身份 ----
    @property
    def user_id(self) -> str:
        return str(self.user.userid)

    @property
    def username(self) -> str:
        return getattr(self.user, "username", "")

    # ---- 密钥上下文 ----
    @property
    def api_key_id(self) -> Optional[str]:
        return self.api_key.get("id")

    @property
    def api_key_name(self) -> Optional[str]:
        return self.api_key.get("key_name")

    @property
    def permissions(self) -> List[str]:
        if self.auth_method == AUTH_METHOD_JWT:
            # JWT 登录用户即账号所有者，视为持有全部权限
            return list(ALL_PERMISSIONS)
        return parse_permissions(self.api_key.get("permissions"))

    def describe(self) -> str:
        if self.auth_method == AUTH_METHOD_JWT:
            return f"jwt:{self.username}"
        return f"api_key:{self.api_key_name or self.api_key_id}"

    def open_user_db(self) -> Session:
        """打开该用户对应的业务数据库会话（调用方负责关闭）"""
        return get_user_db(self.user_id)


class RequirePermission:
    """
    认证 + 权限校验依赖工厂

    用法：
        @router.get("/xxx")
        async def foo(principal: AuthPrincipal = Depends(require_data_read)):
            db = principal.open_user_db()
            ...
    """

    def __init__(
        self,
        permission: Optional[str] = None,
        *,
        allow_jwt: bool = True,
        allow_api_key: bool = True
    ):
        self.permission = permission
        self.allow_jwt = allow_jwt
        self.allow_api_key = allow_api_key

    async def __call__(
        self,
        authorization: Optional[str] = Header(None, description="JWT令牌，格式：Bearer <token>"),
        x_api_key: Optional[str] = Header(None, description="API密钥，格式：green-xxx"),
        db: Session = Depends(get_meta_db)
    ) -> AuthPrincipal:
        # 1. JWT 优先（与历史上传接口一致）
        if authorization:
            if not self.allow_jwt:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="该接口不接受 JWT 认证，请使用 API 密钥调用"
                )
            if not authorization.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="无效的Authorization格式，应为：Bearer <token>",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=authorization[7:]
            )
            user = await get_current_user(credentials, db)
            return AuthPrincipal(user=user, auth_method=AUTH_METHOD_JWT)

        # 2. API 密钥
        if x_api_key:
            from database.db_services.api_key_service import validate_api_key

            if not self.allow_api_key:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="该接口不接受 API 密钥认证，请使用 JWT 令牌调用"
                )
            key_info = validate_api_key(db, x_api_key)
            if not key_info:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="无效的API密钥（密钥不存在、已禁用或已过期）",
                    headers={"WWW-Authenticate": "ApiKey"},
                )

            permissions = parse_permissions(key_info.get("permissions"))
            if self.permission and self.permission not in permissions:
                from utils.permissions import get_permission_definition

                definition = get_permission_definition(self.permission) or {}
                label = definition.get("label") or self.permission
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"密钥未授予「{label}」权限，请在密钥管理中勾选后重试"
                )

            user = db.query(User).filter(User.userid == key_info["user_id"]).first()
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API密钥关联的用户不存在"
                )
            return AuthPrincipal(user=user, auth_method=AUTH_METHOD_API_KEY, api_key=key_info)

        # 3. 两者都未提供
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "需要认证：请提供 Authorization: Bearer <jwt_token> "
                f"或 X-API-Key: <api_key>{f'（所需权限：{self.permission}）' if self.permission else ''}"
            )
        )


# 三个权限对应的可复用依赖
require_data_upload = RequirePermission(PERMISSION_DATA_UPLOAD)
require_data_read = RequirePermission(PERMISSION_DATA_READ)
require_device_control = RequirePermission(PERMISSION_DEVICE_CONTROL)

# 仅要求登录/有效密钥、不校验具体权限项的依赖
# 适用于「拉取云端下发的采集任务」这类与数据读写/设备控制无关的设备作业接口
require_authenticated = RequirePermission()