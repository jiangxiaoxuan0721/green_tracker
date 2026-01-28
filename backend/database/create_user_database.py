"""
用户数据库创建脚本
用于为新用户创建独立的数据库并初始化表结构
简化版：不创建数据库用户，使用主数据库用户管理所有用户数据库
"""

import psycopg2
from sqlalchemy import create_engine, text
import logging
import uuid
from datetime import datetime

import os
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

# 数据库配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_SUPERUSER = os.getenv("DB_SUPERUSER", "postgres")
DB_SUPERPASSWORD = os.getenv("DB_SUPERPASSWORD", "")

# 是否使用Unix Socket连接（Peer认证，不需要密码）
USE_UNIX_SOCKET = os.getenv("USE_UNIX_SOCKET", "false").lower() == "true"

# 模板数据库名称
TEMPLATE_DB_NAME = "green_tracker_template"

logger = logging.getLogger(__name__)


def generate_user_database_name(user_id: str) -> str:
    """
    生成用户数据库名称

    Args:
        user_id: 用户ID

    Returns:
        数据库名称，格式：green_tracker_user_{user_id}
    """
    return f"green_tracker_user_{user_id}"


def create_user_database(user_id: str, database_host: str = None, database_port: int = None) -> dict:
    """
    为用户创建独立数据库并初始化表结构
    简化版：不创建数据库用户，使用主数据库用户管理

    Args:
        user_id: 用户ID
        database_host: 数据库主机（可选，默认使用环境变量）
        database_port: 数据库端口（可选，默认使用环境变量）

    Returns:
        包含数据库信息的字典

    Raises:
        Exception: 创建失败时抛出异常
    """
    db_host = database_host or DB_HOST
    db_port = database_port or DB_PORT
    db_name = generate_user_database_name(user_id)

    logger.info(f"Creating database {db_name} for user {user_id}")

    try:
        # 1. 连接到 postgres 数据库（尝试多种连接方式）
        admin_conn = None
        last_error = None

        # 方式1: 使用 green_tracker 用户 + TCP（推荐，因为这个用户应该有 CREATEDB 权限）
        try:
            admin_conn = psycopg2.connect(
                f"postgresql://{DB_USER}:{DB_PASSWORD}@{db_host}:{db_port}/postgres",
                connect_timeout=3
            )
            logger.info(f"Connected using {DB_USER} user via TCP (port {db_port})")
        except Exception as e:
            last_error = e
            logger.warning(f"{DB_USER} user connection failed: {e}")

        # 方式2: 使用 postgres 超级用户 + TCP（如果方式1失败）
        if admin_conn is None:
            try:
                admin_conn = psycopg2.connect(
                    f"postgresql://{DB_SUPERUSER}:{DB_SUPERPASSWORD}@{db_host}:{db_port}/postgres",
                    connect_timeout=3
                )
                logger.info(f"Connected using {DB_SUPERUSER} user via TCP (port {db_port})")
            except Exception as e:
                last_error = e
                logger.warning(f"{DB_SUPERUSER} user connection failed: {e}")

        # 所有方式都失败
        if admin_conn is None:
            raise Exception(f"无法连接到PostgreSQL数据库。最后错误: {last_error}")

        admin_conn.autocommit = True

        # 2. 创建用户数据库（使用主数据库用户作为 owner）
        with admin_conn.cursor() as cursor:
            # 检查数据库是否已存在
            cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
            exists = cursor.fetchone()

            if exists:
                logger.warning(f"Database {db_name} already exists, skipping creation")
            else:
                # 使用模板数据库创建（模板数据库已包含 PostGIS 扩展）
                cursor.execute(f'CREATE DATABASE "{db_name}" TEMPLATE "{TEMPLATE_DB_NAME}" OWNER {DB_USER}')
                logger.info(f"Database {db_name} created from template")
                # 授权给DB_USER
                try:
                    cursor.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db_name}" TO {DB_USER}')
                    logger.info(f"Database {db_name} granted to {DB_USER}")
                except Exception as e:
                    logger.warning(f"Failed to grant privileges: {e}")

        admin_conn.close()

        # 4. 创建独立的引擎用于用户数据库
        user_engine = create_engine(
            f"postgresql://{DB_USER}:{DB_PASSWORD}@{db_host}:{db_port}/{db_name}"
        )

        # 5. 导入用户数据库模型并创建表
        from database.db_models.user_models import Field, Device, CollectionSession, RawData, RawDataTag, CropObject

        # 创建所有表
        try:
            from sqlalchemy import inspect
            inspector = inspect(user_engine)
            existing_tables = inspector.get_table_names()
            logger.info(f"Existing tables in {db_name}: {existing_tables}")

            # 为每个模型创建表
            Field.__table__.create(bind=user_engine, checkfirst=True)
            Device.__table__.create(bind=user_engine, checkfirst=True)
            CollectionSession.__table__.create(bind=user_engine, checkfirst=True)
            RawData.__table__.create(bind=user_engine, checkfirst=True)
            RawDataTag.__table__.create(bind=user_engine, checkfirst=True)
            CropObject.__table__.create(bind=user_engine, checkfirst=True)

            logger.info(f"Tables created in database {db_name}")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise

        # 5. 在元数据库中记录用户数据库信息
        from database.main_db import SessionLocal
        from database.db_models.meta_model import UserDatabase, SchemaVersion

        with SessionLocal() as meta_db:
            # 检查是否已存在记录
            existing = meta_db.query(UserDatabase).filter(UserDatabase.user_id == user_id).first()

            if existing:
                # 更新现有记录
                existing.database_name = db_name
                existing.database_host = db_host
                existing.database_port = db_port
                existing.is_active = True
                existing.updated_at = datetime.utcnow()
                logger.info(f"Updated existing user database record for user {user_id}")
            else:
                # 创建新记录
                user_db = UserDatabase(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    database_name=db_name,
                    database_host=db_host,
                    database_port=db_port,
                    is_active=True
                )
                meta_db.add(user_db)
                logger.info(f"Created user database record for user {user_id}")

            # 记录 Schema 版本
            schema_version = SchemaVersion(
                id=str(uuid.uuid4()),
                user_id=user_id,
                version="v1.0.0",
                description="Initial database creation"
            )
            meta_db.add(schema_version)

            meta_db.commit()

        # 6. 关闭引擎
        user_engine.dispose()

        logger.info(f"User database created successfully for user {user_id}")

        return {
            "user_id": user_id,
            "database_name": db_name,
            "database_host": db_host,
            "database_port": db_port,
            "status": "success"
        }

    except Exception as e:
        logger.error(f"Failed to create database for user {user_id}: {e}")
        raise


