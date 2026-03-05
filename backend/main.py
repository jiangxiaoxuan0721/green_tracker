from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
project_root = Path(__file__).parent.parent
load_dotenv(os.path.join(project_root, '.env'))

logger = logging.getLogger(__name__)

# 创建FastAPI应用实例
app = FastAPI(
    title="Green Tracker API",
    description="环境监测系统后端API",
    version="1.0.0"
)

# 配置CORS - 从环境变量读取
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3010,http://127.0.0.1:3010").split(',')
cors_methods = os.getenv("CORS_METHODS", "GET,POST,PUT,DELETE,OPTIONS").split(',')
cors_headers = os.getenv("CORS_HEADERS", "Content-Type,Authorization").split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=cors_methods,
    allow_headers=cors_headers,
)

# 启动时初始化数据库
@app.on_event("startup")
async def startup_event():
    """启动时初始化数据库"""
    try:
        from database.database_initializer import DatabaseInitializer
        logger.info("Initializing meta database...")
        DatabaseInitializer.init_meta_database()
        logger.info("Meta database initialized successfully")

        logger.info("Initializing template database...")
        DatabaseInitializer.init_template_database()
        logger.info("Template database initialized successfully")

        logger.info("Database initialization completed")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        # 不抛出异常，让服务继续启动
        logger.warning("Continuing with application startup...")

# 添加请求日志中间件
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"[后端Main] 收到请求: {request.method} {request.url}")
    # 注意: 不要在这里记录敏感的请求数据，如密码

    response = await call_next(request)

    print(f"[后端Main] 响应状态码: {response.status_code}")
    return response

# 全局异常处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求验证异常，返回详细的错误信息"""
    print(f"[后端Main] 请求验证失败: {exc.errors()}")
    
    error_details = []
    for error in exc.errors():
        error_details.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input", None)
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "code": 422,
            "message": "请求验证失败",
            "details": error_details,
            "error_count": len(error_details)
        }
    )

from api import (
    auth_router,
    collection_session_router,
    device_router,
    feedback_router,
    field_router,
    raw_data_router,
    api_key_router,
    admin_database_router,
    file_upload_router
)

# 注册认证路由
app.include_router(auth_router, prefix="/api") # /api/auth

# 注册反馈路由
app.include_router(feedback_router, prefix="/api") # /api/feedback

# 注册地块路由
app.include_router(field_router, prefix="/api") # /api/fields

# 注册设备路由
app.include_router(device_router, prefix="/api") # /api/devices

# 注册采集任务路由
app.include_router(collection_session_router, prefix="/api") # /api/collection-sessions

# 注册原始数据路由
app.include_router(raw_data_router, prefix="/api") # /api/raw-data

# 注册API密钥路由
app.include_router(api_key_router, prefix="/api") # /api/api-keys

# 注册数据库管理路由（管理员专用）
app.include_router(admin_database_router, prefix="/api") # /api/admin/database

# 注册文件上传路由
app.include_router(file_upload_router, prefix="/api") # /api/file-upload

# 健康检查端点
@app.get("/health") # /health
async def health_check():
    return {"status": "healthy", "message": "Green Tracker API is running"}

# 根路径
@app.get("/") # /
async def root():
    return {"message": "Welcome to Green Tracker API"}

# 运行配置
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "6130"))  # 默认使用6130端口，与前端配置一致
    host = os.getenv("API_HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)