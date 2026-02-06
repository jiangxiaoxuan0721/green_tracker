"""
数据库管理 API 路由
提供管理员专用的数据库管理接口
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging
from database.main_db import get_db
from database.main_db import get_meta_db
from database.user_db_manager import db_manager
from database.create_user_database import (
    create_user_database,
    drop_user_database,
    get_user_database_info,
    generate_user_database_name
)
from database.db_models.meta_model import UserDatabase, SchemaVersion, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/database", tags=["database-management"])


# Pydantic 模型
from pydantic import BaseModel


class DatabaseInfo(BaseModel):
    user_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    database_name: str
    database_host: str
    database_port: int
    is_active: bool
    created_at: datetime
    storage_size_mb: Optional[int] = None
    table_count: Optional[int] = None
    record_count: Optional[int] = None


class DatabaseCreateRequest(BaseModel):
    user_id: str
    database_host: Optional[str] = None
    database_port: Optional[int] = None


class DatabaseStats(BaseModel):
    total_users: int
    users: List[dict]


# ============================================================================
# 数据库管理接口
# ============================================================================

@router.get("/list", response_model=List[DatabaseInfo])
async def list_user_databases(
    db: Session = Depends(get_db)
):
    """
    列出所有用户数据库信息

    Returns:
        用户数据库信息列表
    """
    user_dbs = db.query(UserDatabase).filter(UserDatabase.is_active == True).all()

    result = []
    for user_db in user_dbs:
        # 获取用户信息
        user = db.query(User).filter(User.userid == user_db.user_id).first()

        result.append(DatabaseInfo(
            user_id=user_db.user_id,
            username=user.username if user else None,
            email=user.email if user else None,
            database_name=user_db.database_name,
            database_host=user_db.database_host,
            database_port=user_db.database_port,
            is_active=user_db.is_active,
            created_at=user_db.created_at,
            storage_size_mb=user_db.storage_size_mb,
            table_count=user_db.table_count,
            record_count=user_db.record_count
        ))

    return result


@router.get("/info/{user_id}", response_model=DatabaseInfo)
async def get_database_info(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的数据库信息

    Args:
        user_id: 用户ID

    Returns:
        数据库信息
    """
    user_db = db.query(UserDatabase).filter(
        UserDatabase.user_id == user_id,
        UserDatabase.is_active == True
    ).first()

    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} database not found"
        )

    # 获取用户信息
    user = db.query(User).filter(User.userid == user_db.user_id).first()

    return DatabaseInfo(
        user_id=user_db.user_id,
        username=user.username if user else None,
        email=user.email if user else None,
        database_name=user_db.database_name,
        database_host=user_db.database_host,
        database_port=user_db.database_port,
        is_active=user_db.is_active,
        created_at=user_db.created_at,
        storage_size_mb=user_db.storage_size_mb,
        table_count=user_db.table_count,
        record_count=user_db.record_count
    )


@router.post("/create")
async def create_database(
    request: DatabaseCreateRequest,
    db: Session = Depends(get_db)
):
    """
    为用户创建独立数据库

    Args:
        request: 数据库创建请求

    Returns:
        创建结果
    """
    # 检查用户是否存在
    user = db.query(User).filter(User.userid == request.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {request.user_id} not found"
        )

    # 检查是否已存在数据库
    existing = db.query(UserDatabase).filter(
        UserDatabase.user_id == request.user_id,
        UserDatabase.is_active == True
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {request.user_id} already has an active database"
        )

    try:
        result = create_user_database(
            user_id=request.user_id,
            database_host=request.database_host,
            database_port=request.database_port
        )
        return {
            "message": "Database created successfully",
            "database": result
        }
    except Exception as e:
        logger.error(f"Failed to create database for user {request.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create database: {str(e)}"
        )


