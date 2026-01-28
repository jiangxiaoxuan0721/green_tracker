"""
完整注册流程测试
测试从用户注册到数据库创建的完整流程
"""

import sys
import os
from pathlib import Path
import logging
import requests
import time

# 添加 backend 目录到 Python 路径
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RegistrationTest:
    """注册流程测试类"""

    def __init__(self, base_url="http://localhost:6130"):
        self.base_url = base_url
        self.test_user = {
            "username": f"test_user_{int(time.time())}",
            "email": f"test_{int(time.time())}@example.com",
            "password": "Test123456"
        }
        self.user_id = None
        self.token = None

    def test_registration(self):
        """测试用户注册"""
        logger.info("=" * 80)
        logger.info("开始测试用户注册流程")
        logger.info("=" * 80)

        try:
            # 1. 注册用户
            logger.info("\n1. 测试用户注册...")
            self.register_user()

            # 2. 验证数据库是否创建
            logger.info("\n2. 验证用户数据库是否创建...")
            self.verify_database_created()

            # 3. 验证表是否创建
            logger.info("\n3. 验证数据表是否创建...")
            self.verify_tables_created()

            # 4. 验证 PostGIS 扩展是否启用
            logger.info("\n4. 验证 PostGIS 扩展是否启用...")
            self.verify_postgis_extensions()

            # 5. 测试 token 验证
            logger.info("\n5. 测试 token 验证...")
            self.verify_token()

            logger.info("\n" + "=" * 80)
            logger.info("✓ 所有测试通过！")
            logger.info("=" * 80)
            return True

        except Exception as e:
            logger.error(f"\n✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def register_user(self):
        """注册用户"""
        response = requests.post(
            f"{self.base_url}/api/auth/register",
            json={
                "username": self.test_user["username"],
                "email": self.test_user["email"],
                "password": self.test_user["password"]
            },
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            self.user_id = data.get("user_id")
            self.token = data.get("token")
            logger.info(f"✓ 用户注册成功")
            logger.info(f"  用户ID: {self.user_id}")
            logger.info(f"  Token: {self.token[:50]}...")
        else:
            logger.error(f"✗ 注册失败: {response.status_code}")
            logger.error(f"  错误信息: {response.text}")
            raise Exception(f"注册失败: {response.text}")

    def verify_database_created(self):
        """验证数据库是否创建"""
        from database.create_user_database import generate_user_database_name
        from database.main_db import SessionLocal
        from database.db_models.meta_model import UserDatabase

        db_name = generate_user_database_name(self.user_id)

        with SessionLocal() as db:
            user_db = db.query(UserDatabase).filter(
                UserDatabase.user_id == self.user_id,
                UserDatabase.is_active == True
            ).first()

            if user_db:
                logger.info(f"✓ 用户数据库记录存在")
                logger.info(f"  数据库名称: {user_db.database_name}")
                logger.info(f"  主机: {user_db.database_host}")
                logger.info(f"  端口: {user_db.database_port}")
                
                if user_db.database_name == db_name:
                    logger.info(f"✓ 数据库名称匹配")
                else:
                    raise Exception(f"数据库名称不匹配: {user_db.database_name} != {db_name}")
            else:
                raise Exception("用户数据库记录不存在")

    def verify_tables_created(self):
        """验证表是否创建"""
        from sqlalchemy import create_engine, inspect
        from database.create_user_database import generate_user_database_name
        from dotenv import load_dotenv
        import os
        from pathlib import Path

        # 加载环境变量
        project_root = Path(__file__).parent.parent
        load_dotenv(os.path.join(project_root, '.env'))

        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_PORT = os.getenv("DB_PORT", "5433")
        DB_USER = os.getenv("DB_USER", "green_tracker")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "green_tracker")

        db_name = generate_user_database_name(self.user_id)
        engine = create_engine(
            f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}"
        )

        try:
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            
            expected_tables = [
                'fields',
                'devices',
                'collection_sessions',
                'raw_data',
                'raw_data_tags',
                'crop_objects'
            ]

            logger.info(f"  数据库中的表: {existing_tables}")

            missing_tables = []
            for table in expected_tables:
                if table in existing_tables:
                    logger.info(f"  ✓ 表 '{table}' 已创建")
                else:
                    logger.error(f"  ✗ 表 '{table}' 未创建")
                    missing_tables.append(table)

            if missing_tables:
                raise Exception(f"缺少表: {', '.join(missing_tables)}")

            # 检查表的列
            logger.info("\n检查表结构...")
            for table in expected_tables:
                if table in existing_tables:
                    columns = inspector.get_columns(table)
                    logger.info(f"  {table}: {len(columns)} 列")
                    for col in columns[:3]:  # 只显示前3列
                        logger.info(f"    - {col['name']} ({col['type']})")
                    if len(columns) > 3:
                        logger.info(f"    ... 还有 {len(columns) - 3} 列")

        finally:
            engine.dispose()

    def verify_postgis_extensions(self):
        """验证 PostGIS 扩展是否启用"""
        from sqlalchemy import create_engine, text
        from database.create_user_database import generate_user_database_name
        from dotenv import load_dotenv
        import os
        from pathlib import Path

        # 加载环境变量
        project_root = Path(__file__).parent.parent
        load_dotenv(os.path.join(project_root, '.env'))

        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_PORT = os.getenv("DB_PORT", "5433")
        DB_USER = os.getenv("DB_USER", "green_tracker")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "green_tracker")

        db_name = generate_user_database_name(self.user_id)
        engine = create_engine(
            f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}"
        )

        try:
            with engine.connect() as conn:
                # 检查 PostGIS 扩展
                result = conn.execute(text(
                    "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'uuid-ossp', 'pg_trgm')"
                ))
                extensions = [row[0] for row in result.fetchall()]
                
                logger.info(f"  已安装的扩展: {extensions}")
                
                expected_extensions = ['postgis', 'uuid-ossp', 'pg_trgm']
                for ext in expected_extensions:
                    if ext in extensions:
                        logger.info(f"  ✓ 扩展 '{ext}' 已安装")
                    else:
                        raise Exception(f"扩展 '{ext}' 未安装")

        finally:
            engine.dispose()

    def verify_token(self):
        """验证 token 是否有效"""
        if not self.token:
            raise Exception("Token 未设置")

        headers = {
            "Authorization": f"Bearer {self.token}"
        }

        response = requests.get(
            f"{self.base_url}/api/auth/verify",
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            logger.info(f"✓ Token 验证成功")
            logger.info(f"  有效: {data.get('valid')}")
            logger.info(f"  用户ID: {data.get('user_id')}")
        else:
            logger.error(f"✗ Token 验证失败: {response.status_code}")
            raise Exception(f"Token 验证失败: {response.text}")


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description="测试用户注册流程")
    parser.add_argument(
        "--url",
        default="http://localhost:6130",
        help="API 基础 URL"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="测试完成后清理测试数据"
    )

    args = parser.parse_args()

    # 创建测试实例
    test = RegistrationTest(base_url=args.url)

    # 运行测试
    success = test.test_registration()

    # 清理测试数据（可选）
    if success and args.cleanup:
        logger.info("\n清理测试数据...")
        try:
            from database.create_user_database import drop_user_database
            from database.main_db import SessionLocal
            from database.db_models.user_model import User

            # 删除用户数据库
            drop_user_database(test.user_id)
            logger.info(f"✓ 用户数据库已删除")

            # 删除用户记录
            with SessionLocal() as db:
                user = db.query(User).filter(User.userid == test.user_id).first()
                if user:
                    db.delete(user)
                    db.commit()
                    logger.info(f"✓ 用户记录已删除")

        except Exception as e:
            logger.error(f"✗ 清理失败: {e}")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
