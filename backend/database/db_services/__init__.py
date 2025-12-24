"""
数据库服务模块
提供对数据库模型的业务操作封装
"""

from .user_service import (
    create_user,
    verify_user,
    get_user_by_id,
    get_user_by_username,
    update_user_email
)

from .feedback_service import (
    create_feedback,
    get_feedback_by_id,
    get_all_feedback
)

from .field_service import (
    create_field,
    get_field_by_id,
    update_field,
    delete_field,
    restore_field,
)

from .device_service import (
    create_device,
    get_device_by_id,
    update_device,
    delete_device,
    restore_device,
    get_devices_by_type,
    get_devices_by_platform
)

from .collection_session_service import (
    create_collection_session,
    get_collection_session_by_id,
    get_collection_sessions_by_field,
    update_collection_session,
    delete_collection_session,
    get_latest_collection_session_by_field,
    get_collection_sessions_by_status,
    get_collection_sessions_with_field_info
)

from .raw_data_service import (
    create_raw_data,
    get_raw_data_by_id,
    get_raw_data_list_for_frontend,
    update_processing_status,
    update_ai_status,
    delete_raw_data,
    add_raw_data_tag,
    get_raw_data_tags
)

__all__ = [
    "create_user",
    "verify_user",
    "get_user_by_id",
    "get_user_by_username",
    "update_user_email",
    "create_feedback",
    "get_feedback_by_id",
    "get_all_feedback",
    "create_field",
    "get_field_by_id",
    "update_field",
    "delete_field",
    "restore_field",
    "create_device",
    "get_device_by_id",
    "update_device",
    "delete_device",
    "restore_device",
    "get_devices_by_type",
    "get_devices_by_platform",
    "create_collection_session",
    "get_collection_session_by_id",
    "get_collection_sessions_by_field",
    "update_collection_session",
    "delete_collection_session",
    "get_latest_collection_session_by_field",
    "get_collection_sessions_by_status",
    "get_collection_sessions_with_field_info",
    "create_raw_data",
    "get_raw_data_by_id",
    "get_raw_data_list_for_frontend",
    "update_processing_status",
    "update_ai_status",
    "delete_raw_data",
    "add_raw_data_tag",
    "get_raw_data_tags"
]