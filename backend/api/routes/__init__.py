"""
FastAPI route modules
"""

from .auth import router as auth_router
from .feedback import router as feedback_router

__all__ = ["auth_router", "feedback_router"]