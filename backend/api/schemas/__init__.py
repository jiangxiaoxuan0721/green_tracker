"""
Pydantic schemas for data validation and serialization
"""

from .auth import UserRegister, UserLogin, UserResponse, TokenData
from .collection_session import (
    CollectionSessionBase,
    CollectionSessionCreate,
    CollectionSessionUpdate,
    CollectionSessionResponse,
    CollectionSessionWithFieldResponse
)
from .device import DeviceCreate, DeviceResponse, DeviceUpdate, DeviceListParams
from .feedback import FeedbackCreate, FeedbackResponse
from .field import FieldCreate, FieldResponse, FieldUpdate, FieldListParams
from .raw_data import (
    RawDataRequest,
    RawDataTagRequest,
    ProcessingStatusRequest,
    AIStatusRequest,
    RawDataResponse,
    RawDataListResponse
)
from .raw_data_upload import (
    DataType,
    DataSubType,
    DataUnit,
    UploadDataRequest,
    UploadFileResponse,
    UploadDataResponse
)
from .api_key import (
    ApiKeyCreateRequest,
    ApiKeyUpdateRequest,
    ApiKeyResponse,
    ApiKeyListResponse,
    ApiKeyCreateResponse
)

__all__ = [
    # Auth
    "UserRegister",
    "UserLogin",
    "UserResponse",
    "TokenData",
    # Collection Session
    "CollectionSessionBase",
    "CollectionSessionCreate",
    "CollectionSessionUpdate",
    "CollectionSessionResponse",
    "CollectionSessionWithFieldResponse",
    # Device
    "DeviceCreate",
    "DeviceResponse",
    "DeviceUpdate",
    "DeviceListParams",
    # Feedback
    "FeedbackCreate",
    "FeedbackResponse",
    # Field
    "FieldCreate",
    "FieldResponse",
    "FieldUpdate",
    "FieldListParams",
    # Raw Data
    "RawDataRequest",
    "RawDataTagRequest",
    "ProcessingStatusRequest",
    "AIStatusRequest",
    "RawDataResponse",
    "RawDataListResponse",
    # Raw Data Upload
    "DataType",
    "DataSubType",
    "DataUnit",
    "UploadDataRequest",
    "UploadFileResponse",
    "UploadDataResponse",
    # API Key
    "ApiKeyCreateRequest",
    "ApiKeyUpdateRequest",
    "ApiKeyResponse",
    "ApiKeyListResponse",
    "ApiKeyCreateResponse"
]