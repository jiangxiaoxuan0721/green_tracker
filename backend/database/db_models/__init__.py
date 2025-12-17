# 导入所有数据库模型，确保在初始化时能够被识别
from .field_model import Field
from .device_model import Device
from .user_model import User
from .feedback_model import Feedback
from .collection_session_model import CollectionSession

__all__ = [
    "Field",
    "Device", 
    "User",
    "Feedback",
    "CollectionSession"
]