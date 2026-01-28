"""检查用户数据库表结构"""
import os
from dotenv import load_dotenv
from pathlib import Path
import psycopg2

project_root = Path(__file__).parent.parent
load_dotenv(os.path.join(project_root, '.env'))

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_USER = os.getenv('DB_USER', 'green_tracker')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

# 检查用户数据库的表结构
db_name = 'green_tracker_user_aad9242c-7b47-4cca-970c-57339abe1fe8'
conn = psycopg2.connect(f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}')
with conn.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'collection_sessions'
        ORDER BY ordinal_position
    """)
    print('Columns in collection_sessions table:')
    for row in cursor.fetchall():
        print(f'  {row[0]}: {row[1]} (nullable: {row[2]})')
conn.close()
