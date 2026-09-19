"""
后台调度任务
周期性的数据维护任务，随 FastAPI 应用生命周期启动 / 停止
"""

from .session_auto_complete import (
    start as start_session_auto_complete,
    stop as stop_session_auto_complete,
    run_once as run_session_auto_complete_once,
    is_running as is_session_auto_complete_running,
)

__all__ = [
    "start_session_auto_complete",
    "stop_session_auto_complete",
    "run_session_auto_complete_once",
    "is_session_auto_complete_running",
]
