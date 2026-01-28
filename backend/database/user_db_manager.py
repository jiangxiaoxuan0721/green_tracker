"""
用户数据库连接管理器
管理每个用户的独立数据库连接
"""

import threading
import logging
from typing import Dict, Optional, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session, Session
from sqlalchemy.pool import QueuePool

import os
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

logger = logging.getLogger(__name__)


class UserDatabaseManager:
    """
    用户数据库连接管理器
    为每个用户维护独立的数据库连接池
    """

    def __init__(self):
        # 存储 user_id -> engine 的映射
        self._engines: Dict[str, Any] = {}
        # 存储 user_id -> session_factory 的映射
        self._session_factories: Dict[str, Any] = {}
        # 线程锁，保证线程安全
        self._lock = threading.Lock()

        # 数据库连接配置
        self._base_config = {
            'poolclass': QueuePool,
            'pool_size': int(os.getenv("DB_POOL_SIZE", "5")),  # 每个用户5个连接
            'max_overflow': int(os.getenv("DB_MAX_OVERFLOW", "10")),  # 最大额外10个连接
            'pool_pre_ping': True,  # 连接前检查有效性
            'pool_recycle': 3600,  # 1小时回收连接
            'echo': False,  # 不输出SQL日志
        }

        # 数据库基础配置
        self._db_user = os.getenv("DB_USER", "postgres")
        self._db_password = os.getenv("DB_PASSWORD", "")
        self._db_host = os.getenv("DB_HOST", "localhost")
        self._db_port = os.getenv("DB_PORT", "5432")
        self._use_unix_socket = os.getenv("USE_UNIX_SOCKET", "false").lower() == "true"

        logger.info("UserDatabaseManager initialized")

    def _get_user_database_info(self, user_id: str) -> Dict[str, Any]:
        """
        从元数据库获取用户数据库信息

        Args:
            user_id: 用户ID

        Returns:
            数据库信息字典，包含 database_name, database_host, database_port

        Raises:
            ValueError: 用户数据库不存在
        """
        from database.main_db import SessionLocal
        from database.db_models.meta_model import UserDatabase

        # 使用元数据库的连接
        with SessionLocal() as meta_db:
            user_db = meta_db.query(UserDatabase).filter(
                UserDatabase.user_id == user_id,
                UserDatabase.is_active == True
            ).first()

            if not user_db:
                raise ValueError(f"用户 {user_id} 未找到活跃的数据库配置")

            return {
                "database_name": user_db.database_name,
                "database_host": user_db.database_host,
                "database_port": user_db.database_port
            }

    def get_engine(self, user_id: str) -> Any:
        """
        获取用户的数据库引擎（懒加载）

        Args:
            user_id: 用户ID

        Returns:
            SQLAlchemy Engine 对象
        """
        # 双重检查锁定模式
        if user_id not in self._engines:
            with self._lock:
                if user_id not in self._engines:
                    # 获取用户数据库信息
                    db_info = self._get_user_database_info(user_id)

                    # 构建连接URL
                    if self._use_unix_socket:
                        # 使用 Unix Socket 连接（Peer认证，不需要密码）
                        db_url = f"postgresql://{self._db_user}@/{db_info['database_name']}"
                    else:
                        # 使用 TCP 连接
                        db_url = (
                            f"postgresql://{self._db_user}:{self._db_password}@"
                            f"{db_info['database_host']}:{db_info['database_port']}/"
                            f"{db_info['database_name']}"
                        )

                    # 创建引擎
                    engine = create_engine(db_url, **self._base_config)
                    self._engines[user_id] = engine

                    logger.info(f"Created database engine for user {user_id}: {db_info['database_name']}")

        return self._engines[user_id]

    def get_db(self, user_id: str) -> Session:
        """
        获取用户的数据库会话（用于依赖注入）

        Args:
            user_id: 用户ID

        Returns:
            SQLAlchemy Session 对象
        """
        engine = self.get_engine(user_id)

        if user_id not in self._session_factories:
            with self._lock:
                if user_id not in self._session_factories:
                    SessionLocal = sessionmaker(
                        autocommit=False,
                        autoflush=False,
                        bind=engine
                    )
                    self._session_factories[user_id] = SessionLocal

        return self._session_factories[user_id]()

    def test_connection(self, user_id: str) -> bool:
        """
        测试用户数据库连接

        Args:
            user_id: 用户ID

        Returns:
            连接是否成功
        """
        try:
            engine = self.get_engine(user_id)
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1")).fetchone()
                return result[0] == 1
        except Exception as e:
            logger.error(f"User {user_id} database connection test failed: {e}")
            return False

    def remove_user_db(self, user_id: str) -> bool:
        """
        移除用户数据库连接（用户删除时调用）

        Args:
            user_id: 用户ID

        Returns:
            是否成功
        """
        try:
            with self._lock:
                # 关闭并删除引擎
                if user_id in self._engines:
                    self._engines[user_id].dispose()
                    del self._engines[user_id]
                    logger.info(f"Disposed database engine for user {user_id}")

                # 删除会话工厂
                if user_id in self._session_factories:
                    del self._session_factories[user_id]
                    logger.info(f"Removed session factory for user {user_id}")

                return True
        except Exception as e:
            logger.error(f"Failed to remove user {user_id} database: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """
        获取连接管理器的统计信息

        Returns:
            统计信息字典
        """
        stats = {
            "total_users": len(self._engines),
            "users": []
        }

        for user_id, engine in self._engines.items():
            pool = engine.pool
            stats["users"].append({
                "user_id": user_id,
                "pool_size": pool.size(),
                "checked_out": pool.checkedout(),
                "checked_in": pool.checkedin(),
                "overflow": pool.overflow()
            })

        return stats

    def get_active_users(self) -> list:
        """
        获取所有活跃用户ID列表

        Returns:
            用户ID列表
        """
        return list(self._engines.keys())


# 全局单例
db_manager = UserDatabaseManager()


def get_user_db(user_id: str) -> Session:
    """
    便捷函数：获取用户数据库会话
    用于 FastAPI 依赖注入

    Args:
        user_id: 用户ID

    Returns:
        SQLAlchemy Session 对象
    """
    return db_manager.get_db(user_id)


def get_current_user_db(current_user):
    """
    获取当前用户的数据库会话（用于 FastAPI 依赖注入）

    Args:
        current_user: 当前用户对象

    Returns:
        Session: SQLAlchemy Session 对象
    """
    return get_user_db(str(current_user.userid))
