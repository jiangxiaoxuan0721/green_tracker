"""
测试用户数据库创建流程
验证从用户注册到数据库创建的完整流程
"""

import os
import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.database.main_db import SessionLocal, Base, engine
from backend.database.db_models.meta_model import UserDatabase, SchemaVersion
from backend.database.db_models.user_model import User
from backend.database.create_user_database import create_user_database, get_user_database_info
from passlib.context import CryptContext
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def test_create_user_database():
    """
    测试创建用户数据库的完整流程
    """
    logger.info("=" * 60)
    logger.info("开始测试用户数据库创建流程")
    logger.info("=" * 60)

    try:
        # 1. 创建测试用户
        test_user_id = str(uuid.uuid4())
        test_username = f"test_user_{test_user_id[:8]}"
        test_email = f"{test_username}@test.com"
        test_password = "test123456"

        logger.info(f"\n1. 创建测试用户...")
        logger.info(f"   用户ID: {test_user_id}")
        logger.info(f"   用户名: {test_username}")
        logger.info(f"   邮箱: {test_email}")

        with SessionLocal() as db:
            user = User(
                userid=test_user_id,
                username=test_username,
                email=test_email,
                password_hash=pwd_context.hash(test_password)
            )
            db.add(user)
            db.commit()
            logger.info(f"   ✓ 用户创建成功")

        # 2. 创建用户数据库
        logger.info(f"\n2. 创建用户数据库...")
        db_info = create_user_database(test_user_id)
        logger.info(f"   数据库名: {db_info['database_name']}")
        logger.info(f"   主机: {db_info['database_host']}")
        logger.info(f"   端口: {db_info['database_port']}")
        logger.info(f"   ✓ 用户数据库创建成功")

        # 3. 验证数据库记录
        logger.info(f"\n3. 验证数据库记录...")
        db_record = get_user_database_info(test_user_id)
        if db_record:
            logger.info(f"   数据库记录已创建:")
            logger.info(f"   - database_name: {db_record['database_name']}")
            logger.info(f"   - is_active: {db_record['is_active']}")
            logger.info(f"   - created_at: {db_record['created_at']}")
            logger.info(f"   ✓ 数据库记录验证成功")
        else:
            logger.error(f"   ✗ 数据库记录未找到")
            return False

        # 4. 验证 Schema 版本
        logger.info(f"\n4. 验证 Schema 版本...")
        with SessionLocal() as db:
            schema_versions = db.query(SchemaVersion).filter(
                SchemaVersion.user_id == test_user_id
            ).all()

            if schema_versions:
                for version in schema_versions:
                    logger.info(f"   版本 {version.version}: {version.description}")
                    logger.info(f"   应用时间: {version.applied_at}")
                logger.info(f"   ✓ Schema 版本记录验证成功")
            else:
                logger.warning(f"   ⚠ Schema 版本记录未找到")

        # 5. 测试连接管理器
        logger.info(f"\n5. 测试连接管理器...")
        from backend.database.user_db_manager import db_manager

        connection_ok = db_manager.test_connection(test_user_id)
        if connection_ok:
            logger.info(f"   ✓ 数据库连接测试成功")
        else:
            logger.error(f"   ✗ 数据库连接测试失败")
            return False

        # 6. 查询连接统计
        logger.info(f"\n6. 查询连接管理器统计...")
        stats = db_manager.get_stats()
        logger.info(f"   活跃用户数: {stats['total_users']}")
        for user_stat in stats['users']:
            logger.info(f"   - {user_stat['user_id']}: 连接池大小={user_stat['pool_size']}, 已签出={user_stat['checked_out']}")

        logger.info("\n" + "=" * 60)
        logger.info("✓ 所有测试通过!")
        logger.info("=" * 60)

        return True

    except Exception as e:
        logger.error(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_create_user_database()
    sys.exit(0 if success else 1)
