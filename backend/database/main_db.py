from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量 - 从项目根目录加载.env文件
# 获取项目根目录路径
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

# 数据库连接配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "green_tracker")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# 元数据库名称（green_tracker_meta 用于存储用户、数据库等元数据）
META_DB_NAME = os.getenv("META_DB_NAME", "green_tracker_meta")

# 是否使用Unix Socket连接（Peer认证，不需要密码）
# 默认使用 false，因为我们的系统使用 TCP 连接
USE_UNIX_SOCKET = os.getenv("USE_UNIX_SOCKET", "false").lower() == "true"

# 创建数据库连接URL
if USE_UNIX_SOCKET:
    # 使用 Unix Socket 连接（Peer认证，不需要密码）
    DATABASE_URL = f"postgresql://{DB_USER}@/{META_DB_NAME}"
else:
    # 使用 TCP 连接（推荐）
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{META_DB_NAME}"

# 连接池配置
pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))

# 创建数据库引擎，设置连接参数
engine = create_engine(
    DATABASE_URL,
    pool_size=pool_size,
    max_overflow=max_overflow
)

# 创建SessionLocal类，用于创建数据库会话（元数据库）
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建Base类，所有数据库模型都将继承自这个类
Base = declarative_base()

# 创建UserBase类，用于用户数据库模型
UserBase = declarative_base()

# 获取元数据库会话的依赖注入函数
def get_meta_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
