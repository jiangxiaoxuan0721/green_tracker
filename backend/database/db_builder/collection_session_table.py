"""
采集任务/观测会话表管理模块
提供创建和删除采集任务表的功能
使用方法：
1. 从backend目录运行：python -m database.db_builder.collection_session_table create
2. 从backend目录运行：python -m database.db_builder.collection_session_table drop
"""

import sys
from pathlib import Path
from database.main_db import engine, Base
from database.db_models.collection_session_model import CollectionSession


def test_db_connection():
    """
    测试数据库连接
    """
    try:
        with engine.connect() as conn:
            print("数据库连接成功！")
            # 尝试获取数据库版本信息
            from sqlalchemy import text
            version = conn.execute(text("SELECT version()")).fetchone()
            if version:
                print(f"数据库版本: {version[0]}")
            return True
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return False


def create_collection_session_table():
    """
    创建采集任务表
    """
    print("正在创建采集任务表...")
    
    # 首先测试数据库连接
    if not test_db_connection():
        print("无法连接到数据库，请检查配置。")
        return False
    
    # 创建表
    try:
        CollectionSession.__table__.create(bind=engine, checkfirst=True)
        print("采集任务表创建成功！")
        
        # 创建索引
        print("正在创建索引...")
        create_indexes()
        print("索引创建完成！")
        
        return True
    except Exception as e:
        print(f"创建采集任务表失败: {e}")
        return False


def drop_collection_session_table():
    """
    删除采集任务表
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认删除采集任务表？这将删除所有数据(y/n): ")
    if confirm.lower() == 'y':
        print("正在删除采集任务表...")
        try:
            CollectionSession.__table__.drop(bind=engine)
            print("采集任务表删除成功！")
            return True
        except Exception as e:
            print(f"删除采集任务表失败: {e}")
            return False
    else:
        print("操作已取消")
        return False


def reset_collection_session_table():
    """
    重置采集任务表（先删除再创建）
    注意：此操作将删除所有数据，请谨慎使用！
    """
    confirm = input("确认重置采集任务表？这将删除所有数据并重新创建表(y/n): ")
    if confirm.lower() == 'y':
        print("正在重置采集任务表...")
        try:
            CollectionSession.__table__.drop(bind=engine)
            CollectionSession.__table__.create(bind=engine)
            print("正在创建索引...")
            create_indexes()
            print("索引创建完成！")
            print("采集任务表重置成功！")
            return True
        except Exception as e:
            print(f"重置采集任务表失败: {e}")
            return False
    else:
        print("操作已取消")
        return False


def create_indexes():
    """
    创建采集任务表的索引
    """
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # 1. 按地块查询任务
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_field_id 
            ON collection_session (field_id)
        """))
        
        # 2. 按时间范围查询
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_time_range 
            ON collection_session (start_time, end_time)
        """))
        
        # 3. 按任务类型查询
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_mission_type 
            ON collection_session (mission_type)
        """))
        
        # 4. 按创建者查询
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_creator_id 
            ON collection_session (creator_id)
        """))
        
        # 5. 按状态查询
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_session_status 
            ON collection_session (status)
        """))
        
        conn.commit()


def show_table_structure():
    """
    显示采集任务表结构
    """
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    columns = inspector.get_columns('collection_session')
    
    print("采集任务表结构:")
    print("=" * 80)
    for column in columns:
        print(f"{column['name']:<20} {str(column['type']):<30} {'NOT NULL' if not column['nullable'] else 'NULL':<10}")
    print("=" * 80)


def show_indexes():
    """
    显示采集任务表的索引
    """
    from sqlalchemy import text
    
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT indexname AS index_name, indexdef AS index_definition
            FROM pg_indexes
            WHERE tablename = 'collection_session'
            ORDER BY indexname
        """))
        
        indexes = result.fetchall()
        
        print("采集任务表索引:")
        print("=" * 80)
        for index in indexes:
            # 索引返回的是一个元组，第一个元素是索引名称，第二个是定义
            print(f"{index[0]}: {index[1]}")
        print("=" * 80)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "create":
            create_collection_session_table()
        elif command == "drop":
            drop_collection_session_table()
        elif command == "reset":
            reset_collection_session_table()
        elif command == "structure":
            show_table_structure()
        elif command == "indexes":
            show_indexes()
        else:
            print("用法: python -m database.db_builder.collection_session_table [create|drop|reset|structure|indexes]")
    else:
        print("用法: python -m database.db_builder.collection_session_table [create|drop|reset|structure|indexes]")