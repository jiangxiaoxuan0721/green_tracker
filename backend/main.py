from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

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

# 添加请求日志中间件
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"[后端Main] 收到请求: {request.method} {request.url}")
    # 注意: 不要在这里记录敏感的请求数据，如密码
    
    response = await call_next(request)
    
    print(f"[后端Main] 响应状态码: {response.status_code}")
    return response

# 导入并包含路由模块
from api.routes import auth_router, feedback_router, field_router
from api.routes.device import router as device_router

# 注册认证路由
app.include_router(auth_router) # /api/auth

# 注册反馈路由
app.include_router(feedback_router) # /api/feedback

# 注册地块路由
app.include_router(field_router) # /api/fields

# 注册设备路由
app.include_router(device_router) # /api/devices

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