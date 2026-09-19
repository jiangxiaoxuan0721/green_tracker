"""
采集任务自动完成调度器

周期性扫描所有用户数据库，将已超过结束时间（end_time）但仍处于
planned / running 状态的采集任务自动标记为 completed。

实现为一个守护线程，随 FastAPI 生命周期启动 / 停止，不引入额外依赖。
"""

import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

# backend/scheduler/session_auto_complete.py -> 项目根目录
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

logger = logging.getLogger(__name__)

# 默认扫描间隔（秒）
DEFAULT_INTERVAL_SECONDS = 60
# 最小扫描间隔（秒），避免配置过小打爆数据库
MIN_INTERVAL_SECONDS = 10

_lock = threading.Lock()
_stop_event = threading.Event()
_thread: Optional[threading.Thread] = None


def _get_interval_seconds(override: Optional[int] = None) -> int:
    """读取扫描间隔配置"""
    if override:
        return max(int(override), MIN_INTERVAL_SECONDS)

    raw = os.getenv("SESSION_AUTO_COMPLETE_INTERVAL", str(DEFAULT_INTERVAL_SECONDS))
    try:
        interval = int(raw)
    except ValueError:
        logger.warning(f"SESSION_AUTO_COMPLETE_INTERVAL 配置无效({raw})，回退为 {DEFAULT_INTERVAL_SECONDS}s")
        interval = DEFAULT_INTERVAL_SECONDS

    return max(interval, MIN_INTERVAL_SECONDS)


def _is_enabled() -> bool:
    """是否启用自动完成调度"""
    return os.getenv("SESSION_AUTO_COMPLETE_ENABLED", "true").strip().lower() not in ("false", "0", "no", "off")


def _list_active_user_ids() -> List[str]:
    """从元数据库读取所有活跃用户ID"""
    from database.main_db import SessionLocal
    from database.db_models.meta_model import UserDatabase

    with SessionLocal() as meta_db:
        rows = meta_db.query(UserDatabase.user_id).filter(
            UserDatabase.is_active == True  # noqa: E712
        ).all()

    return [str(row[0]) for row in rows if row[0]]


def run_once(now: Optional[datetime] = None) -> int:
    """
    执行一次全库扫描，自动完成超期任务

    Args:
        now: 参照时间，默认当前 UTC 时间

    Returns:
        int: 本次自动完成的任务总数
    """
    from database.db_services.collection_session_service import auto_complete_expired_sessions
    from database.user_db_manager import get_user_db

    total = 0
    for user_id in _list_active_user_ids():
        db = None
        try:
            db = get_user_db(user_id)
            completed = auto_complete_expired_sessions(db, now=now)
            if completed:
                total += completed
                logger.info(f"[SessionAutoComplete] 用户 {user_id}: 自动完成 {completed} 个超期任务")
        except Exception as e:
            logger.warning(f"[SessionAutoComplete] 用户 {user_id} 扫描失败: {e}")
        finally:
            if db is not None:
                try:
                    db.close()
                except Exception:
                    pass

    return total


def _loop(interval: int) -> None:
    """调度线程主循环"""
    logger.info(f"[SessionAutoComplete] 调度线程已启动，扫描间隔 {interval}s")

    while not _stop_event.is_set():
        try:
            run_once()
        except Exception as e:
            logger.error(f"[SessionAutoComplete] 扫描异常: {e}")

        # 可被 stop() 立即唤醒，避免关停时仍需等待整个间隔
        _stop_event.wait(interval)

    logger.info("[SessionAutoComplete] 调度线程已停止")


def start(interval: Optional[int] = None) -> bool:
    """
    启动自动完成调度线程（幂等）

    Args:
        interval: 扫描间隔（秒），缺省读环境变量 SESSION_AUTO_COMPLETE_INTERVAL

    Returns:
        bool: 是否成功启动
    """
    global _thread

    if not _is_enabled():
        logger.info("[SessionAutoComplete] 已通过配置禁用，跳过启动")
        return False

    with _lock:
        if _thread and _thread.is_alive():
            logger.info("[SessionAutoComplete] 调度线程已在运行，忽略重复启动")
            return True

        _stop_event.clear()
        _thread = threading.Thread(
            target=_loop,
            args=(_get_interval_seconds(interval),),
            name="session-auto-complete",
            daemon=True
        )
        _thread.start()

    return True


def stop(timeout: float = 10.0) -> None:
    """停止自动完成调度线程"""
    global _thread

    with _lock:
        thread = _thread
        _thread = None
        if not thread or not thread.is_alive():
            return
        _stop_event.set()

    thread.join(timeout=timeout)


def is_running() -> bool:
    """调度线程是否在运行"""
    return bool(_thread and _thread.is_alive())


__all__ = ["start", "stop", "run_once", "is_running"]
