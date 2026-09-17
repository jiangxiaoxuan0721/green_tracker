from database.db_models.meta_model import Algorithm
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from database.main_db import get_meta_db
from database.user_db_manager import get_user_db
from database.db_services import algorithm_service
from database.db_services.log_service import create_log
from database.db_models.meta_model import User
from api.schemas.algorithm import (
    AlgorithmCreate, AlgorithmUpdate, AlgorithmResponse,
    AlgorithmListResponse, AlgorithmUploadResponse, ReviewCreate, ReviewResponse
)
from api.routes.auth import get_current_user
from storage.algorithm_deploy_service import get_deploy_service, BuildInProgressError
from storage.minio_client import MinioClient, get_minio_client
from typing import BinaryIO, List, Optional
from starlette.concurrency import run_in_threadpool
import json
import logging
import os
import uuid
from functools import wraps

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/algorithms", tags=["algorithms"])

# 算法包大小硬上限（1 GB，与前端 VITE_MAX_FILE_SIZE 对齐）
# nginx client_max_body_size 0 已在网关层放开，这里做应用层兜底防滥用
MAX_ALGORITHM_PACKAGE_SIZE = 1024 * 1024 * 1024


def _algorithm_to_response(algorithm: Algorithm) -> AlgorithmResponse:
    """ORM Algorithm → Schema（统一解析 tags 字符串，避免 4 处重复构造）。"""
    tags = json.loads(algorithm.tags) if algorithm.tags else []
    return AlgorithmResponse(
        id=algorithm.id, uuid=algorithm.uuid, name=algorithm.name,
        description=algorithm.description, category=algorithm.category,
        tags=tags, author_id=algorithm.author_id, author_name=algorithm.author_name,
        version=algorithm.version, minio_path=algorithm.minio_path,
        file_size=algorithm.file_size, docker_image=algorithm.docker_image,
        container_port=algorithm.container_port, framework=algorithm.framework,
        input_type=algorithm.input_type, output_type=algorithm.output_type,
        downloads=algorithm.downloads, calls=algorithm.calls,
        rating=algorithm.rating, status=algorithm.status,
        created_at=algorithm.created_at, updated_at=algorithm.updated_at,
    )


async def _resolve_upload_size(file: UploadFile) -> int:
    """获取上传文件字节数，**不把内容读入内存**。

    Starlette 的 UploadFile.size 多数情况下可用；缺失时回退到
    seek 末尾再复位（底层为 SpooledTemporaryFile，大文件已落磁盘临时文件）。
    """
    size = getattr(file, "size", None)
    if isinstance(size, int) and size >= 0:
        return size

    spooled: BinaryIO = file.file
    pos = spooled.tell()
    spooled.seek(0, os.SEEK_END)
    size = spooled.tell()
    spooled.seek(pos, os.SEEK_SET)
    return size


def _standard_errors(action_name: str):
    """统一路由的异常处理（消除 8 处重复 try/except/raise 模板）。

    - HTTPException 原样抛出（业务错误透传到客户端）
    - 其它异常 logger.error + 返回 500
    """
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            try:
                return await fn(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                logger.exception(f"{action_name}失败: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"{action_name}失败: {e}",
                )
        return wrapper
    return decorator


@router.get("/", response_model=AlgorithmListResponse)
@_standard_errors("获取算法列表")
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
    skip = (page - 1) * page_size
    algorithms, total = algorithm_service.get_algorithm_list(
        db, skip=skip, limit=page_size,
        search=search, category=category
    )

    items = [_algorithm_to_response(algo) for algo in algorithms]

    return AlgorithmListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/categories")
@_standard_errors("获取分类")
async def get_categories(db: Session = Depends(get_meta_db)):
    """获取所有算法分类"""
    categories = algorithm_service.get_categories(db)
    return {"categories": categories}


@router.get("/{algorithm_id}", response_model=AlgorithmResponse)
@_standard_errors("获取算法详情")
async def get_algorithm_detail(algorithm_id: str, db: Session = Depends(get_meta_db)):
    """获取算法详情"""
    algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
    if not algorithm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="算法不存在"
        )

    return _algorithm_to_response(algorithm)


