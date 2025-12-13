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

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境中应该设置为具体的前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 导入并包含路由模块
# 注意：以下路由将在创建后取消注释
# from api.routes import auth, devices, environmental_data, alerts, reports
# app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
# app.include_router(devices.router, prefix="/api/devices", tags=["设备管理"])
# app.include_router(environmental_data.router, prefix="/api/data", tags=["环境数据"])
# app.include_router(alerts.router, prefix="/api/alerts", tags=["告警管理"])
# app.include_router(reports.router, prefix="/api/reports", tags=["报告生成"])

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