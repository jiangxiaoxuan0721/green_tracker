"""
修复现有用户数据库 - 添加缺失的表
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
import logging

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
backend_root = project_root / "backend"
sys.path.insert(0, str(backend_root))

# 加载环境变量
load_dotenv(os.path.join(project_root, '.env'))

# 数据库配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def fix_user_database(user_id: str) -> dict:
    """
    修复用户数据库，添加缺失的表

    Args:
        user_id: 用户ID

    Returns:
        包含修复信息的字典
    """
    db_name = f"green_tracker_user_{user_id}"
    database_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}"

    logger.info(f"Fixing database {db_name} for user {user_id}")

    try:
        # 创建数据库连接引擎
        engine = create_engine(database_url)

        # 检查现有表
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables: {existing_tables}")

        # 导入模型
        from database.db_models.user_models import (
            Field, Device, CollectionSession,
            RawData, RawDataTag, CropObject
        )

        # 需要创建的表
        tables_to_create = {
            'fields': Field,
            'devices': Device,
            'collection_sessions': CollectionSession,
            'raw_data': RawData,
            'raw_data_tags': RawDataTag,
            'crop_objects': CropObject
        }

        created_tables = []
        for table_name, model in tables_to_create.items():
            if table_name not in existing_tables:
                try:
                    model.__table__.create(bind=engine, checkfirst=True)
                    created_tables.append(table_name)
                    logger.info(f"Created table: {table_name}")
                except Exception as e:
                    logger.error(f"Failed to create table {table_name}: {e}")

        # 关闭引擎
        engine.dispose()

        logger.info(f"Database fix completed for user {user_id}")

        return {
            "user_id": user_id,
            "database_name": db_name,
            "existing_tables": existing_tables,
            "created_tables": created_tables,
            "status": "success"
        }

    except Exception as e:
        logger.error(f"Failed to fix database for user {user_id}: {e}")
        return {
            "user_id": user_id,
            "database_name": db_name,
            "status": "failed",
            "error": str(e)
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fix_user_database.py <user_id>")
        print("Example: python fix_user_database.py aad9242c-7b47-4cca-970c-57339abe1fe8")
        sys.exit(1)

    user_id = sys.argv[1]
    result = fix_user_database(user_id)
    print(f"Fix result: {result}")
