"""
Green Tracker API 模块
提供统一的 API 路由和 Schema 导入接口
"""

# 导出所有路由
from api.routes import (
    auth_router,
    collection_session_router,
    device_router,
    feedback_router,
    field_router,
    raw_data_router,
    admin_database_router
)

# 导出所有 Schemas
from api.schemas import (
    # Auth
    UserRegister,
    UserLogin,
    UserResponse,
    TokenData,
    # Collection Session
    CollectionSessionBase,
    CollectionSessionCreate,
    CollectionSessionUpdate,
    CollectionSessionResponse,
    CollectionSessionWithFieldResponse,
    # Device
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    DeviceListParams,
    # Feedback
    FeedbackCreate,
    FeedbackResponse,
    # Field
    FieldCreate,
    FieldResponse,
    FieldUpdate,
    FieldListParams,
    PointQuery,
    # Raw Data
    RawDataRequest,
    RawDataTagRequest,
    ProcessingStatusRequest,
    AIStatusRequest,
    RawDataResponse,
    RawDataListResponse
)

__all__ = [
    # Routes
    "auth_router",
    "collection_session_router",
    "device_router",
    "feedback_router",
    "field_router",
    "raw_data_router",
    "admin_database_router",
    # Schemas - Auth
    "UserRegister",
    "UserLogin",
    "UserResponse",
    "TokenData",
    # Schemas - Collection Session
    "CollectionSessionBase",
    "CollectionSessionCreate",
    "CollectionSessionUpdate",
    "CollectionSessionResponse",
    "CollectionSessionWithFieldResponse",
    # Schemas - Device
    "DeviceCreate",
    "DeviceResponse",
    "DeviceUpdate",
    "DeviceListParams",
    # Schemas - Feedback
    "FeedbackCreate",
    "FeedbackResponse",
    # Schemas - Field
    "FieldCreate",
    "FieldResponse",
    "FieldUpdate",
    "FieldListParams",
    "PointQuery",
    # Schemas - Raw Data
    "RawDataRequest",
    "RawDataTagRequest",
    "ProcessingStatusRequest",
    "AIStatusRequest",
    "RawDataResponse",
    "RawDataListResponse"
]