@router.post("/upload", response_model=AlgorithmUploadResponse)
@_standard_errors("上传算法")
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

    上传算法ZIP包，包含 algorithm.yaml 元数据和代码；
    上传成功后服务端自动异步触发构建（P0.1 闭环），task_id + stream_url 一并返回。
    """
    # 解析tags
    try:
        tags_list = json.loads(tags) if tags else []
    except Exception:
        tags_list = []

    # ★ 关键：预生成一个 uuid，让 MinIO 路径前缀 == Algorithm.uuid（消除 P0.2 的不一致）
    algorithm_uuid = str(uuid.uuid4())

    # 检查文件类型（filename 可能缺失，避免无保护调用抛 AttributeError）
    filename = file.filename or ''
    if not filename.lower().endswith('.zip'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持ZIP格式的算法包"
        )

    # 文件大小：不读入内存（Starlette 已把大文件溢写至磁盘临时文件）
    file_size = await _resolve_upload_size(file)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="上传文件为空"
        )
    if file_size > MAX_ALGORITHM_PACKAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"算法包大小 {file_size / (1024 * 1024):.1f} MB 超过上限 "
                f"{MAX_ALGORITHM_PACKAGE_SIZE // (1024 * 1024)} MB（1 GB）"
            ),
        )

    # 流式上传到 MinIO：直接把 SpooledTemporaryFile 交给 put_object，
    # 避免 1GB 级算法包全量驻留内存（原先 await file.read() + BytesIO 双份拷贝）。
    # put_object 为同步阻塞 IO，放线程池执行以免阻塞事件循环。
    minio_path = f"{algorithm_uuid}/{filename}"

    def _upload_package() -> int:
        return get_minio_client().upload_file(
            bucket=MinioClient.ALGORITHMS_BUCKET,
            object_name=minio_path,
            data=file.file,
            content_type="application/zip",
            length=file_size,
        )

    await run_in_threadpool(_upload_package)

    # 保存到数据库（传入同一个 uuid，保证 MinIO 路径前缀与 DB uuid 闭环一致）
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
        file_size=file_size,
        algorithm_uuid=algorithm_uuid,
    )

    algo_response = _algorithm_to_response(algorithm)

    # ★ P0.1 闭环：上传成功后立即异步触发构建（与「提交构建」端点共用 helper）。
    # 用 try/except 包住：构建失败不能影响上传本身的成功响应
    task_id: Optional[str] = None
    stream_url: Optional[str] = None
    try:
        task_id, stream_url = await _submit_build_for(
            db, str(algorithm.id), current_user
        )
    except HTTPException as he:
        logger.warning(f"上传后自动构建未启动: {he.detail}")
    except Exception as e:
        logger.error(f"上传后自动构建异常: {e}")

    # 记录操作日志（user_db 异常不能影响上传返回值）
    try:
        user_db = get_user_db(str(current_user.userid))
        try:
            create_log(
                user_db, "info", "algorithm.upload",
                f"用户 {current_user.username} 上传算法: {name} v{version}",
                related_id=str(algorithm.id), related_type="algorithm",
            )
        finally:
            user_db.close()
    except Exception as e:
        logger.warning(f"记录上传日志失败: {e}")

    message = "算法上传成功" + ("，正在构建镜像..." if task_id else "（自动构建未启动，可手动触发）")
    return AlgorithmUploadResponse(
        algorithm=algo_response,
        message=message,
        task_id=task_id,
        stream_url=stream_url,
    )


@router.put("/{algorithm_id}", response_model=AlgorithmResponse)
@_standard_errors("更新算法")
async def update_algorithm(
    algorithm_id: str,
    algorithm_update: AlgorithmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """更新算法信息"""
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

    return _algorithm_to_response(algorithm)


@router.delete("/{algorithm_id}")
@_standard_errors("删除算法")
async def delete_algorithm(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """删除算法（P1.1：级联清理容器 + 镜像 + MinIO + DB 记录）"""
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

    # ★ P1.1：级联清理容器 + 镜像（先停再删，docker 不存在时容错返回 False）
    if algorithm.docker_image:
        try:
            from storage.container_manager import ContainerManager
            cm = ContainerManager()
            # 1. 停+删同名容器（即使不存在也不报错）
            await cm.remove_container(algorithm.uuid)
            # 2. 删镜像（即便 tag: latest 不存在，也尝试移除）
            from storage.image_build_service import ImageBuildService
            ibs = ImageBuildService()
            image_tag = ImageBuildService.image_tag(algorithm.uuid)
            await ibs._exec(["docker", "rmi", "-f", image_tag], check=False)
        except Exception as e:
            logger.warning(f"清理算法容器/镜像失败（继续删除 DB 记录）: {e}")

    # 删除MinIO中的文件（minio_client 是惰性代理）
    if algorithm.minio_path:
        try:
            minio_client.remove_object(MinioClient.ALGORITHMS_BUCKET, algorithm.minio_path)
        except Exception as e:
            logger.warning(f"删除MinIO文件失败: {e}")

    # 删除数据库记录
    algorithm_service.delete_algorithm(db, algorithm_id)

    # 记录操作日志（user_db 异常不阻塞响应）
    try:
        user_db = get_user_db(str(current_user.userid))
        try:
            create_log(
                user_db, "warning", "algorithm.delete",
                f"用户 {current_user.username} 删除算法: {algorithm.name}",
                related_id=algorithm_id, related_type="algorithm",
            )
        finally:
            user_db.close()
    except Exception as e:
        logger.warning(f"记录删除日志失败: {e}")

    return {"message": "删除成功"}


@router.post("/{algorithm_id}/reviews", response_model=ReviewResponse)
@_standard_errors("添加评论")
async def add_review(
    algorithm_id: str,
    review: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """添加算法评论"""
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


@router.get("/{algorithm_id}/reviews")
@_standard_errors("获取评论")
async def get_reviews(
    algorithm_id: str,
    db: Session = Depends(get_meta_db)
):
    """获取算法的所有评论"""
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


@router.get("/{algorithm_id}/download")
@_standard_errors("下载算法")
async def download_algorithm(
    algorithm_id: str,
    db: Session = Depends(get_meta_db)
):
    """
    下载算法包用于本地部署

    公开下载，不需要认证。
    """
    import io
    import urllib.parse

    algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
    if not algorithm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="算法不存在"
        )

    # 增加下载次数
    algorithm_service.increment_downloads(db, algorithm_id)

    # 对中文文件名进行 RFC 5987 编码 + ASCII 兼容 fallback
    encoded_filename = urllib.parse.quote(f"{algorithm.name}_v{algorithm.version}.zip")
    safe_filename = f"algorithm_{algorithm.uuid[:8]}_v{algorithm.version}.zip"

    # 尝试流式传输；失败则降级到一次性 BytesIO
    try:
        # 流式获取对象 chunk（公开 API，不再直访 _client）
        chunks = minio_client.iter_object(MinioClient.ALGORITHMS_BUCKET, algorithm.minio_path)

        async def file_streamer():
            try:
                for chunk in chunks:
                    yield chunk
            finally:
                chunks.close()  # 触发 generator finally → release_conn

        # 尝试获取文件大小以设置 Content-Length
        size = minio_client.stat_object_size(MinioClient.ALGORITHMS_BUCKET, algorithm.minio_path)
        if size is not None:
            headers = {
                "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=utf-8''{encoded_filename}",
                "Content-Length": str(size),
                "Content-Type": "application/zip",
            }
        else:
            # 无法 stat 时降级到无 Content-Length 的流式响应
            headers = {
                "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=utf-8''{encoded_filename}",
                "Content-Type": "application/zip",
            }

        return StreamingResponse(
            file_streamer(),
            media_type="application/zip",
            headers=headers,
        )

    except Exception as e:
        # 流式失败：降级到一次性读取（小文件兜底）
        logger.warning(f"流式下载失败，回退一次性读取: {e}")
        file_data = minio_client.get_object(MinioClient.ALGORITHMS_BUCKET, algorithm.minio_path)
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=utf-8''{encoded_filename}",
            },
        )


@router.post("/{algorithm_id}/predict")
@_standard_errors("在线推理")
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
    container_port = algorithm.container_port
    container_url = f"http://localhost:{container_port}/predict"
    logger.info(f"[在线推理] 算法ID: {algorithm_id}, 容器URL: {container_url}")

    # 发送请求到算法容器（精细区分连接错/超时错 → 不同 HTTP 状态码）
    import httpx
    files = {'file': (file.filename, image_data, file.content_type)}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(container_url, files=files)
    except httpx.ConnectError as e:
        logger.error(f"[在线推理] 无法连接容器 {container_url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"无法连接到算法服务，请检查算法是否正常运行。容器地址: {container_url}",
        )
    except (httpx.TimeoutException, httpx.ReadError) as e:
        logger.error(f"[在线推理] 容器响应超时/中断: {e}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="算法服务响应超时，可能正在处理中，请稍后重试。",
        )

    if response.status_code != 200:
        logger.error(f"算法容器返回错误: {response.status_code} - {response.text}")
        raise HTTPException(
            status_code=response.status_code,
            detail=f"算法推理失败: {response.text}",
        )

    return {
        "success": True,
        "algorithm_id": algorithm_id,
        "algorithm_name": algorithm.name,
        "result": response.json(),
    }






def _ndjson_line(d: dict) -> bytes:
    return (json.dumps(d, ensure_ascii=False) + "\n").encode("utf-8")


async def _submit_build_for(
    db: Session,
    algorithm_id: str,
    current_user: User,
) -> tuple[str, str]:
    """对指定算法提交构建任务，返回 (task_id, stream_url)。

    - 鉴权（必须为作者本人）
    - 把 DB 状态置为 building
    - 调用 deploy_service.submit_build；并发时抛 BuildInProgressError → 409
    - 上传流程和手动「提交构建」共用此函数（消除 P0.1 闭环断点）
    """
    algorithm = algorithm_service.get_algorithm_by_id(db, algorithm_id)
    if not algorithm:
        raise HTTPException(404, "算法不存在")
    if str(algorithm.author_id) != str(current_user.userid):
        raise HTTPException(403, "无权操作此算法")
    if not algorithm.minio_path:
        raise HTTPException(400, "算法包未上传")

    algorithm_service.update_algorithm(
        db, algorithm_id, status="building", build_log="提交构建..."
    )
    svc = get_deploy_service()
    try:
        task = await svc.submit_build(
            # algorithms.id 是 UUID 字符串；写成 int(algorithm_id) 会直接
            # ValueError（invalid literal for int()），构建在启动前就崩了。
            algorithm_id=str(algorithm_id),
            algorithm_uuid=algorithm.uuid,
            actor=str(current_user.userid),
        )
    except BuildInProgressError as e:
        raise HTTPException(409, str(e))

    return task.task_id, f"/api/algorithms/{algorithm_id}/build/stream?task_id={task.task_id}"


@router.post("/{algorithm_id}/build", status_code=202)
@_standard_errors("提交构建")
async def trigger_build(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db),
):
    """触发算法构建：异步提交，立即返回 task_id + stream_url。

    流式日志通过 GET /{id}/build/stream?task_id=X 订阅。
    """
    task_id, stream_url = await _submit_build_for(db, algorithm_id, current_user)
    return JSONResponse(
        status_code=202,
        content={"task_id": task_id, "stream_url": stream_url},
    )


@router.get("/{algorithm_id}/build/stream")
@_standard_errors("订阅构建日志")
async def stream_build(
    algorithm_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """NDJSON 流式订阅构建进度。

    每行一个 JSON：
    {"type": "log", "line": "..."} 或
    {"type": "status", "status": "running", "result": {...}, "error": null}
    """
    svc = get_deploy_service()
    task = svc.get_task(task_id)
    if not task:
        raise HTTPException(404, "任务不存在（可能后端已重启）")
    if str(task.algorithm_id) != str(algorithm_id):
        raise HTTPException(404, "任务与算法不匹配")

    async def gen():
        def frame() -> str:
            return _ndjson_line({
                "type": "status",
                "status": task.status,
                "result": task.result,
                "error": task.error,
            })

        emitted = task.status
        yield frame()
        q = task.subscribe()
        while True:
            line = await q.get()
            if line is None:
                yield frame()
                break
            # 阶段推进（queued → building → starting → 终态）时补发一帧状态，
            # 否则前端从订阅那一刻起就只能看到最初的 "排队中"
            if task.status != emitted:
                emitted = task.status
                yield frame()
            yield _ndjson_line({"type": "log", "line": line})

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.get("/{algorithm_id}/build")
@_standard_errors("查询构建状态")
async def get_build_status(
    algorithm_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """一次性查询构建终态（流订阅失败时前端用此回查）。"""
    svc = get_deploy_service()
    task = svc.get_task(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    if str(task.algorithm_id) != str(algorithm_id):
        raise HTTPException(404, "任务与算法不匹配")
    return {
        "task_id": task.task_id,
        "status": task.status,
        "result": task.result,
        "error": task.error,
        "log_lines": task.log_lines[-50:],
    }


@router.post("/{algorithm_id}/stop")
@_standard_errors("停止算法")
async def stop_algorithm(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """停止算法容器"""
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


@router.post("/{algorithm_id}/restart")
@_standard_errors("重启算法")
async def restart_algorithm(
    algorithm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_meta_db)
):
    """重启算法容器"""
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

    started = False
    if algorithm.docker_image:
        # 注意：端口由 ContainerManager 自管，不能再传 port= 旧参数（会 TypeError→500）
        success, container_id, actual_port, error = await container_manager.start_container(
            algorithm_uuid=algorithm.uuid,
            image_name=algorithm.docker_image,
        )
        if not success:
            algorithm_service.update_algorithm(db, algorithm_id, status='error')
            logger.error(f"重启容器失败: {error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"重启容器失败: {error}"
            )
        started = True
        # 端口可能被重新分配，写回 DB 保证算法广场 / 在线使用拿到的是当前端口
        algorithm_service.update_algorithm(
            db, algorithm_id, container_port=actual_port, docker_image=algorithm.docker_image
        )

    if not started:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="算法尚未构建镜像，请先提交构建"
        )

    # 更新状态
    algorithm_service.update_algorithm(db, algorithm_id, status='running')

    return {
        "message": "算法已重启",
        "algorithm_id": algorithm_id
    }


@router.get("/{algorithm_id}/status")
@_standard_errors("获取状态")
async def get_algorithm_status(
    algorithm_id: str,
    db: Session = Depends(get_meta_db)
):
    """获取算法运行状态"""
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
        except Exception:
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
