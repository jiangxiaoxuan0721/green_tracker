from sqlalchemy import Column
from sqlalchemy.orm import Session
from database.db_models.meta_model import User
import uuid
from typing import Optional
from database.db_services.user_raw_data_service import init_user_raw_data_tables, remove_user_raw_data_tables
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
    
    # 初始化用户的原始数据表
    print(f"[后端UserService] 初始化用户 {new_user.userid} 的原始数据表")
    if init_user_raw_data_tables(new_user.userid):
        print(f"[后端UserService] 用户 {new_user.userid} 的原始数据表初始化成功")
    else:
        print(f"[后端UserService] 用户 {new_user.userid} 的原始数据表初始化失败")
    
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
        # 先删除用户的原始数据表
        print(f"[后端UserService] 删除用户 {userid} 的原始数据表")
        if remove_user_raw_data_tables(userid):
            print(f"[后端UserService] 用户 {userid} 的原始数据表删除成功")
        else:
            print(f"[后端UserService] 用户 {userid} 的原始数据表删除失败")
        
        # 删除用户记录
        db.delete(user)
        db.commit()
        
        print(f"[后端UserService] 用户 {userid} 删除成功")
        return True
    except Exception as e:
        print(f"[后端UserService] 删除用户 {userid} 失败: {e}")
        db.rollback()
        return False