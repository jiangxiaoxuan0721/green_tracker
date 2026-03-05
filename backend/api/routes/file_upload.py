"""
文件上传API路由
支持图像文件上传和格式识别
"""

import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional, List
from sqlalchemy.orm import Session
from ..routes.auth import get_current_user, get_current_user_from_api_key
from database.db_models.meta_model import User
from database.user_db_manager import get_current_user_db
from database.main_db import get_meta_db
from fastapi import Header, Depends
from storage.storage_manager import get_storage_manager
from utils.image_processor import get_image_processor
from database.db_services.raw_data_service import create_raw_data

router = APIRouter(prefix="/file-upload", tags=["文件上传"])


@router.post("/image", summary="上传图像文件")
async def upload_image(
    file: UploadFile = File(..., description="图像文件"),
    session_id: str = Form(..., description="采集会话ID（必需）"),
    data_subtype: Optional[str] = Form(None, description="数据子类型"),
    description: Optional[str] = Form(None, description="文件描述"),
    x_api_key: Optional[str] = Header(None, description="API密钥（可选，用于设备认证）"),
    authorization: Optional[str] = Header(None, description="JWT令牌（可选）"),
    meta_db: Session = Depends(get_meta_db)
):
    """
    上传图像文件并自动识别格式
    
    支持的图像格式：JPEG, PNG, GIF, BMP, TIFF, WEBP, ICO, SVG
    
    认证方式（按优先级排序）：
    1. JWT令牌认证（推荐，主要用于Web应用）
       - Header: Authorization: Bearer <jwt_token>
    2. API密钥认证（备用，用于设备和第三方集成）
       - Header: X-API-Key: <api_key>
    
    必需参数：
    - session_id: 有效的采集会话ID，请先通过采集会话管理接口创建会话
    
    认证优先级：JWT令牌 > API密钥
    
    Returns:
        上传结果，包含文件信息、存储路径和格式识别结果
    """
    try:
        # 认证用户：优先使用JWT令牌，备用API密钥认证
        current_user = None
        db = None
        
        # 优先尝试JWT认证（推荐方式）
        if authorization:
            try:
                from fastapi.security import HTTPAuthorizationCredentials
                # 提取Bearer token
                if authorization.startswith('Bearer '):
                    token = authorization[7:]  # 移除 'Bearer ' 前缀
                    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
                    current_user = await get_current_user(credentials, meta_db)
                    db = get_current_user_db(current_user)
                    print(f"[JWT认证] 用户认证成功: {current_user.username}")
                else:
                    raise HTTPException(status_code=401, detail="无效的Authorization格式，请使用Bearer token格式")
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"JWT认证失败: {str(e)}")
        
        # 如果没有JWT，尝试API密钥认证（备用方式）
        elif x_api_key:
            try:
                current_user = await get_current_user_from_api_key(x_api_key, meta_db)
                db = get_current_user_db(current_user)
                print(f"[API密钥认证] 用户认证成功: {current_user.username}")
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"API密钥认证失败: {str(e)}")
        
        # 如果两种认证方式都没有提供
        else:
            raise HTTPException(
                status_code=401,
                detail="需要认证：请提供JWT令牌（推荐）或API密钥",
                headers={
                    "WWW-Authenticate": "Bearer",
                    "X-Required-Auth": "Bearer token (推荐) or X-API-Key header (备用)",
                    "X-Preferred-Auth": "Bearer token"
                }
            )
        # 验证文件类型
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="请上传图像文件")
        
        # 读取文件数据
        file_data = await file.read()
        
        # 获取图像处理器
        image_processor = get_image_processor()
        
        # 验证图像文件
        validation_result = image_processor.validate_image_file(file_data)
        
        if not validation_result['is_valid']:
            raise HTTPException(
                status_code=400, 
                detail=f"图像验证失败: {'; '.join(validation_result['errors'])}"
            )
        
        # 检测图像格式
        format_info = image_processor.detect_image_format(file_data, file.filename)
        
        # 生成唯一文件名
        file_extension = format_info['extension'] or 'jpg'
        unique_filename = f"{uuid.uuid4().hex}_{int(datetime.now().timestamp())}.{file_extension}"
        
        # 获取存储管理器
        storage_manager = get_storage_manager()
        
        # 上传文件到MinIO
        upload_result = storage_manager.upload_bytes(
            user_id=str(current_user.userid),
            data=file_data,
            filename=unique_filename,
            category="raw",
            subcategory="images",
            content_type=format_info['mime_type'] or 'image/jpeg'
        )
        
        if not upload_result['success']:
            raise HTTPException(status_code=500, detail=f"文件上传失败: {upload_result['message']}")
        
        # 计算文件校验和
        checksum = image_processor.calculate_checksum(file_data)
        
        # 获取图像元数据
        metadata = image_processor.get_image_metadata(file_data)
        
        # 验证session_id是否提供
        if not session_id:
            raise HTTPException(
                status_code=400,
                detail="缺少必需的session_id参数。请先创建采集会话，然后使用该会话ID上传文件。"
            )
        
        # 创建数据库记录 - 简单直接的方式
        try:
            print(f"[文件上传] 开始创建数据库记录")
            effective_session_id = session_id
            
            # 创建一个新的数据库事务来避免事务污染
            from sqlalchemy.orm import sessionmaker
            from database.user_db_manager import UserDatabaseManager
            manager = UserDatabaseManager()
            user_engine = manager._engines.get(str(current_user.userid))
            if user_engine:
                new_session = sessionmaker(bind=user_engine)()
                try:
                    # 使用新的session创建记录
                    raw_data_record = create_raw_data(
                        db=new_session,
                        session_id=effective_session_id,
                        data_type='image',
                        data_value=upload_result['url'],  # MinIO存储地址
                        bucket_name=upload_result['bucket'],  # 存储桶名称
                        object_key=upload_result['path'],    # 完整对象路径
                        capture_time=datetime.now(),
                        sensor_meta=metadata,
                        file_meta={
                            "original_filename": file.filename,
                            "stored_filename": unique_filename,
                            "file_size_bytes": len(file_data),
                            "content_type": file.content_type,
                            "format_info": format_info
                        },
                        acquisition_meta={
                            "upload_time": datetime.now().isoformat(),
                            "upload_method": "api" if x_api_key else "web"
                        },
                        quality_score=1.0 if validation_result['is_valid'] else 0.0,
                        checksum=checksum,
                        is_valid=validation_result['is_valid'],
                        validation_notes=validation_result['errors'] if not validation_result['is_valid'] else None
                    )
                    
                    if raw_data_record:
                        print(f"[文件上传] 数据库记录创建成功，ID: {raw_data_record}")
                    else:
                        print(f"[文件上传] 数据库记录创建失败，返回None")
                        raise HTTPException(
                            status_code=400, 
                            detail="文件上传失败：会话不存在或状态不允许上传数据。只有进行中的会话才能上传数据。"
                        )
                        
                finally:
                    new_session.close()
            else:
                print(f"[文件上传] 无法获取用户数据库引擎")
            
        except Exception as e:
            print(f"[文件上传] 创建数据库记录失败: {str(e)}")
            # 不影响上传成功的响应，但记录错误
            import traceback
            traceback.print_exc()
        
        # 构建响应数据
        response_data = {
            "upload_info": {
                "file_id": unique_filename.split('.')[0],  # 去掉扩展名的部分作为文件ID
                "original_filename": file.filename,
                "stored_filename": unique_filename,
                "file_size_bytes": len(file_data),
                "file_size_mb": round(len(file_data) / (1024 * 1024), 2),
                "content_type": file.content_type,
                "upload_time": datetime.now().isoformat()
            },
            "format_info": format_info,
            "storage_info": {
                "bucket_name": upload_result['bucket'],
                "object_path": upload_result['path'],
                "access_url": upload_result['url']
            },
            "metadata": metadata,
            "checksum": checksum,
            "warnings": validation_result.get('warnings', [])
        }
        
        return {
            "code": 200,
            "message": "图像上传成功",
            "data": response_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图像上传处理失败: {str(e)}")


@router.post("/batch-images", summary="批量上传图像文件")
async def upload_batch_images(
    files: List[UploadFile] = File(..., description="图像文件列表"),
    session_id: Optional[str] = Form(None, description="采集会话ID"),
    data_subtype: Optional[str] = Form(None, description="数据子类型"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """
    批量上传图像文件
    
    Returns:
        批量上传结果，包含每个文件的上传状态
    """
    try:
        if len(files) > 20:  # 限制批量上传数量
            raise HTTPException(status_code=400, detail="批量上传文件数量不能超过20个")
        
        results = []
        image_processor = get_image_processor()
        storage_manager = get_storage_manager()
        
        for file in files:
            try:
                # 验证文件类型
                if not file.content_type or not file.content_type.startswith('image/'):
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": "不是有效的图像文件"
                    })
                    continue
                
                # 读取文件数据
                file_data = await file.read()
                
                # 验证图像文件
                validation_result = image_processor.validate_image_file(file_data)
                
                if not validation_result['is_valid']:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": f"图像验证失败: {'; '.join(validation_result['errors'])}"
                    })
                    continue
                
                # 检测图像格式
                format_info = image_processor.detect_image_format(file_data, file.filename)
                
                # 生成唯一文件名
                file_extension = format_info['extension'] or 'jpg'
                unique_filename = f"{uuid.uuid4().hex}_{int(datetime.now().timestamp())}.{file_extension}"
                
                # 上传文件
                upload_result = storage_manager.upload_bytes(
                    user_id=str(current_user.userid),
                    data=file_data,
                    filename=unique_filename,
                    category="raw",
                    subcategory="images",
                    content_type=format_info['mime_type'] or 'image/jpeg'
                )
                
                if upload_result['success']:
                    # 计算校验和
                    checksum = image_processor.calculate_checksum(file_data)
                    
                    results.append({
                        "filename": file.filename,
                        "success": True,
                        "file_id": unique_filename.split('.')[0],
                        "stored_filename": unique_filename,
                        "format_info": format_info,
                        "storage_info": {
                            "bucket_name": upload_result['bucket'],
                            "object_path": upload_result['path'],
                            "access_url": upload_result['url']
                        },
                        "checksum": checksum,
                        "file_size_mb": round(len(file_data) / (1024 * 1024), 2),
                        "warnings": validation_result.get('warnings', [])
                    })
                else:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": f"上传失败: {upload_result['message']}"
                    })
                    
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": str(e)
                })
        
        # 统计结果
        success_count = sum(1 for r in results if r['success'])
        
        return {
            "code": 200,
            "message": f"批量上传完成，成功 {success_count}/{len(files)} 个文件",
            "data": {
                "total_files": len(files),
                "success_count": success_count,
                "failure_count": len(files) - success_count,
                "results": results
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量上传处理失败: {str(e)}")


@router.get("/supported-formats", summary="获取支持的图像格式")
async def get_supported_formats():
    """
    获取支持的图像格式列表
    
    Returns:
        支持的格式信息
    """
    return {
        "code": 200,
        "message": "success",
        "data": {
            "supported_formats": {
                "JPEG": {
                    "extensions": ["jpg", "jpeg"],
                    "mime_types": ["image/jpeg", "image/jpg"],
                    "description": "JPEG图像格式，适合照片"
                },
                "PNG": {
                    "extensions": ["png"],
                    "mime_types": ["image/png"],
                    "description": "PNG图像格式，支持透明度"
                },
                "GIF": {
                    "extensions": ["gif"],
                    "mime_types": ["image/gif"],
                    "description": "GIF图像格式，支持动画"
                },
                "BMP": {
                    "extensions": ["bmp"],
                    "mime_types": ["image/bmp"],
                    "description": "BMP位图格式"
                },
                "TIFF": {
                    "extensions": ["tiff", "tif"],
                    "mime_types": ["image/tiff"],
                    "description": "TIFF格式，高质量图像"
                },
                "WEBP": {
                    "extensions": ["webp"],
                    "mime_types": ["image/webp"],
                    "description": "WebP格式，现代图像格式"
                },
                "ICO": {
                    "extensions": ["ico"],
                    "mime_types": ["image/x-icon"],
                    "description": "图标格式"
                },
                "SVG": {
                    "extensions": ["svg"],
                    "mime_types": ["image/svg+xml"],
                    "description": "矢量图形格式"
                }
            },
            "max_file_size_mb": 50,
            "max_batch_size": 20
        }
    }


@router.get("/image/{raw_data_id}", summary="获取已上传的图像")
async def get_uploaded_image(
    raw_data_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """
    获取已上传的图像文件
    
    Args:
        raw_data_id: 原始数据ID
        
    Returns:
        图像文件内容或重定向到存储URL
    """
    try:
        from database.db_services.raw_data_service import get_raw_data_by_id
        
        # 获取原始数据记录
        raw_data = get_raw_data_by_id(db, raw_data_id)
        
        if not raw_data:
            raise HTTPException(status_code=404, detail="图像数据不存在")
        
        # 检查数据类型
        if raw_data.get("data_type") != "image":
            raise HTTPException(status_code=400, detail="该数据不是图像类型")
        
        # 检查权限
        from database.db_models.user_models import CollectionSession
        session = db.query(CollectionSession).filter(
            CollectionSession.id == raw_data["session_id"]
        ).first()
        
        if not session or str(session.creator_id) != str(current_user.userid):
            raise HTTPException(status_code=403, detail="无权访问此图像")
        
        # 如果有MinIO存储路径，尝试从存储获取
        if raw_data.get("bucket_name") and raw_data.get("object_key"):
            storage_manager = get_storage_manager()
            try:
                # 从object_key中提取文件名（object_key是完整路径）
                object_path = raw_data["object_key"]
                filename = object_path.split("/")[-1]  # 提取文件名
                
                image_data = storage_manager.get_file_bytes(
                    user_id=str(current_user.userid),
                    object_name=filename,
                    category="raw",
                    subcategory="images"
                )
                
                if image_data and image_data.get('success') and image_data.get('data'):
                    from fastapi.responses import Response
                    
                    # 根据文件扩展名确定内容类型
                    content_type = 'image/jpeg'  # 默认
                    if raw_data.get("data_format"):
                        dt = raw_data["data_format"].lower()
                        if dt == 'png':
                            content_type = 'image/png'
                        elif dt == 'gif':
                            content_type = 'image/gif'
                        elif dt == 'webp':
                            content_type = 'image/webp'
                        elif dt == 'bmp':
                            content_type = 'image/bmp'
                        elif dt == 'tiff' or dt == 'tif':
                            content_type = 'image/tiff'
                    
                    return Response(
                        content=image_data['data'],
                        media_type=content_type,
                        headers={
                            "Cache-Control": "public, max-age=3600",  # 缓存1小时
                            "Access-Control-Allow-Origin": "*"
                        }
                    )
            except Exception as e:
                print(f"[获取图像] 从存储获取失败: {str(e)}")
        
        # 如果没有存储信息或获取失败，尝试从data_value获取URL
        if raw_data.get("data_value") and raw_data["data_value"].startswith("http"):
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=raw_data["data_value"])
        
        # 如果都没有，返回占位符
        from fastapi.responses import Response
        placeholder_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!\xbc\x33\x00\x00\x00\x00IEND\xaeB`\x82'
        return Response(
            content=placeholder_png, 
            media_type="image/png",
            headers={
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[获取图像] 处理请求失败: {str(e)}")
        from fastapi.responses import Response
        # 返回错误占位符
        placeholder_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!\xbc\x33\x00\x00\x00\x00IEND\xaeB`\x82'
        return Response(content=placeholder_png, media_type="image/png")


@router.delete("/image/{file_id}", summary="删除上传的图像")
async def delete_uploaded_image(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_current_user_db)
):
    """
    删除已上传的图像文件
    
    Args:
        file_id: 文件ID（上传时返回的file_id）
        
    Returns:
        删除结果
    """
    try:
        storage_manager = get_storage_manager()
        
        # 这里需要根据实际的存储路径结构来查找文件
        # 暂时使用简单的文件名匹配
        files = storage_manager.list_files(
            user_id=str(current_user.userid),
            category="raw",
            subcategory="images"
        )
        
        # 查找匹配的文件
        target_file = None
        for file_info in files:
            if file_id in file_info['name']:
                target_file = file_info
                break
        
        if not target_file:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 删除文件
        delete_result = storage_manager.delete_file(
            user_id=str(current_user.userid),
            object_name=os.path.basename(target_file['name']),
            category="raw",
            subcategory="images"
        )
        
        if not delete_result['success']:
            raise HTTPException(status_code=500, detail=f"删除文件失败: {delete_result['message']}")
        
        return {
            "code": 200,
            "message": "文件删除成功",
            "data": {
                "file_id": file_id,
                "deleted_path": delete_result['path']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除文件失败: {str(e)}")


