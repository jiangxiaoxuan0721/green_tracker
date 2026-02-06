"""
通过 Python 执行 SQL 修复脚本
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
backend_root = project_root / "backend"
sys.path.insert(0, str(backend_root))

from dotenv import load_dotenv
import psycopg2
from sqlalchemy import create_engine, text

# 加载环境变量
load_dotenv(os.path.join(project_root, '.env'))

# 数据库配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "green_tracker")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

user_id = "aad9242c-7b47-4cca-970c-57339abe1fe8"
db_name = f"green_tracker_user_{user_id}"

print(f"Connecting to database {db_name}...")

# 连接数据库
conn = psycopg2.connect(
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}"
)
conn.autocommit = True
cursor = conn.cursor()

# 读取 SQL 文件
sql_file = os.path.join(project_root, 'scripts', 'fix_raw_data_tables.sql')
with open(sql_file, 'r') as f:
    sql_content = f.read()

# 执行 SQL
print("Executing SQL script...")
cursor.execute(sql_content)

print("Tables created successfully!")

cursor.close()
conn.close()
print(f"Database {db_name} fixed successfully!")
