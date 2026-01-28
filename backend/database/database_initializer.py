"""
数据库初始化器
统一的数据库初始化逻辑，包括元数据库和模板数据库的初始化
"""

import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path
import logging

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

# 数据库配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "green_tracker")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_SUPERUSER = os.getenv("DB_SUPERUSER", "postgres")
DB_SUPERPASSWORD = os.getenv("DB_SUPERPASSWORD", "")
USE_UNIX_SOCKET = os.getenv("USE_UNIX_SOCKET", "false").lower() == "true"

logger = logging.getLogger(__name__)


class DatabaseInitializer:
    """数据库初始化器类"""

    @staticmethod
    def get_admin_connection():
        """
        获取管理员连接（用于创建数据库）
        优先使用超级用户，如果失败则使用普通用户

        Returns:
            psycopg2.connection: 数据库连接对象

        Raises:
            Exception: 连接失败时抛出异常
        """
        # 方式1: 使用超级用户 + TCP
        try:
            conn = psycopg2.connect(
                f"postgresql://{DB_SUPERUSER}:{DB_SUPERPASSWORD}@{DB_HOST}:{DB_PORT}/postgres",
                connect_timeout=3
            )
            logger.info("Connected using superuser via TCP")
            return conn
        except Exception as e:
            logger.warning(f"Superuser connection failed: {e}")

        # 方式2: 使用普通用户 + TCP
        try:
            conn = psycopg2.connect(
                f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/postgres",
                connect_timeout=3
            )
            logger.info("Connected using green_tracker user via TCP")
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise Exception(f"无法连接到数据库: {e}")

    @staticmethod
    def init_meta_database():
        """
        初始化元数据库（green_tracker）
        包含用户管理、用户数据库映射、Schema版本等元数据表

        Returns:
            dict: 初始化结果

        Raises:
            Exception: 初始化失败时抛出异常
        """
        logger.info("Initializing meta database...")

        conn = None
        try:
            # 1. 连接到 postgres 数据库
            conn = DatabaseInitializer.get_admin_connection()
            conn.autocommit = True

            with conn.cursor() as cursor:
                # 2. 检查并创建主数据库
                cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{DB_USER}'")
                exists = cursor.fetchone()

                if not exists:
                    logger.info(f"Creating database {DB_USER}...")
                    cursor.execute(f'CREATE DATABASE "{DB_USER}" OWNER {DB_USER}')
                    logger.info(f"Database {DB_USER} created successfully")
                else:
                    logger.info(f"Database {DB_USER} already exists")

                # 3. 授予权限
                cursor.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{DB_USER}" TO {DB_USER}')

            conn.close()

            # 4. 连接到主数据库创建表结构
            from database.main_db import Base, SessionLocal
            from database.db_models.meta_model import User, UserDatabase, SchemaVersion

            # 创建所有表（使用 checkfirst=True 避免重复创建）
            with SessionLocal() as db:
                # 检查表是否存在，如果存在则检查是否需要迁移
                from sqlalchemy import inspect
                inspector = inspect(db.bind)
                existing_tables = inspector.get_table_names()

                if not existing_tables:
                    Base.metadata.create_all(bind=db.bind, checkfirst=True)
                    logger.info("Meta tables created successfully")
                else:
                    logger.info(f"Meta tables already exist: {', '.join(existing_tables)}")

                    # 检查 users 表是否需要迁移（添加缺失的字段）
                    if 'users' in existing_tables:
                        users_columns = {col['name'] for col in inspector.get_columns('users')}
                        required_columns = {
                            'userid', 'username', 'email', 'password_hash', 'status',
                            'subscription_plan', 'storage_quota_gb', 'storage_used_gb',
                            'max_databases', 'settings', 'last_login_at', 'created_at', 'updated_at'
                        }

                        missing_columns = required_columns - users_columns
                        if missing_columns:
                            logger.warning(f"Users table is missing columns: {', '.join(missing_columns)}")
                            logger.info("Migrating users table...")

                            # 使用原生 SQL 添加缺失的字段
                            conn = psycopg2.connect(
                                f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_USER}"
                            )
                            conn.autocommit = True
                            with conn.cursor() as cursor:
                                # 添加缺失的字段
                                if 'status' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'")
                                if 'subscription_plan' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(20) NOT NULL DEFAULT 'basic'")
                                if 'storage_quota_gb' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN storage_quota_gb INTEGER NOT NULL DEFAULT 10")
                                if 'storage_used_gb' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN storage_used_gb INTEGER NOT NULL DEFAULT 0")
                                if 'max_databases' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN max_databases INTEGER NOT NULL DEFAULT 1")
                                if 'settings' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'")
                                if 'last_login_at' in missing_columns:
                                    cursor.execute("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE")

                                # 创建缺失的索引
                                cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)")
                                cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_status ON users(status)")
                                cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_subscription ON users(subscription_plan)")

                                logger.info("Users table migration completed")
                            conn.close()

                # 5. 验证表是否创建
                user_count = db.query(User).count()
                db_count = db.query(UserDatabase).count()
                version_count = db.query(SchemaVersion).count()

                logger.info(f"Meta database verified: {user_count} users, {db_count} databases, {version_count} versions")

            return {
                "status": "success",
                "database": DB_USER,
                "message": "Meta database initialized successfully"
            }

        except Exception as e:
            logger.error(f"Failed to initialize meta database: {e}")
            if conn:
                conn.close()
            raise

    @staticmethod
    def init_template_database():
        """
        初始化模板数据库（green_tracker_template）
        模板数据库用于快速创建新用户的数据库
        包含所有用户表的预定义结构

        Returns:
            dict: 初始化结果

        Raises:
            Exception: 初始化失败时抛出异常
        """
        logger.info("Initializing template database...")

        template_db_name = "green_tracker_template"
        conn = None

        try:
            # 1. 连接到 postgres 数据库
            conn = DatabaseInitializer.get_admin_connection()
            conn.autocommit = True

            with conn.cursor() as cursor:
                # 2. 检查模板数据库是否存在
                cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{template_db_name}'")
                exists = cursor.fetchone()

                # 3. 如果存在，先删除
                if exists:
                    logger.info(f"Template database {template_db_name} exists, dropping it...")
                    cursor.execute(f'DROP DATABASE IF EXISTS "{template_db_name}"')

                # 4. 创建新的模板数据库
                logger.info(f"Creating template database {template_db_name}...")
                cursor.execute(f'CREATE DATABASE "{template_db_name}" OWNER {DB_USER}')
                logger.info(f"Template database {template_db_name} created successfully")

                # 5. 授予权限
                cursor.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{template_db_name}" TO {DB_USER}')

            conn.close()

            # 6. 连接到模板数据库创建表结构
            from sqlalchemy import create_engine
            from database.db_models.user_models import (
                Field, Device, CollectionSession,
                RawData, RawDataTag, CropObject
            )

            # 创建引擎
            template_engine = create_engine(
                f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{template_db_name}"
            )

            # 创建所有表
            Field.__table__.create(bind=template_engine, checkfirst=True)
            Device.__table__.create(bind=template_engine, checkfirst=True)
            CollectionSession.__table__.create(bind=template_engine, checkfirst=True)
            RawData.__table__.create(bind=template_engine, checkfirst=True)
            RawDataTag.__table__.create(bind=template_engine, checkfirst=True)
            CropObject.__table__.create(bind=template_engine, checkfirst=True)

            logger.info("Template tables created successfully")

            # 7. 启用 PostGIS 扩展
            from sqlalchemy import text
            with template_engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis_topology"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                conn.commit()
                logger.info("PostGIS extensions enabled in template database")

            template_engine.dispose()

            return {
                "status": "success",
                "database": template_db_name,
                "message": "Template database initialized successfully"
            }

        except Exception as e:
            logger.error(f"Failed to initialize template database: {e}")
            if conn:
                conn.close()
            raise

    @staticmethod
    def verify_database(db_name: str = None) -> dict:
        """
        验证数据库是否正常工作

        Args:
            db_name: 数据库名称（可选，默认验证主数据库）

        Returns:
            dict: 验证结果

        Raises:
            Exception: 验证失败时抛出异常
        """
        logger.info(f"Verifying database: {db_name or DB_USER}")

        try:
            # 连接到数据库
            conn = psycopg2.connect(
                f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name or DB_USER}",
                connect_timeout=5
            )

            with conn.cursor() as cursor:
                # 测试查询
                cursor.execute("SELECT version()")
                version = cursor.fetchone()[0]
                logger.info(f"Database version: {version.split(',')[0]}")

                # 检查扩展
                cursor.execute("SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'uuid-ossp', 'pg_trgm')")
                extensions = [row[0] for row in cursor.fetchall()]
                logger.info(f"Installed extensions: {', '.join(extensions)}")

                # 检查表
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                tables = [row[0] for row in cursor.fetchall()]
                logger.info(f"Tables: {', '.join(tables)}")

            conn.close()

            return {
                "status": "success",
                "database": db_name or DB_USER,
                "extensions": extensions,
                "tables": tables,
                "message": "Database verified successfully"
            }

        except Exception as e:
            logger.error(f"Failed to verify database: {e}")
            raise


# 便捷函数
def init_meta():
    """初始化元数据库的便捷函数"""
    return DatabaseInitializer.init_meta_database()


def init_template():
    """初始化模板数据库的便捷函数"""
    return DatabaseInitializer.init_template_database()


def verify(db_name: str = None):
    """验证数据库的便捷函数"""
    return DatabaseInitializer.verify_database(db_name)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python database_initializer.py <command>")
        print("Commands:")
        print("  init-meta    - Initialize meta database")
        print("  init-template - Initialize template database")
        print("  verify       - Verify database")
        sys.exit(1)

    command = sys.argv[1]

    if command == "init-meta":
        result = init_meta()
        print(f"Success: {result}")
    elif command == "init-template":
        result = init_template()
        print(f"Success: {result}")
    elif command == "verify":
        db_name = sys.argv[2] if len(sys.argv) > 2 else None
        result = verify(db_name)
        print(f"Success: {result}")
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
