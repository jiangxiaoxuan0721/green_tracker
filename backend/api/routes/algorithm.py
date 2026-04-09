from database.db_models.meta_model import Algorithm
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from database.main_db import get_meta_db
from database.db_services import algorithm_service
from database.db_models.meta_model import User
from api.schemas.algorithm import (
    AlgorithmCreate, AlgorithmUpdate, AlgorithmResponse,
    AlgorithmListResponse, AlgorithmUploadResponse, ReviewCreate, ReviewResponse
)
from api.routes.auth import get_current_user
from typing import List, Optional
import json
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/algorithms", tags=["algorithms"])

# MinIO 配置
MINIO_BUCKET = "algorithms"


@router.get("/", response_model=AlgorithmListResponse)
async def get_algorithms(
    page: int = 1,
    page_size: int = 12,
    search: str = None,
    category: str = None,
    db: Session = Depends(get_meta_db)
):
    """
    获取算法列表
    
    支持分页、搜索、分类筛选
    """
    try:
        skip = (page - 1) * page_size
        algorithms, total = algorithm_service.get_algorithm_list(
            db, skip=skip, limit=page_size,
            search=search, category=category
        )
        
        # 转换tags字段
        items = []
        for algo in algorithms:
            tags = json.loads(algo.tags) if algo.tags else []
            items.append(AlgorithmResponse(
                id=algo.id,
                uuid=algo.uuid,
                name=algo.name,
                description=algo.description,
                category=algo.category,
                tags=tags,
                author_id=algo.author_id,
                author_name=algo.author_name,
                version=algo.version,
                minio_path=algo.minio_path,
                file_size=algo.file_size,
                docker_image=algo.docker_image,
                container_port=algo.container_port,
                framework=algo.framework,
                input_type=algo.input_type,
                output_type=algo.output_type,
                downloads=algo.downloads,
                calls=algo.calls,
                rating=algo.rating,
                status=algo.status,
                created_at=algo.created_at,
                updated_at=algo.updated_at
            ))
        
        return AlgorithmListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        logger.error(f"获取算法列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取算法列表失败: {str(e)}"
        )


@router.get("/categories")
async def get_categories(db: Session = Depends(get_meta_db)):
    """获取所有算法分类"""
    try:
        categories = algorithm_service.get_categories(db)
        return {"categories": categories}
    except Exception as e:
        logger.error(f"获取分类失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{algorithm_id}", response_model=AlgorithmResponse)
