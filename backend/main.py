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
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(',')
cors_methods = os.getenv("CORS_METHODS", "GET,POST,PUT,DELETE,OPTIONS").split(',')
cors_headers = os.getenv("CORS_HEADERS", "Content-Type,Authorization").split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=cors_methods,
    allow_headers=cors_headers,
)

# 导入并包含路由模块
from api.routes import auth_router

# 注册认证路由
app.include_router(auth_router) # /api/auth

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
    port = int(os.getenv("API_PORT", "3001"))  # 默认使用3001端口，与前端配置一致
    host = os.getenv("API_HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)