from sqlalchemy import Column
from sqlalchemy.orm import Session
from database.db_models.meta_model import User
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from database.main_db import get_meta_db

def create_user(db: Session, username: str, email: str, password_hash: str) -> User:
    """
    创建新用户
    
    Args:
        db: 元数据库会话
        username: 用户名
        email: 邮箱
        password_hash: 加密后的密码哈希
    
    Returns:
        User: 创建的用户对象
    
    Raises:
        Exception: 如果用户名已存在
    """
    print(f"[后端UserService] 开始创建用户: 用户名={username}, 邮箱={email}")
    
    # 检查用户名是否已存在
    print("[后端UserService] 检查用户名是否已存在")
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        print(f"[后端UserService] 用户名已存在: {username}")
        raise Exception("用户名已存在")
    
    # 创建新用户
    print("[后端UserService] 创建新用户对象")
    new_user = User(
        userid=str(uuid.uuid4()),
        username=username,
        email=email,
        password_hash=password_hash
    )
    
    print(f"[后端UserService] 用户对象创建成功, userid={new_user.userid}")
    
    # 保存到数据库
    print("[后端UserService] 保存用户到数据库")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 创建用户的独立数据库
    print(f"[后端UserService] 为用户 {new_user.userid} 创建独立数据库")
    try:
        from database.create_user_database import create_user_database
        create_user_database(new_user.userid)
        print(f"[后端UserService] 用户 {new_user.userid} 的数据库创建成功")
    except Exception as e:
        print(f"[后端UserService] 用户 {new_user.userid} 的数据库创建失败: {e}")
        # 注意: 这里不回滚用户创建，因为数据库创建可以在之后手动完成

    print(f"[后端UserService] 用户保存成功: {new_user.userid}")
    return new_user

def verify_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    验证用户登录
    
    Args:
        db: 元数据库会话
        username: 用户名
        password: 原始密码
    
    Returns:
        User: 验证成功返回用户对象，失败返回None
    """
    from passlib.context import CryptContext
    
    print(f"[后端UserService] 开始验证用户: {username}")
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # 查找用户
    print("[后端UserService] 查询用户信息")
    user = db.query(User).filter(User.username == username).first()
    
    # 验证用户是否存在和密码是否匹配
    if user:
        print(f"[后端UserService] 找到用户: {user.userid}, 开始验证密码")
        if pwd_context.verify(password, str(user.password_hash)):
            print(f"[后端UserService] 密码验证成功")
            return user
        else:
            print(f"[后端UserService] 密码验证失败")
    else:
        print(f"[后端UserService] 用户不存在: {username}")
    
    return None

def get_user_by_id(db: Session, userid: str) -> Optional[User]:
    """
    根据用户ID获取用户信息
    
    Args:
        db: 元数据库会话
        userid: 用户ID
    
    Returns:
        User: 用户对象，不存在返回None
    """
    return db.query(User).filter(User.userid == userid).first()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    根据用户名获取用户信息
    
    Args:
        db: 元数据库会话
        username: 用户名
    
    Returns:
        User: 用户对象，不存在返回None
    """
    return db.query(User).filter(User.username == username).first()

def update_user_email(db: Session, userid: str, new_email: str) -> Optional[User]:
    """
    更新用户邮箱
    
    Args:
        db: 元数据库会话
        userid: 用户ID
        new_email: 新邮箱地址
    
    Returns:
        User: 更新后的用户对象，不存在返回None
    """
    user = db.query(User).filter(User.userid == userid).first()
    if user:
        # 使用update方法来确保类型正确
        db.query(User).filter(User.userid == userid).update({"email": new_email})
        db.commit()
        # 刷新对象以获取更新后的值
        db.refresh(user)
        return user
    return None


def delete_user(db: Session, userid: str) -> bool:
    """
    删除用户及其所有相关数据
    
    Args:
        db: 元数据库会话
        userid: 用户ID
    
    Returns:
        bool: 删除是否成功
    """
    print(f"[后端UserService] 开始删除用户: {userid}")
    
    # 查找用户
    user = db.query(User).filter(User.userid == userid).first()
    if not user:
        print(f"[后端UserService] 用户不存在: {userid}")
        return False
    
    try:
        # 先删除用户的独立数据库
        print(f"[后端UserService] 删除用户 {userid} 的数据库")
        try:
            from database.create_user_database import drop_user_database
            drop_user_database(userid)
            print(f"[后端UserService] 用户 {userid} 的数据库删除成功")
        except Exception as e:
            print(f"[后端UserService] 用户 {userid} 的数据库删除失败: {e}")
            # 注意: 这里继续删除用户记录，因为数据库可能已经被手动删除

        # 删除用户记录
        db.delete(user)
        db.commit()

        print(f"[后端UserService] 用户 {userid} 删除成功")
        return True
    except Exception as e:
        print(f"[后端UserService] 删除用户 {userid} 失败: {e}")
        db.rollback()
        return False


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    根据邮箱获取用户信息
    优先返回已验证邮箱的用户（处理同一邮箱存在多个记录的情况）

    Args:
        db: 元数据库会话
        email: 用户邮箱

    Returns:
        User: 用户对象，不存在返回None
    """
    users = db.query(User).filter(User.email == email).all()
    if not users:
        return None
    # 优先返回已验证邮箱的用户
    for user in users:
        if user.email_verified:
            return user
    # 否则返回第一个
    return users[0]


def save_verification_code(db: Session, email: str, code: str) -> bool:
    """
    为用户保存验证码（优先更新已存在的用户，否则创建临时记录）

    Args:
        db: 元数据库会话
        email: 用户邮箱
        code: 验证码

    Returns:
        bool: 是否保存成功
    """
    user = get_user_by_email(db, email)
    if user:
        user.verification_code = code
        user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    else:
        # 邮箱未注册时，创建临时用户记录用于存储验证码
        temp_user = User(
            userid=str(uuid.uuid4()),
            username=f"pending_{email.replace('@', '_at_').replace('.', '_')}",
            email=email,
            password_hash="pending",
            email_verified=False,
            verification_code=code,
            verification_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )
        db.add(temp_user)
    db.commit()
    return True


def verify_and_clear_code(db: Session, email: str, code: str) -> bool:
    """
    验证邮箱验证码，验证成功后清除验证码并标记邮箱已验证

    Args:
        db: 元数据库会话
        email: 用户邮箱
        code: 用户输入的验证码

    Returns:
        bool: 验证是否成功
    """
    user = get_user_by_email(db, email)
    if not user or not user.verification_code:
        return False

    if user.verification_code_expires_at and user.verification_code_expires_at < datetime.now(timezone.utc):
        return False  # 验证码已过期

    if user.verification_code != code:
        return False

    # 验证成功，清除验证码
    user.verification_code = None
    user.verification_code_expires_at = None
    db.commit()
    return True


def reset_password(db: Session, email: str, code: str, new_password_hash: str) -> Optional[User]:
    """
    通过邮箱验证码重置密码

    Args:
        db: 元数据库会话
        email: 用户邮箱
        code: 邮箱验证码
        new_password_hash: 新密码的哈希值

    Returns:
        User: 重置成功返回用户对象，失败返回None
    """
    # 验证验证码
    user = get_user_by_email(db, email)
    if not user or not user.verification_code:
        return None

    if user.verification_code_expires_at and user.verification_code_expires_at < datetime.now(timezone.utc):
        return None  # 验证码已过期

    if user.verification_code != code:
        return None

    # 验证成功，更新密码并清除验证码
    user.password_hash = new_password_hash
    user.verification_code = None
    user.verification_code_expires_at = None
    db.commit()
    db.refresh(user)
    return user