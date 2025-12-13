from sqlalchemy import Column
from sqlalchemy.orm import Session
from database.db_models.user_model import User
import uuid
from typing import Optional

def create_user(db: Session, username: str, email: str, password_hash: str) -> User:
    """
    创建新用户
    
    Args:
        db: 数据库会话
        username: 用户名
        email: 邮箱
        password_hash: 加密后的密码哈希
    
    Returns:
        User: 创建的用户对象
    
    Raises:
        Exception: 如果用户名已存在
    """
    # 检查用户名是否已存在
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise Exception("用户名已存在")
    
    # 创建新用户
    new_user = User(
        userid=str(uuid.uuid4()),
        username=username,
        email=email,
        password_hash=password_hash
    )
    
    # 保存到数据库
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

def verify_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    验证用户登录
    
    Args:
        db: 数据库会话
        username: 用户名
        password: 原始密码
    
    Returns:
        User: 验证成功返回用户对象，失败返回None
    """
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # 查找用户
    user = db.query(User).filter(User.username == username).first()
    
    # 验证用户是否存在和密码是否匹配
    if user:
        if pwd_context.verify(password, str(user.password_hash)):
            return user
    
    return None

def get_user_by_id(db: Session, userid: str) -> Optional[User]:
    """
    根据用户ID获取用户信息
    
    Args:
        db: 数据库会话
        userid: 用户ID
    
    Returns:
        User: 用户对象，不存在返回None
    """
    return db.query(User).filter(User.userid == userid).first()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    根据用户名获取用户信息
    
    Args:
        db: 数据库会话
        username: 用户名
    
    Returns:
        User: 用户对象，不存在返回None
    """
    return db.query(User).filter(User.username == username).first()

def update_user_email(db: Session, userid: str, new_email: str) -> Optional[User]:
    """
    更新用户邮箱
    
    Args:
        db: 数据库会话
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