async def get_algorithm_detail(algorithm_id: str, db: Session = Depends(get_meta_db)):
    """获取算法详情"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        tags = json.loads(algorithm.tags) if algorithm.tags else []
        return AlgorithmResponse(
            id=algorithm.id,
            uuid=algorithm.uuid,
            name=algorithm.name,
            description=algorithm.description,
            category=algorithm.category,
            tags=tags,
            author_id=algorithm.author_id,
            author_name=algorithm.author_name,
            version=algorithm.version,
            minio_path=algorithm.minio_path,
            file_size=algorithm.file_size,
            docker_image=algorithm.docker_image,
            container_port=algorithm.container_port,
            framework=algorithm.framework,
            input_type=algorithm.input_type,
            output_type=algorithm.output_type,
            downloads=algorithm.downloads,
            calls=algorithm.calls,
            rating=algorithm.rating,
            status=algorithm.status,
            created_at=algorithm.created_at,
            updated_at=algorithm.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取算法详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/upload", response_model=AlgorithmUploadResponse)
async def upload_algorithm(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    tags: str = Form("[]"),
    version: str = Form("1.0.0"),
    framework: str = Form(None),
    input_type: str = Form("image"),
    output_type: str = Form("json"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    上传算法包
    
    上传算法ZIP包，包含 algorithm.yaml 元数据和代码
    """
    try:
        # 解析tags
        try:
            tags_list = json.loads(tags) if tags else []
        except:
            tags_list = []
        
        # 生成唯一ID
        from database.db_services.algorithm_service import create_algorithm
        import uuid as uuid_module
        algorithm_uuid = str(uuid_module.uuid4())
        
        # 检查文件类型
        if not file.filename.endswith('.zip'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅支持ZIP格式的算法包"
            )
        
        # 读取文件内容
        file_content = await file.read()
        file_size = len(file_content)
        
        # 上传到 MinIO
        from storage.minio_client import minio_client
        minio_path = f"{algorithm_uuid}/{file.filename}"
        minio_client.upload_file(
            bucket=MINIO_BUCKET,
            object_name=minio_path,
            data=file_content,
            content_type="application/zip"
        )
        
        # 保存到数据库
        algorithm = algorithm_service.create_algorithm(
            db=db,
            name=name,
            author_id=str(current_user.userid),
            author_name=current_user.username,
            description=description,
            category=category,
            tags=tags_list,
            version=version,
            framework=framework,
            input_type=input_type,
            output_type=output_type,
            minio_path=minio_path,
            file_size=file_size
        )
        
        tags = json.loads(algorithm.tags) if algorithm.tags else []
        algo_response = AlgorithmResponse(
            id=algorithm.id,
            uuid=algorithm.uuid,
            name=algorithm.name,
            description=algorithm.description,
            category=algorithm.category,
            tags=tags,
            author_id=algorithm.author_id,
            author_name=algorithm.author_name,
            version=algorithm.version,
            minio_path=algorithm.minio_path,
            file_size=algorithm.file_size,
            docker_image=algorithm.docker_image,
            container_port=algorithm.container_port,
            framework=algorithm.framework,
            input_type=algorithm.input_type,
            output_type=algorithm.output_type,
            downloads=algorithm.downloads,
            calls=algorithm.calls,
            rating=algorithm.rating,
            status=algorithm.status,
            created_at=algorithm.created_at,
            updated_at=algorithm.updated_at
        )
        
        return AlgorithmUploadResponse(
            algorithm=algo_response,
            message="算法上传成功，正在构建镜像..."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传算法失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传算法失败: {str(e)}"
        )


