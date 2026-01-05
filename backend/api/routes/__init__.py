"""
FastAPI route modules
"""

from .auth import router as auth_router
from .collection_session import router as collection_session_router
from .device import router as device_router
from .feedback import router as feedback_router
from .field import router as field_router
from .raw_data import router as raw_data_router

__all__ = [
    "auth_router",
    "collection_session_router",
    "device_router",
    "feedback_router",
    "field_router",
    "raw_data_router"
]