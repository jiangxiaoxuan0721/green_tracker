"""
原始数据API路由
提供原始数据的增删改查功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from database.main_db import get_db, get_meta_db
from database.db_services.raw_data_service import (
    create_raw_data,
    get_raw_data_by_id,
    get_raw_data_list_for_frontend,
    update_processing_status,
    update_ai_status,
    get_raw_data_tags,
    add_raw_data_tag,
    delete_raw_data
)
from database.db_services.user_service import get_user_by_id
from api.schemas.raw_data import (
    RawDataRequest,
    RawDataTagRequest,
    ProcessingStatusRequest,
    AIStatusRequest
)

router = APIRouter(prefix="/api/raw-data", tags=["原始数据"])


def get_current_user_id(meta_db, user_id: str) -> str:
    """获取当前用户ID"""
    user = get_user_by_id(meta_db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user.userid


@router.post("/", summary="添加原始数据")
async def create_raw_data(
    request: RawDataRequest,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """
    添加原始数据

    支持多种数据类型：
    - 图像数据：data_type=image，data_value为MinIO存储路径
    - 环境数据：data_type=environmental，data_value为测量值
    - 土壤数据：data_type=soil，data_value为测量值
    - 光谱数据：data_type=multi_spectral，data_value为MinIO存储路径或数值
    """
    current_user_id = get_current_user_id(meta_db, user_id)

    # 添加原始数据
    data_id = create_raw_data(
        db=db,
        user_id=current_user_id,
        session_id=request.session_id,
        data_type=request.data_type,
        data_value=request.data_value,
        capture_time=request.capture_time or datetime.now(),
        device_id=request.device_id,
        device_display_name=request.device_display_name,
        field_id=request.field_id,
        field_display_name=request.field_display_name,
        data_subtype=request.data_subtype,
        data_unit=request.data_unit,
        data_format=request.data_format,
        bucket_name=request.bucket_name,
        object_key=request.object_key,
        location_geom=request.location_geom,
        altitude_m=request.altitude_m,
        heading=request.heading,
        sensor_meta=request.sensor_meta,
        file_meta=request.file_meta,
        acquisition_meta=request.acquisition_meta,
        quality_score=request.quality_score,
        quality_flags=request.quality_flags,
        checksum=request.checksum,
        is_valid=request.is_valid,
        validation_notes=request.validation_notes
    )

    if not data_id:
        raise HTTPException(status_code=500, detail="添加原始数据失败")

    return {"code": 200, "message": "success", "data": {"id": data_id}}


@router.get("/list", summary="获取原始数据列表")
async def get_raw_data_list(
    user_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    device_id: Optional[str] = Query(None, description="设备ID过滤"),
    field_id: Optional[str] = Query(None, description="地块ID过滤"),
    data_type: Optional[str] = Query(None, description="数据类型过滤"),
    data_subtype: Optional[str] = Query(None, description="数据子类型过滤"),
    start_time: Optional[datetime] = Query(None, description="开始时间过滤"),
    end_time: Optional[datetime] = Query(None, description="结束时间过滤"),
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """
    获取原始数据列表

    前端列表显示，返回以下字段：
    - 数据ID
    - 设备名称 (device_display_name)
    - 地块名称 (field_display_name)
    - 数据类型 (data_type)
    - 数据值 (data_value) - 图像显示缩略图，数值显示单位
    - 操作按钮 - 删除和详情
    """
    current_user_id = get_current_user_id(meta_db, user_id)

    result = get_raw_data_list_for_frontend(
        db=db,
        user_id=current_user_id,
        page=page,
        page_size=page_size,
        device_id=device_id,
        field_id=field_id,
        data_type=data_type,
        data_subtype=data_subtype,
        start_time=start_time,
        end_time=end_time
    )

    return {"code": 200, "message": "success", "data": result}


@router.get("/{raw_data_id}", summary="获取原始数据详情")
async def get_raw_data_detail(
    raw_data_id: str,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """
    获取原始数据详情

    返回完整的数据信息，包括：
    - 基本信息：数据ID、采集时间、采集位置
    - 设备信息：设备ID、设备名称、传感器参数
    - 地块信息：地块ID、地块名称、位置信息
    - 数据详情：数据类型、数据值、数据单位、数据格式
    - 元数据：传感器元数据、采集参数、文件元数据
    - 质量信息：质量评分、质量标记、验证备注
    - 处理状态：处理状态、AI分析状态
    """
    current_user_id = get_current_user_id(meta_db, user_id)

    # 获取原始数据详情
    raw_data = get_raw_data_by_id(db, current_user_id, raw_data_id)

    if not raw_data:
        raise HTTPException(status_code=404, detail="原始数据不存在")

    # 获取标签
    tags = get_raw_data_tags(db, current_user_id, raw_data_id)

    return {
        "code": 200,
        "message": "success",
        "data": {
            **raw_data,
            "tags": tags
        }
    }


@router.delete("/{raw_data_id}", summary="删除原始数据")
async def delete_raw_data_by_id(
    raw_data_id: str,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """删除原始数据"""
    current_user_id = get_current_user_id(meta_db, user_id)

    success = delete_raw_data(db, current_user_id, raw_data_id)

    if not success:
        raise HTTPException(status_code=500, detail="删除原始数据失败")

    return {"code": 200, "message": "success", "data": None}


@router.put("/{raw_data_id}/processing-status", summary="更新处理状态")
async def update_processing_status_by_id(
    raw_data_id: str,
    request: ProcessingStatusRequest,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """更新原始数据处理状态"""
    current_user_id = get_current_user_id(meta_db, user_id)

    success = update_processing_status(db, current_user_id, raw_data_id, request.processing_status)

    if not success:
        raise HTTPException(status_code=500, detail="更新处理状态失败")

    return {"code": 200, "message": "success", "data": None}


@router.put("/{raw_data_id}/ai-status", summary="更新AI分析状态")
async def update_ai_status_by_id(
    raw_data_id: str,
    request: AIStatusRequest,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """更新原始数据AI分析状态"""
    current_user_id = get_current_user_id(meta_db, user_id)

    success = update_ai_status(db, current_user_id, raw_data_id, request.ai_status)

    if not success:
        raise HTTPException(status_code=500, detail="更新AI分析状态失败")

    return {"code": 200, "message": "success", "data": None}


@router.post("/{raw_data_id}/tags", summary="添加原始数据标签")
async def add_tag_to_raw_data(
    raw_data_id: str,
    request: RawDataTagRequest,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """为原始数据添加标签"""
    current_user_id = get_current_user_id(meta_db, user_id)

    tag_id = add_raw_data_tag(
        db=db,
        user_id=current_user_id,
        raw_data_id=raw_data_id,
        tag_category=request.tag_category,
        tag_value=request.tag_value,
        confidence=request.confidence,
        source=request.source
    )

    if not tag_id:
        raise HTTPException(status_code=500, detail="添加标签失败")

    return {"code": 200, "message": "success", "data": {"tag_id": tag_id}}


@router.get("/{raw_data_id}/tags", summary="获取原始数据标签")
async def get_tags_for_raw_data(
    raw_data_id: str,
    user_id: str,
    meta_db: Session = Depends(get_meta_db),
    db: Session = Depends(get_db)
):
    """获取原始数据的所有标签"""
    current_user_id = get_current_user_id(meta_db, user_id)

    tags = get_raw_data_tags(db, current_user_id, raw_data_id)

    return {"code": 200, "message": "success", "data": {"tags": tags}}