@router.put("/{algorithm_id}", response_model=AlgorithmResponse)
async def update_algorithm(
    algorithm_id: str,
    algorithm_update: AlgorithmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """更新算法信息"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 检查权限
        if str(algorithm.author_id) != str(current_user.userid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改此算法"
            )
        
        update_data = algorithm_update.model_dump(exclude_unset=True)
        if 'tags' in update_data:
            update_data['tags'] = json.dumps(update_data['tags'])
        
        algorithm = algorithm_service.update_algorithm(db, algorithm_id, **update_data)
        
        tags = json.loads(algorithm.tags) if algorithm.tags else []
        return AlgorithmResponse(
            id=algorithm.id,
            uuid=algorithm.uuid,
            name=algorithm.name,
            description=algorithm.description,
            category=algorithm.category,
            tags=tags,
            author_id=algorithm.author_id,
            author_name=algorithm.author_name,
            version=algorithm.version,
            minio_path=algorithm.minio_path,
            file_size=algorithm.file_size,
            docker_image=algorithm.docker_image,
            container_port=algorithm.container_port,
            framework=algorithm.framework,
            input_type=algorithm.input_type,
            output_type=algorithm.output_type,
            downloads=algorithm.downloads,
            calls=algorithm.calls,
            rating=algorithm.rating,
            status=algorithm.status,
            created_at=algorithm.created_at,
            updated_at=algorithm.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新算法失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/{algorithm_id}")
async def delete_algorithm(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """删除算法"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 检查权限
        if str(algorithm.author_id) != str(current_user.userid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权删除此算法"
            )
        
        # 删除MinIO中的文件
        if algorithm.minio_path:
            try:
                from storage.minio_client import minio_client
                minio_client.remove_object(MINIO_BUCKET, algorithm.minio_path)
            except Exception as e:
                logger.warning(f"删除MinIO文件失败: {e}")
        
        # 删除数据库记录
        algorithm_service.delete_algorithm(db, algorithm_id)
        
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除算法失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{algorithm_id}/reviews", response_model=ReviewResponse)
async def add_review(
    algorithm_id: str,
    review: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """添加算法评论"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        if review.rating < 1 or review.rating > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="评分必须在1-5之间"
            )
        
        review_obj = algorithm_service.add_review(
            db=db,
            algorithm_id=algorithm_id,
            user_id=str(current_user.userid),
            rating=review.rating,
            comment=review.comment
        )
        
        return ReviewResponse(
            id=review_obj.id,
            algorithm_id=review_obj.algorithm_id,
            user_id=review_obj.user_id,
            rating=review_obj.rating,
            comment=review_obj.comment,
            created_at=review_obj.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"添加评论失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{algorithm_id}/reviews")
async def get_reviews(
    algorithm_id: str,
    db: Session = Depends(get_meta_db)
):
    """获取算法的所有评论"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        reviews = algorithm_service.get_algorithm_reviews(db, algorithm_id)
        return [
            ReviewResponse(
                id=r.id,
                algorithm_id=r.algorithm_id,
                user_id=r.user_id,
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at
            )
            for r in reviews
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取评论失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{algorithm_id}/download")
async def download_algorithm(
    algorithm_id: str,
    db: Session = Depends(get_meta_db)
):
    """
    下载算法包用于本地部署
    
    公开下载，不需要认证。
    """
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 增加下载次数
        algorithm_service.increment_downloads(db, algorithm_id)
        
        # 获取文件 - 使用流式传输避免内存问题
        from storage.minio_client import minio_client
        from minio.datatypes import Object
        import urllib.parse
        
        # 对中文文件名进行 RFC 5987 编码（在try块之前定义，确保except块可用）
        filename = f"{algorithm.name}_v{algorithm.version}.zip"
        encoded_filename = urllib.parse.quote(filename)
        
        # 使用简化的 ASCII 文件名用于传统 filename，同时提供 RFC 5987 格式
        safe_filename = f"algorithm_{algorithm.uuid[:8]}_v{algorithm.version}.zip"
        
        try:
            # 获取文件信息和大小
            import math
            
            # 创建流式响应
            from fastapi.responses import StreamingResponse
            import io
            
            # 获取文件流
            response = minio_client._client.get_object(MINIO_BUCKET, algorithm.minio_path)
            
            # 创建流式响应，逐块传输数据
            async def file_streamer():
                try:
                    # 使用较小的块大小，避免内存问题
                    chunk_size = 1024 * 1024  # 1MB
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        yield chunk
                finally:
                    response.close()
                    response.release_conn()
            
            # 获取文件大小以设置Content-Length（如果知道）
            try:
                stat = minio_client._client.stat_object(MINIO_BUCKET, algorithm.minio_path)
                content_length = stat.size
                headers = {
                    "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=utf-8''{encoded_filename}",
                    "Content-Length": str(content_length),
                    "Content-Type": "application/zip"
                }
            except:
                # 如果无法获取大小，使用默认头部
                headers = {
                    "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=utf-8''{encoded_filename}",
                    "Content-Type": "application/zip"
                }
            
            return StreamingResponse(
                file_streamer(),
                media_type="application/zip",
                headers=headers
            )
            
        except Exception as e:
            logger.error(f"获取或流式传输文件失败: {str(e)}")
            # 回退到旧方法
            file_data = minio_client.get_object(MINIO_BUCKET, algorithm.minio_path)
            
            from fastapi.responses import StreamingResponse
            import io
            
            return StreamingResponse(
                io.BytesIO(file_data),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=utf-8''{encoded_filename}"
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载算法失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{algorithm_id}/predict")
async def predict_algorithm(
    algorithm_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    在线推理 - 代理请求到算法容器
    
    将图片发送到算法容器进行推理，返回结果
    """
    try:
        algorithm: Algorithm | None = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 检查算法是否已部署
        if algorithm.status != 'running':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"算法当前状态为 {algorithm.status}，请等待部署完成后再使用"
            )
        
        if not algorithm.container_port:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="算法容器端口未配置"
            )
        
        # 增加调用计数
        algorithm_service.increment_calls(db, algorithm_id)
        
        # 读取上传的图片
        image_data = await file.read()
        
        # 构造目标容器URL（后端和容器在同一服务器，使用localhost）
        container_host = "localhost"
        if not algorithm.container_port:
            logger.error(f"[在线推理] 算法 {algorithm_id} 没有配置容器端口")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="算法容器端口未配置"
            )
        container_port = algorithm.container_port
        container_url = f"http://{container_host}:{container_port}/predict"
        
        logger.info(f"[在线推理] 算法ID: {algorithm_id}, 容器端口: {container_port}, URL: {container_url}")

        logger.info(f"[在线推理] 算法ID: {algorithm_id}, 容器URL: {container_url}")

        # 发送请求到算法容器
        import httpx
        files = {'file': (file.filename, image_data, file.content_type)}

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(container_url, files=files)
        except httpx.ConnectError as e:
            logger.error(f"[在线推理] 无法连接到容器 {container_url}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"无法连接到算法服务，请检查算法是否正常运行。容器地址: {container_url}"
            )
        except httpx.ReadError as e:
            logger.error(f"[在线推理] 读取容器响应失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"算法服务响应超时，可能正在处理中，请稍后重试。"
            )
        
        if response.status_code != 200:
            logger.error(f"算法容器返回错误: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"算法推理失败: {response.text}"
            )
        
        result = response.json()
        
        # 返回结果
        return {
            "success": True,
            "algorithm_id": algorithm_id,
            "algorithm_name": algorithm.name,
            "result": result
        }
        
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("算法推理超时")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="算法推理超时，请稍后重试"
        )
    except Exception as e:
        import traceback
        logger.error(f"在线推理失败: {str(e)}")
        logger.error(f"详细错误: {traceback.format_exc()}")
        error_detail = str(e) if str(e) else "未知错误，请检查算法容器是否正常运行"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"在线推理失败: {error_detail}"
        )


@router.post("/{algorithm_id}/build")
async def trigger_build(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """
    触发算法镜像构建和部署
    
    1. 从MinIO下载算法包
    2. 生成Dockerfile
    3. 构建Docker镜像
    4. 启动容器
    """
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 检查权限
        if str(algorithm.author_id) != str(current_user.userid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权操作此算法"
            )
        
        # 检查算法包是否已上传
        if not algorithm.minio_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="算法包未上传"
            )
        
        # 更新状态为构建中
        algorithm_service.update_algorithm(db, algorithm_id, status='building', build_log='开始构建...')
        
        # 导入服务
        from storage.minio_client import minio_client
        from storage.image_build_service import get_image_build_service
        from storage.container_manager import get_container_manager
        from storage.dockerfile_generator import get_dockerfile_generator
        
        # 1. 构建镜像
        build_service = get_image_build_service()
        generator = get_dockerfile_generator()
        
        # 获取可用端口
        port = generator.get_next_port()
        logger.info(f"[构建算法] 算法ID: {algorithm_id}, 分配端口: {port}")
        
        # 构建镜像时传递分配的端口，确保Dockerfile使用正确的内部端口
        success, docker_image, result = await build_service.build_image(
            algorithm_uuid=algorithm.uuid,
            minio_path=algorithm.minio_path,
            minio_client=minio_client,
            assigned_port=port  # 传递分配的主机端口
        )
        
        if not success:
            algorithm_service.update_algorithm(
                db, algorithm_id,
                status='error',
                build_log=f"镜像构建失败: {result}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"镜像构建失败: {result}"
            )
        
        # result应该是返回的主机端口号
        if isinstance(result, int):
            # result是端口号，我们可以使用它（但我们已经有了port变量）
            logger.info(f"镜像构建成功，返回端口: {result}, 分配的端口: {port}")
            # 我们使用分配的端口，保持一致性
            port = result  # 使用返回的端口，确保与分配的一致
        elif isinstance(result, str) and result.isdigit():
            port = int(result)
            logger.info(f"转换字符串端口: {port}")
        elif isinstance(result, str):
            # result是错误信息
            algorithm_service.update_algorithm(
                db, algorithm_id,
                status='error',
                build_log=f"镜像构建失败: {result}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"镜像构建失败: {result}"
            )
        else:
            logger.warning(f"返回的result类型: {type(result)}, 值: {result}")
        
        # 2. 启动容器
        container_manager = get_container_manager()
        container_success, container_id, actual_port, error = await container_manager.start_container(
            algorithm_uuid=algorithm.uuid,
            image_name=docker_image,
            port=port,
            env={"ALGORITHM_NAME": algorithm.name}
        )
        
        if not container_success:
            algorithm_service.update_algorithm(
                db, algorithm_id,
                status='error',
                docker_image=docker_image,
                container_port=port,  # 如果启动失败，仍然使用原始端口
                build_log=f"容器启动失败: {error}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"容器启动失败: {error}"
            )
        
        # 3. 更新算法状态为运行中，使用实际端口
        algorithm_service.update_algorithm(
            db, algorithm_id,
            status='running',
            docker_image=docker_image,
            container_port=actual_port,  # 使用容器管理器返回的实际端口
            build_log=f'构建并部署成功，容器端口: {actual_port}'
        )
        
        return {
            "message": "算法构建并部署成功",
            "algorithm_id": algorithm_id,
            "docker_image": docker_image,
            "container_port": actual_port,  # 返回实际端口给前端
            "status": "running"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"触发构建失败: {str(e)}")
        # 更新状态为错误
        try:
            algorithm_service.update_algorithm(db, algorithm_id, status='error', build_log=str(e))
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"触发构建失败: {str(e)}"
        )


@router.post("/{algorithm_id}/stop")
async def stop_algorithm(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """停止算法容器"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 检查权限
        if str(algorithm.author_id) != str(current_user.userid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权操作此算法"
            )
        
        # 停止容器
        from storage.container_manager import get_container_manager
        container_manager = get_container_manager()
        
        await container_manager.stop_container(algorithm.uuid)
        
        # 更新状态
        algorithm_service.update_algorithm(db, algorithm_id, status='stopped')
        
        return {
            "message": "算法已停止",
            "algorithm_id": algorithm_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停止算法失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{algorithm_id}/restart")
async def restart_algorithm(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """重启算法容器"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 检查权限
        if str(algorithm.author_id) != str(current_user.userid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权操作此算法"
            )
        
        # 重启容器
        from storage.container_manager import get_container_manager
        container_manager = get_container_manager()
        
        # 先删除已存在的容器（即使已停止），然后重新创建
        await container_manager.remove_container(algorithm.uuid)
        
        if algorithm.docker_image and algorithm.container_port:
            success, container_id, actual_port, error = await container_manager.start_container(
                algorithm_uuid=algorithm.uuid,
                image_name=algorithm.docker_image,
                port=algorithm.container_port
            )
            if not success:
                logger.error(f"重启容器失败: {error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"重启容器失败: {error}"
                )
        
        # 更新状态
        algorithm_service.update_algorithm(db, algorithm_id, status='running')
        
        return {
            "message": "算法已重启",
            "algorithm_id": algorithm_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重启算法失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{algorithm_id}/status")
async def get_algorithm_status(
    algorithm_id: str,
    db: Session = Depends(get_meta_db)
):
    """获取算法运行状态"""
    try:
        algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
        if not algorithm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="算法不存在"
            )
        
        # 如果算法正在运行，检查容器健康状态
        container_status = "unknown"
        if algorithm.status == 'running' and algorithm.container_port:
            try:
                import httpx
                health_url = f"http://localhost:{algorithm.container_port}/health"
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(health_url)
                    container_status = "healthy" if response.status_code == 200 else "unhealthy"
            except:
                container_status = "unreachable"
        
        return {
            "algorithm_id": algorithm_id,
            "name": algorithm.name,
            "status": algorithm.status,
            "container_port": algorithm.container_port,
            "docker_image": algorithm.docker_image,
            "container_status": container_status,
            "calls": algorithm.calls,
            "downloads": algorithm.downloads
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取状态失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )