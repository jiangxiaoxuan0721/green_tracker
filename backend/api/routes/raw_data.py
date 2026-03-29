"""
原始数据API路由
提供原始数据的增删改查功能

注意：每个用户有独立的数据库，不需要 user_id 验证
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, Form, Header
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
import logging
import uuid
import io
logger = logging.getLogger(__name__)
from PIL import Image

from ..routes.auth import get_current_user, get_current_user_from_api_key

from database.db_models.meta_model import User
from database.user_db_manager import get_user_db, get_current_user_db
from database.main_db import get_meta_db
from database.db_services.raw_data_service import (
    create_raw_data,
    get_raw_data_by_id,
    get_raw_data_list_for_frontend,
    update_processing_status,
    update_ai_status,
    get_raw_data_tags,
    add_raw_data_tag,
    get_session_data_types,
    get_raw_data_statistics,
    get_overview_statistics
)
from ..schemas.raw_data import (
    RawDataRequest,
    RawDataTagRequest,
    ProcessingStatusRequest,
    AIStatusRequest
)
from ..schemas.raw_data_upload import (
    DataType,
    DataSubType,
    UploadDataRequest,
    UploadFileResponse,
    UploadDataResponse,
    SUBTYPE_UNIT_MAP
)
from storage.storage_manager import get_storage_manager
from utils.image_processor import get_image_processor

router = APIRouter(prefix="/raw-data", tags=["原始数据"])


@router.post("/", summary="添加原始数据")
async def create_new_raw_data(
    request: RawDataRequest,
    current_user: User = Depends(get_current_user)
):
    """
    添加原始数据

    支持多种数据类型：
    - 图像数据：data_type=image，data_value为MinIO存储路径
    - 环境数据：data_type=environmental，data_value为测量值
    - 土壤数据：data_type=soil，data_value为测量值
    - 光谱数据：data_type=multi_spectral，data_value为MinIO存储路径或数值
    """
    db = None
    try:
        # 获取用户的数据库会话
        db = get_user_db(str(current_user.userid))
        
        # 添加原始数据
        data_id = create_raw_data(
            db=db,
            session_id=request.session_id,
            data_type=request.data_type,
            data_value=request.data_value,
            capture_time=request.capture_time or datetime.now(),
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
        
    except Exception as e:
        print(f"[API] 原始数据创建失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建原始数据失败: {str(e)}")
    finally:
        if db:
            db.close()

@router.get("/session/{session_id}/data-types", summary="获取会话的数据类型")
async def get_session_data_types_endpoint(
    session_id: str,
    data_type: Optional[str] = Query(None, description="数据类型过滤，用于过滤子类型"),
    user_id: str = Query("3d5e8a9f-1fc1-4374-8afe-1277b4e0b175", description="用户ID")
):
    """
    获取指定会话中可用的数据类型和子类型
    用于前端动态生成筛选选项
    """
    # 连接到用户数据库
    db = get_user_db(user_id)
    try:
        result = get_session_data_types(db, session_id, data_type)
        return {"code": 200, "message": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取会话数据类型失败: {str(e)}")
    finally:
        db.close()


@router.get("/statistics", summary="获取数据统计信息")
async def get_raw_data_statistics_endpoint(
    session_ids: Optional[str] = Query(None, description="会话ID列表，用逗号分隔"),
    data_type: Optional[str] = Query(None, description="数据类型过滤"),
    data_subtype: Optional[str] = Query(None, description="数据子类型过滤"),
    start_time: Optional[str] = Query(None, description="开始时间（ISO格式）"),
    end_time: Optional[str] = Query(None, description="结束时间（ISO格式）"),
    user_id: str = Query("3d5e8a9f-1fc1-4374-8afe-1277b4e0b175", description="用户ID")
):
    """
    获取原始数据的统计信息，用于数据分析页面

    该接口直接在数据库层面进行聚合统计，不需要分页限制，
    返回统计数据而非数据列表，性能更好。

    返回数据包括：
    - total_records: 总记录数
    - data_types: 各数据类型的数量统计
    - average_values: 各数据类型的平均值
    - min_values: 各数据类型的最小值
    - max_values: 各数据类型的最大值
    - session_count: 涉及的会话数量
    """
    # 连接到用户数据库
    db = get_user_db(user_id)
    try:
        # 处理会话ID列表
        session_id_list = None
        if session_ids:
            session_id_list = [s.strip() for s in session_ids.split(',') if s.strip()]

        # 处理时间参数
        from datetime import datetime
        parsed_start_time = None
        parsed_end_time = None
        if start_time:
            try:
                parsed_start_time = datetime.fromisoformat(start_time)
            except ValueError:
                pass
        if end_time:
            try:
                parsed_end_time = datetime.fromisoformat(end_time)
            except ValueError:
                pass

        # 获取统计信息
        result = get_raw_data_statistics(
            db=db,
            session_ids=session_id_list,
            data_type=data_type,
            data_subtype=data_subtype,
            start_time=parsed_start_time,
            end_time=parsed_end_time
        )

        return {"code": 200, "message": "success", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取数据统计失败: {str(e)}")
    finally:
        db.close()


@router.get("/list", summary="获取原始数据列表")
async def get_raw_data_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    session_id: Optional[str] = Query(None, description="会话ID过滤"),
    data_type: Optional[str] = Query(None, description="数据类型过滤"),
    data_subtype: Optional[str] = Query(None, description="数据子类型过滤"),
    user_id: str = Query("3d5e8a9f-1fc1-4374-8afe-1277b4e0b175", description="用户ID")
):
    """
    获取原始数据列表

    前端列表显示，返回以下字段：
    - 数据ID
    - 任务名称
    - 数据类型 (data_type)
    - 数据值 (data_value) - 图像显示缩略图，数值显示单位
    - 操作按钮 - 删除和详情
    """
    # 连接到用户数据库
    db = get_user_db(user_id)
    try:
        result = get_raw_data_list_for_frontend(
            db=db,
            page=page,
            page_size=page_size,
            session_id=session_id,
            data_type=data_type,
            data_subtype=data_subtype
        )
    finally:
        db.close()

    return {"code": 200, "message": "success", "data": result}


@router.get("/overview", summary="获取概览统计数据")
async def get_overview_statistics_endpoint(
    user_id: str = Query(..., description="用户ID")
):
    """
    获取概览页面的统计数据

    返回数据包括：
    - total_devices: 设备总数
    - active_devices: 在线设备数
    - today_sessions: 今日任务数
    - total_data_records: 总数据记录数
    - recent_activities: 最近活动记录
    - system_status: 系统状态
    """
    db = None
    try:
        print(f"[概览API] 收到请求, user_id={user_id}")
        
        if not user_id:
            print(f"[概览API] user_id为空")
            raise HTTPException(status_code=400, detail="缺少用户ID参数")
        
        # 连接到用户数据库
        db = get_user_db(user_id)
        print(f"[概览API] 数据库连接成功")

        # 获取概览统计信息
        result = get_overview_statistics(db)
        print(f"[概览API] 统计结果: total_devices={result.get('total_devices')}, total_data_records={result.get('total_data_records')}")

        return {
            "code": 200,
            "message": "success",
            "data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[获取概览统计] 失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取概览统计失败: {str(e)}")
    finally:
        if db:
            try:
                db.close()
            except:
                pass


@router.get("/{raw_data_id}", summary="获取原始数据详情")
async def get_raw_data_detail(
    raw_data_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
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
    # 获取原始数据详情
    raw_data = get_raw_data_by_id(db, raw_data_id)

    if not raw_data:
        raise HTTPException(status_code=404, detail="原始数据不存在")

    # 获取标签
    tags = get_raw_data_tags(db, raw_data_id)

    return {
        "code": 200,
        "message": "success",
        "data": {
            **raw_data,
            "tags": tags
        }
    }


@router.put("/{raw_data_id}/processing-status", summary="更新处理状态")
async def update_processing_status_by_id(
    raw_data_id: str,
    request: ProcessingStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """更新原始数据处理状态"""
    success = update_processing_status(db, raw_data_id, request.processing_status)

    if not success:
        raise HTTPException(status_code=500, detail="更新处理状态失败")

    return {"code": 200, "message": "success", "data": None}


@router.put("/{raw_data_id}/ai-status", summary="更新AI分析状态")
async def update_ai_status_by_id(
    raw_data_id: str,
    request: AIStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """更新原始数据AI分析状态"""
    success = update_ai_status(db, raw_data_id, request.ai_status)

    if not success:
        raise HTTPException(status_code=500, detail="更新AI分析状态失败")

    return {"code": 200, "message": "success", "data": None}


@router.post("/{raw_data_id}/tags", summary="添加原始数据标签")
async def add_tag_to_raw_data(
    raw_data_id: str,
    request: RawDataTagRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """为原始数据添加标签"""
    tag_id = add_raw_data_tag(
        db=db,
        raw_data_id=raw_data_id,
        tag_category=request.tag_category,
        tag_value=request.tag_value,
        confidence=request.confidence,
        source=request.source if request.source else "manual"
    )

    if not tag_id:
        raise HTTPException(status_code=500, detail="添加标签失败")

    return {"code": 200, "message": "success", "data": {"tag_id": tag_id}}


@router.get("/{raw_data_id}/tags", summary="获取原始数据标签")
async def get_tags_for_raw_data(
    raw_data_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """获取原始数据的所有标签"""
    tags = get_raw_data_tags(db, raw_data_id)

    return {"code": 200, "message": "success", "data": {"tags": tags}}


@router.get("/{raw_data_id}/thumbnail", summary="获取图像缩略图")
async def get_raw_data_thumbnail(
    raw_data_id: str,
    user_id: str = Query(..., description="用户ID"),
    size: int = Query(150, description="缩略图尺寸", ge=50, le=500)
):
    """
    获取原始数据的缩略图
    
    特性：
    - 真正的缩略图处理（不是原图压缩）
    - 多级缓存策略
    - 性能优化
    - 错误处理
    
    Args:
        raw_data_id: 原始数据ID
        user_id: 用户ID
        size: 缩略图尺寸（正方形，默认150px）
    """
    logger.info(f"[缩略图接口] 请求: data_id={raw_data_id}, user_id={user_id}, size={size}")
    
    # 连接到用户数据库
    db = get_user_db(user_id)
    
    try:
        # 获取原始数据
        raw_data = get_raw_data_by_id(db, raw_data_id)
        
        if not raw_data:
            logger.warning(f"[缩略图接口] 数据不存在: {raw_data_id}")
            raise HTTPException(status_code=404, detail="数据不存在")
        
        # 检查是否为图像类型
        if raw_data.get("data_type") != "image":
            raise HTTPException(status_code=400, detail="该数据不是图像类型")
        
        # 权限检查：验证用户是否有权限访问该数据
        session_id = raw_data.get("session_id")
        if session_id:
            # 这里可以添加更严格的权限检查逻辑
            pass
        
        # 生成缩略图缓存键
        cache_key = f"thumb:{raw_data_id}:{size}:v1"
        
        # 尝试从缓存获取缩略图
        cache_manager = None
        try:
            from utils.cache_manager import get_cache_manager
            cache_manager = get_cache_manager()
            cached_thumb = cache_manager.get(cache_key)
            if cached_thumb:
                logger.info(f"[缩略图接口] 缓存命中: {cache_key}")
                content_type = cached_thumb.get('content_type', 'image/jpeg')
                return Response(
                    content=cached_thumb['data'],
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=86400",  # 24小时缓存
                        "Access-Control-Allow-Origin": "*",
                        "X-Cache": "HIT"
                    }
                )
        except ImportError:
            logger.debug("[缩略图接口] 缓存模块不可用，跳过缓存")
        
        # 获取原始图像数据
        image_data = None
        original_format = None
        
        if raw_data.get("object_key"):
            logger.info(f"[缩略图接口] 从MinIO获取原图: {raw_data.get('object_key')}")
            try:
                from storage.storage_manager import get_storage_manager
                storage_manager = get_storage_manager()
                object_path = raw_data["object_key"]
                
                result = storage_manager._get_file_bytes_direct(object_path)
                
                if result and result.get('success') and result.get('data'):
                    image_data = result['data']
                    # 从文件扩展名推断格式
                    if raw_data.get("data_format"):
                        original_format = raw_data["data_format"].lower()
                    else:
                        # 从object_key推断
                        ext = object_path.split('.')[-1].lower() if '.' in object_path else 'jpg'
                        original_format = ext
                else:
                    logger.error(f"[缩略图接口] MinIO返回无效数据: {result}")
                    
            except Exception as e:
                logger.error(f"[缩略图接口] 从MinIO获取图像失败: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # 如果MinIO失败，尝试data_value中的URL
        elif raw_data.get("data_value") and raw_data["data_value"].startswith("http"):
            logger.info(f"[缩略图接口] 从外部URL获取图像: {raw_data['data_value']}")
            try:
                import requests
                response = requests.get(raw_data["data_value"], timeout=10)
                if response.status_code == 200:
                    image_data = response.content
                    original_format = 'jpeg'  # 默认格式
                else:
                    logger.error(f"[缩略图接口] 外部URL请求失败: {response.status_code}")
            except Exception as e:
                logger.error(f"[缩略图接口] 获取外部URL图像失败: {str(e)}")
        
        if not image_data:
            logger.warning(f"[缩略图接口] 无法获取图像数据: {raw_data_id}")
            raise HTTPException(status_code=404, detail="图像数据不可用")
        
        # 生成缩略图
        try:
            # 确保original_format是字符串
            original_format_str = original_format if original_format else 'jpeg'
            thumbnail_data, thumbnail_format = generate_thumbnail(
                image_data, 
                size, 
                original_format_str
            )
            
            # 缓存缩略图
            try:
                if cache_manager:
                    cache_data = {
                        'data': thumbnail_data,
                        'content_type': f'image/{thumbnail_format}',
                        'size': size,
                        'original_format': original_format_str
                    }
                    cache_manager.set(cache_key, cache_data, ttl=3600)  # 1小时缓存
                logger.info(f"[缩略图接口] 缩略图已缓存: {cache_key}")
            except:
                logger.debug("[缩略图接口] 缓存保存失败，继续返回")
            
            content_type = f'image/{thumbnail_format}'
            return Response(
                content=thumbnail_data,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*",
                    "X-Cache": "MISS"
                }
            )
            
        except Exception as e:
            logger.error(f"[缩略图接口] 生成缩略图失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 缩略图生成失败，返回原图（如果不太大）
            if len(image_data) < 5 * 1024 * 1024:  # 5MB以下
                logger.info(f"[缩略图接口] 返回原图作为fallback")
                content_type = 'image/jpeg'  # 默认
                if original_format:
                    if original_format == 'png':
                        content_type = 'image/png'
                    elif original_format == 'gif':
                        content_type = 'image/gif'
                    elif original_format == 'webp':
                        content_type = 'image/webp'
                    elif original_format == 'bmp':
                        content_type = 'image/bmp'
                
                return Response(
                    content=image_data,
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=1800",
                        "Access-Control-Allow-Origin": "*",
                        "X-Fallback": "original-image"
                    }
                )
            
            raise HTTPException(status_code=500, detail="无法生成缩略图")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[缩略图接口] 处理请求失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="内部服务器错误")
    finally:
        db.close()


def generate_thumbnail(image_data: bytes, size: int, original_format: str = 'jpeg') -> tuple[bytes, str]:
    """
    生成图像缩略图
    
    Args:
        image_data: 原始图像数据
        size: 缩略图尺寸（正方形）
        original_format: 原始图像格式
    
    Returns:
        (缩略图数据, 输出格式)
    """
    try:
        # 创建图像对象
        image = Image.open(io.BytesIO(image_data))
        
        # 转换为RGB（处理RGBA等格式）
        if image.mode in ('RGBA', 'LA', 'P'):
            # 对于PNG等有透明度的图像，创建白色背景
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            if image.mode == 'RGBA':
                background.paste(image, mask=image.split()[-1])  # 使用alpha通道作为mask
                image = background
            else:
                image = image.convert('RGB')
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 计算缩略图尺寸（保持宽高比）
        original_width, original_height = image.size
        aspect_ratio = original_width / original_height
        
        if aspect_ratio > 1:
            # 宽图
            new_width = size
            new_height = int(size / aspect_ratio)
        else:
            # 高图或正方形
            new_height = size
            new_width = int(size * aspect_ratio)
        
        # 生成缩略图（高质量）
        image.thumbnail((new_width, new_height), Image.Resampling.LANCZOS)
        
        # 创建正方形画布，居中放置缩略图
        thumbnail = Image.new('RGB', (size, size), (240, 240, 240))  # 浅灰色背景
        
        # 计算居中位置
        x_offset = (size - image.size[0]) // 2
        y_offset = (size - image.size[1]) // 2
        
        # 粘贴缩略图
        thumbnail.paste(image, (x_offset, y_offset))
        
        # 保存为JPEG格式以获得更好的压缩
        output = io.BytesIO()
        thumbnail.save(output, format='JPEG', quality=85, optimize=True)
        thumbnail_data = output.getvalue()
        output.close()
        
        logger.info(f"[缩略图] 生成成功: {original_width}x{original_height} -> {size}x{size}, {len(thumbnail_data)} bytes")
        
        return thumbnail_data, 'jpeg'

    except ImportError:
        # PIL不可用，尝试其他方案
        logger.warning("PIL不可用，尝试其他缩略图方案")
        # 这里可以添加其他图像处理库的fallback
        # 暂时返回原图
        return image_data, original_format or 'jpeg'
    except Exception as e:
        logger.error(f"生成缩略图失败: {str(e)}")
        raise


# ============ 新的数据上传接口 ============

@router.post("/upload-data", summary="上传数字数据")
async def upload_numeric_data(
    request: UploadDataRequest,
    x_api_key: Optional[str] = Header(None, description="API密钥（可选）"),
    authorization: Optional[str] = Header(None, description="JWT令牌（可选）"),
    meta_db: Session = Depends(get_meta_db)
):
    """
    上传数字类型数据（环境数据、土壤数据等）

    认证方式（按优先级排序）：
    1. JWT令牌认证（推荐，主要用于Web应用）
       - Header: Authorization: Bearer <jwt_token>
    2. API密钥认证（备用，用于设备和第三方集成）
       - Header: X-API-Key: <api_key>

    数据值说明：
    - environmental/soil 类型：data_value 为数值字符串
    - 单位通过 data_subtype 推断，不需要单独上传单位字段
    """
    try:
        # 认证用户：优先使用JWT令牌，备用API密钥认证
        current_user = None
        db: Session | None = None

        # 优先尝试JWT认证
        if authorization:
            try:
                from fastapi.security import HTTPAuthorizationCredentials
                if authorization.startswith('Bearer '):
                    token = authorization[7:]
                    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
                    current_user = await get_current_user(credentials, meta_db)
                    db = get_current_user_db(current_user)
                    logger.info(f"[上传数据] JWT认证成功: {current_user.username}")
                else:
                    raise HTTPException(status_code=401, detail="无效的Authorization格式")
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"JWT认证失败: {str(e)}")

        # 如果没有JWT，尝试API密钥认证
        elif x_api_key:
            try:
                current_user = await get_current_user_from_api_key(x_api_key, meta_db)
                db = get_current_user_db(current_user)
                logger.info(f"[上传数据] API密钥认证成功: {current_user.username}")
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"API密钥认证失败: {str(e)}")

        else:
            raise HTTPException(
                status_code=401,
                detail="需要认证：请提供JWT令牌（推荐）或API密钥"
            )

        # 验证数据类型和子类型的匹配
        if request.data_type == DataType.ENVIRONMENTAL:
            valid_subtypes = [DataSubType.TEMPERATURE, DataSubType.HUMIDITY, DataSubType.CO2,
                           DataSubType.LIGHT, DataSubType.PRESSURE]
        elif request.data_type == DataType.SOIL:
            valid_subtypes = [DataSubType.MOISTURE, DataSubType.PH, DataSubType.EC,
                           DataSubType.TEMPERATURE_SOIL]
        elif request.data_type == DataType.FILE:
            valid_subtypes = [DataSubType.RGB, DataSubType.NIR, DataSubType.RED_EDGE,
                           DataSubType.THERMAL, DataSubType.MULTISPECTRAL, DataSubType.VIDEO]
        else:
            raise HTTPException(status_code=400, detail=f"不支持的数据类型: {request.data_type}")

        if request.data_subtype not in valid_subtypes:
            raise HTTPException(
                status_code=400,
                detail=f"数据类型 {request.data_type} 不支持子类型 {request.data_subtype}"
            )

        # 根据 data_subtype 自动推断单位
        data_unit = SUBTYPE_UNIT_MAP.get(request.data_subtype)
        if data_unit:
            data_unit = data_unit.value

        # 创建数据记录
        data_id = create_raw_data(
            db=db,
            session_id=request.session_id,
            data_type=request.data_type.value,
            data_subtype=request.data_subtype.value,
            data_value=request.data_value,
            data_unit=data_unit,  # 自动添加单位
            capture_time=request.capture_time or datetime.now(),
            location_geom=request.location_geom,
            altitude_m=request.altitude_m,
            heading=request.heading,
            sensor_meta=request.sensor_meta,
            quality_score=request.quality_score,
            is_valid=request.is_valid,
            validation_notes=request.validation_notes
        )

        if not data_id:
            raise HTTPException(
                status_code=400,
                detail="数据上传失败：会话不存在或状态不允许上传数据"
            )

        return {
            "code": 200,
            "message": "success",
            "data": UploadDataResponse(
                data_id=data_id,
                data_type=request.data_type,
                data_subtype=request.data_subtype,
                data_value=request.data_value,
                upload_time=datetime.now().isoformat()
            ).model_dump()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[上传数据] 失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"数据上传失败: {str(e)}")
    finally:
        if db is not None:  # pyright: ignore[reportPossiblyUnboundVariable]
            db.close()  # pyright: ignore[reportPossiblyUnboundVariable]


@router.post("/upload-file", summary="上传文件数据")
async def upload_file_data(
    file: UploadFile = File(..., description="文件数据"),
    session_id: str = Form(..., description="采集会话ID"),
    data_subtype: str = Form(..., description="数据子类型"),
    description: Optional[str] = Form(None, description="文件描述"),
    location_geom: Optional[str] = Form(None, description="位置几何信息（WKT格式）"),
    altitude_m: Optional[float] = Form(None, description="采集高度（米）"),
    heading: Optional[float] = Form(None, description="朝向（度）"),
    x_api_key: Optional[str] = Header(None, description="API密钥（可选）"),
    authorization: Optional[str] = Header(None, description="JWT令牌（可选）"),
    meta_db: Session = Depends(get_meta_db)
):
    """
    上传文件类型数据（图像、视频等存储在MinIO中的文件）

    认证方式（按优先级排序）：
    1. JWT令牌认证（推荐，主要用于Web应用）
       - Header: Authorization: Bearer <jwt_token>
    2. API密钥认证（备用，用于设备和第三方集成）
       - Header: X-API-Key: <api_key>

    支持的数据子类型：
    - rgb: RGB图像
    - nir: 近红外图像
    - red_edge: 红边图像
    - thermal: 热成像
    - multispectral: 多光谱图像
    - video: 视频文件
    """
    try:
        # 认证用户：优先使用JWT令牌，备用API密钥认证
        current_user = None
        db: Session | None = None

        # 优先尝试JWT认证
        if authorization:
            try:
                from fastapi.security import HTTPAuthorizationCredentials
                if authorization.startswith('Bearer '):
                    token = authorization[7:]
                    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
                    current_user = await get_current_user(credentials, meta_db)
                    db = get_current_user_db(current_user)
                    logger.info(f"[上传文件] JWT认证成功: {current_user.username}")
                else:
                    raise HTTPException(status_code=401, detail="无效的Authorization格式")
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"JWT认证失败: {str(e)}")

        # 如果没有JWT，尝试API密钥认证
        elif x_api_key:
            try:
                current_user = await get_current_user_from_api_key(x_api_key, meta_db)
                db = get_current_user_db(current_user)
                logger.info(f"[上传文件] API密钥认证成功: {current_user.username}")
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"API密钥认证失败: {str(e)}")

        else:
            raise HTTPException(
                status_code=401,
                detail="需要认证：请提供JWT令牌（推荐）或API密钥"
            )

        # 验证数据子类型
        valid_subtypes = ["rgb", "nir", "red_edge", "thermal", "multispectral", "video"]
        if data_subtype not in valid_subtypes:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的数据子类型: {data_subtype}，支持的类型: {', '.join(valid_subtypes)}"
            )

        # 读取文件数据
        file_data = await file.read()

        # 如果是图像，进行格式检测和验证
        data_format = None
        if file.content_type and file.content_type.startswith('image/'):
            image_processor = get_image_processor()
            format_info = image_processor.detect_image_format(file_data, file.filename)
            data_format = format_info['extension']

            # 验证图像文件
            validation_result = image_processor.validate_image_file(file_data)
            if not validation_result['is_valid']:
                raise HTTPException(
                    status_code=400,
                    detail=f"图像验证失败: {'; '.join(validation_result['errors'])}"
                )
        elif file.content_type and file.content_type.startswith('video/'):
            # 视频文件格式
            ext_map = {
                'video/mp4': 'mp4',
                'video/quicktime': 'mov',
                'video/x-msvideo': 'avi',
                'video/x-matroska': 'mkv'
            }
            data_format = ext_map.get(file.content_type, file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'mp4')
        else:
            data_format = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'bin'

        # 生成唯一文件名
        unique_filename = f"{uuid.uuid4().hex}_{int(datetime.now().timestamp())}.{data_format}"

        # 上传文件到MinIO (路径规范: user_{userid}/data/session_{session_id}/)
        storage_manager = get_storage_manager()
        upload_result = storage_manager.upload_bytes(
            user_id=str(current_user.userid),
            data=file_data,
            filename=unique_filename,
            session_id=session_id,
            content_type=file.content_type or 'application/octet-stream'
        )

        if not upload_result['success']:
            raise HTTPException(status_code=500, detail=f"文件上传失败: {upload_result['message']}")

        # 计算文件校验和
        checksum = None
        if file.content_type and file.content_type.startswith('image/'):
            image_processor = get_image_processor()
            checksum = image_processor.calculate_checksum(file_data)

        # 创建数据库记录
        data_id = create_raw_data(
            db=db,
            session_id=session_id,
            data_type=DataType.FILE.value,
            data_subtype=data_subtype,
            data_value=upload_result['url'],  # MinIO存储地址
            data_format=data_format,
            bucket_name=upload_result['bucket'],
            object_key=upload_result['path'],
            capture_time=datetime.now(),
            location_geom=location_geom,
            altitude_m=altitude_m,
            heading=heading,
            file_meta={
                "original_filename": file.filename,
                "stored_filename": unique_filename,
                "file_size_bytes": len(file_data),
                "content_type": file.content_type,
                "description": description
            },
            acquisition_meta={
                "upload_time": datetime.now().isoformat(),
                "upload_method": "api" if x_api_key else "web"
            },
            quality_score=1.0,
            checksum=checksum,
            is_valid=True
        )

        if not data_id:
            raise HTTPException(
                status_code=400,
                detail="文件上传失败：会话不存在或状态不允许上传数据"
            )

        return {
            "code": 200,
            "message": "success",
            "data": UploadFileResponse(
                data_id=data_id,
                object_key=upload_result['path'],
                access_url=upload_result['url'],
                data_type=DataType.FILE,
                data_subtype=DataSubType[data_subtype.upper()],
                file_size_bytes=len(file_data),
                file_size_mb=round(len(file_data) / (1024 * 1024), 2),
                data_format=data_format,
                upload_time=datetime.now().isoformat()
            ).model_dump()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[上传文件] 失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")
    finally:
        db.close()  # pyright: ignore[reportPossiblyUnboundVariable, reportOptionalMemberAccess]