def drop_user_database(user_id: str) -> bool:
    """
    删除用户数据库

    Args:
        user_id: 用户ID

    Returns:
        是否成功

    Raises:
        Exception: 删除失败时抛出异常
    """
    db_name = generate_user_database_name(user_id)
    db_host = DB_HOST
    db_port = DB_PORT

    logger.warning(f"Dropping database {db_name} for user {user_id}")

    try:
        # 1. 连接到 postgres 数据库（尝试多种连接方式）
        admin_conn = None
        last_error = None

        # 方式1: 使用 green_tracker 用户 + TCP
        try:
            admin_conn = psycopg2.connect(
                f"postgresql://{DB_USER}:{DB_PASSWORD}@{db_host}:{db_port}/postgres",
                connect_timeout=3
            )
            logger.info(f"Connected using {DB_USER} user via TCP for dropping database")
        except Exception as e:
            last_error = e
            logger.warning(f"{DB_USER} user connection failed: {e}")

        # 方式2: 使用 postgres 超级用户 + TCP
        if admin_conn is None:
            try:
                admin_conn = psycopg2.connect(
                    f"postgresql://{DB_SUPERUSER}:{DB_SUPERPASSWORD}@{db_host}:{db_port}/postgres",
                    connect_timeout=3
                )
                logger.info(f"Connected using {DB_SUPERUSER} user via TCP for dropping database")
            except Exception as e:
                last_error = e
                logger.warning(f"{DB_SUPERUSER} user connection failed: {e}")

        # 所有方式都失败
        if admin_conn is None:
            raise Exception(f"无法连接到PostgreSQL数据库。最后错误: {last_error}")

        admin_conn.autocommit = True

        # 2. 删除数据库
        with admin_conn.cursor() as cursor:
            # 检查数据库是否存在
            cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
            exists = cursor.fetchone()

            if not exists:
                logger.warning(f"Database {db_name} does not exist, skipping deletion")
                admin_conn.close()
                return True

            # 终止所有连接到该数据库的连接
            cursor.execute(f"""
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = '{db_name}'
                AND pid <> pg_backend_pid()
            """)

            # 删除数据库
            cursor.execute(f'DROP DATABASE "{db_name}"')
            logger.info(f"Database {db_name} dropped successfully")

        admin_conn.close()

        # 3. 从元数据库中移除记录
        from database.main_db import SessionLocal
        from database.db_models.meta_model import UserDatabase

        with SessionLocal() as meta_db:
            user_db = meta_db.query(UserDatabase).filter(UserDatabase.user_id == user_id).first()
            if user_db:
                # 标记为不活跃，而不是删除（保留历史记录）
                user_db.is_active = False
                meta_db.commit()
                logger.info(f"User database record marked as inactive for user {user_id}")

        # 4. 从连接管理器中移除
        from database.user_db_manager import db_manager
        db_manager.remove_user_db(user_id)

        return True

    except Exception as e:
        logger.error(f"Failed to drop database for user {user_id}: {e}")
        raise


def get_user_database_info(user_id: str) -> dict:
    """
    获取用户数据库信息

    Args:
        user_id: 用户ID

    Returns:
        数据库信息字典，如果不存在返回 None
    """
    from database.main_db import SessionLocal
    from database.db_models.meta_model import UserDatabase

    with SessionLocal() as meta_db:
        user_db = meta_db.query(UserDatabase).filter(
            UserDatabase.user_id == user_id,
            UserDatabase.is_active == True
        ).first()

        if not user_db:
            return None

        return {
            "user_id": user_db.user_id,
            "database_name": user_db.database_name,
            "database_host": user_db.database_host,
            "database_port": user_db.database_port,
            "is_active": user_db.is_active,
            "created_at": user_db.created_at,
            "storage_size_mb": user_db.storage_size_mb,
            "table_count": user_db.table_count,
            "record_count": user_db.record_count
        }


if __name__ == "__main__":
    # 测试代码
    import sys

    if len(sys.argv) < 2:
        print("Usage: python create_user_database.py <user_id> [create|drop|info]")
        sys.exit(1)

    user_id = sys.argv[1]
    command = sys.argv[2] if len(sys.argv) > 2 else "create"

    if command == "create":
        result = create_user_database(user_id)
        print(f"Success: {result}")
    elif command == "drop":
        drop_user_database(user_id)
        print(f"Database for user {user_id} dropped")
    elif command == "info":
        info = get_user_database_info(user_id)
        print(f"User database info: {info}")
    else:
        print(f"Unknown command: {command}")