@router.delete("/{user_id}")
async def delete_database(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    删除用户数据库

    Args:
        user_id: 用户ID

    Returns:
        删除结果
    """
    # 检查用户是否存在
    user = db.query(User).filter(User.userid == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )

    # 检查数据库是否存在
    user_db = db.query(UserDatabase).filter(
        UserDatabase.user_id == user_id,
        UserDatabase.is_active == True
    ).first()

    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} database not found"
        )

    try:
        drop_user_database(user_id)
        return {
            "message": f"Database for user {user_id} deleted successfully"
        }
    except Exception as e:
        logger.error(f"Failed to delete database for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete database: {str(e)}"
        )


@router.post("/recreate/{user_id}")
async def recreate_database(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    为用户重新创建数据库（如果数据库已存在，先删除再创建）

    Args:
        user_id: 用户ID

    Returns:
        创建结果
    """
    # 检查用户是否存在
    user = db.query(User).filter(User.userid == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )

    try:
        # 先删除现有数据库（如果存在）
        user_db = db.query(UserDatabase).filter(
            UserDatabase.user_id == user_id,
            UserDatabase.is_active == True
        ).first()

        if user_db:
            logger.info(f"Database exists for user {user_id}, dropping it...")
            try:
                drop_user_database(user_id)
            except Exception as e:
                logger.warning(f"Failed to drop existing database: {e}")
                # 标记为不活跃，继续创建新的
                user_db.is_active = False
                db.commit()

        # 创建新数据库
        result = create_user_database(user_id=user_id)
        logger.info(f"Database recreated successfully for user {user_id}")

        return {
            "message": f"Database for user {user_id} recreated successfully",
            "database": result
        }
    except Exception as e:
        logger.error(f"Failed to recreate database for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recreate database: {str(e)}"
        )


@router.get("/stats", response_model=DatabaseStats)
async def get_database_stats():
    """
    获取数据库连接管理器统计信息

    Returns:
        统计信息
    """
    stats = db_manager.get_stats()
    return DatabaseStats(**stats)


@router.post("/test-connection/{user_id}")
async def test_database_connection(user_id: str):
    """
    测试用户数据库连接

    Args:
        user_id: 用户ID

    Returns:
        连接测试结果
    """
    success = db_manager.test_connection(user_id)

    return {
        "user_id": user_id,
        "connection_status": "success" if success else "failed"
    }


@router.post("/sync-connections")
async def sync_database_connections(db: Session = Depends(get_db)):
    """
    同步数据库连接
    确保所有活跃用户都有对应的数据库连接

    Returns:
        同步结果
    """
    user_dbs = db.query(UserDatabase).filter(UserDatabase.is_active == True).all()
    current_users = set(db_manager.get_active_users())
    target_users = {user_db.user_id for user_db in user_dbs}

    # 需要移除的连接
    to_remove = current_users - target_users
    for user_id in to_remove:
        db_manager.remove_user_db(user_id)

    # 需要添加的连接（将在下次请求时自动创建）
    to_add = target_users - current_users

    return {
        "message": "Database connections synced",
        "active_connections": len(current_users),
        "target_connections": len(target_users),
        "removed_connections": len(to_remove),
        "pending_connections": len(to_add)
    }


# ============================================================================
# Schema 版本管理
# ============================================================================

@router.get("/schema-versions/{user_id}")
async def get_schema_versions(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    获取用户的 Schema 版本历史

    Args:
        user_id: 用户ID

    Returns:
        Schema 版本列表
    """
    versions = db.query(SchemaVersion).filter(
        SchemaVersion.user_id == user_id
    ).order_by(SchemaVersion.applied_at.desc()).all()

    return {
        "user_id": user_id,
        "versions": [
            {
                "version": v.version,
                "applied_at": v.applied_at,
                "migration_file": v.migration_file,
                "description": v.description
            }
            for v in versions
        ]
    }


@router.post("/schema-version/{user_id}")
async def add_schema_version(
    user_id: str,
    version: str,
    migration_file: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    为用户添加 Schema 版本记录

    Args:
        user_id: 用户ID
        version: 版本号
        migration_file: 迁移文件路径
        description: 版本描述

    Returns:
        添加结果
    """
    import uuid

    schema_version = SchemaVersion(
        id=str(uuid.uuid4()),
        user_id=user_id,
        version=version,
        migration_file=migration_file,
        description=description
    )

    db.add(schema_version)
    db.commit()

    return {
        "message": "Schema version added successfully",
        "version": version
    }
