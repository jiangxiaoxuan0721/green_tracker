"""
迁移脚本：为用户数据库的 collection_sessions 表添加 device_id 列
"""

import os
from dotenv import load_dotenv
from pathlib import Path
import psycopg2

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_USER = os.getenv('DB_USER', 'green_tracker')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')


def migrate_user_databases():
    """
    为所有用户数据库的 collection_sessions 表添加 device_id 列
    """
    # 连接到元数据库获取用户列表
    conn = psycopg2.connect(
        f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_USER}'
    )
    conn.autocommit = True
    with conn.cursor() as cursor:
        # 获取所有用户数据库
        cursor.execute("""
            SELECT database_name FROM user_databases 
            WHERE database_name LIKE 'green_tracker_user_%'
        """)
        user_dbs = [row[0] for row in cursor.fetchall()]
        print(f'Found {len(user_dbs)} user databases')

    conn.close()

    # 为每个用户数据库添加缺失的列
    for db_name in user_dbs:
        print(f'\nChecking {db_name}...')
        conn = psycopg2.connect(
            f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}'
        )
        conn.autocommit = True
        with conn.cursor() as cursor:
            # 检查 collection_sessions 表是否有 device_id 列
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'collection_sessions' AND column_name = 'device_id'
            """)
            if not cursor.fetchone():
                print(f'  Adding device_id column to {db_name}...')
                cursor.execute('ALTER TABLE collection_sessions ADD COLUMN device_id VARCHAR(36)')
                print(f'  Done!')
            else:
                print(f'  device_id column already exists in {db_name}')
        conn.close()

    print('\nMigration completed!')


if __name__ == '__main__':
    migrate_user_databases()
