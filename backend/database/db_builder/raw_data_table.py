"""
原始数据表管理模块
提供创建和删除原始数据表的功能
使用方法：
1. 从backend目录运行：python -m database.db_builder.raw_data_table create
2. 从backend目录运行：python -m database.db_builder.raw_data_table drop
"""

import sys
from pathlib import Path
from database.main_db import engine, Base
from database.db_models.raw_data_model import RawData, RawDataTag


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


def create_raw_data_tables():
    """
    创建原始数据相关表
    """
    print("正在创建原始数据表...")
    
    # 首先测试数据库连接
    if not test_db_connection():
        print("无法连接到数据库，请检查配置。")
        return False
    
    # 创建表
    try:
        RawData.__table__.create(bind=engine, checkfirst=True)
        print("原始数据表创建成功！")
        
        RawDataTag.__table__.create(bind=engine, checkfirst=True)
        print("原始数据标签表创建成功！")
        
        # 创建索引
        print("正在创建索引...")
        create_indexes()
        print("索引创建完成！")
        
        return True
    except Exception as e:
        print(f"创建原始数据表失败: {e}")
        return False


def drop_raw_data_tables():
    """
    删除原始数据相关表
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认删除原始数据相关表？这将删除所有数据(y/n): ")
    if confirm.lower() == 'y':
        print("正在删除原始数据表...")
        try:
            RawDataTag.__table__.drop(bind=engine)
            RawData.__table__.drop(bind=engine)
            print("原始数据表删除成功！")
            return True
        except Exception as e:
            print(f"删除原始数据表失败: {e}")
            return False
    else:
        print("操作已取消")
        return False


def reset_raw_data_tables():
    """
    重置原始数据相关表（先删除再创建）
    注意：此操作将删除所有数据，请谨慎使用！
    """
    confirm = input("确认重置原始数据相关表？这将删除所有数据并重新创建表(y/n): ")
    if confirm.lower() == 'y':
        print("正在重置原始数据表...")
        try:
            RawDataTag.__table__.drop(bind=engine, checkfirst=True)
            RawData.__table__.drop(bind=engine, checkfirst=True)
            
            RawData.__table__.create(bind=engine)
            RawDataTag.__table__.create(bind=engine)
            
            print("正在创建索引...")
            create_indexes()
            print("索引创建完成！")
            print("原始数据表重置成功！")
            return True
        except Exception as e:
            print(f"重置原始数据表失败: {e}")
            return False
    else:
        print("操作已取消")
        return False


def create_indexes():
    """
    创建原始数据表的索引
    """
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # 原始数据表索引
        # 1. 用户ID和采集时间复合索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_user_time 
            ON raw_data (user_id, capture_time DESC)
        """))
        
        # 2. 会话ID索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_session_id 
            ON raw_data (session_id)
        """))
        
        # 3. 设备ID索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_device_id 
            ON raw_data (device_id)
        """))
        
        # 4. 农田ID索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_field_id 
            ON raw_data (field_id)
        """))
        
        # 5. 数据类型索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_type 
            ON raw_data (data_type)
        """))
        
        # 6. 数据子类型索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_subtype 
            ON raw_data (data_subtype)
        """))
        
        # 7. 处理状态索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_processing_status 
            ON raw_data (processing_status)
        """))
        
        # 8. AI状态索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_ai_status 
            ON raw_data (ai_status)
        """))
        
        # 9. 唯一约束 - 会话、bucket和对象键组合
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_raw_data_object 
            ON raw_data (session_id, bucket_name, object_key) 
            WHERE bucket_name IS NOT NULL AND object_key IS NOT NULL
        """))
        
        # 原始数据标签表索引
        # 10. 标签数据ID和用户ID复合索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_tag_data_user 
            ON raw_data_tags (raw_data_id, user_id)
        """))
        
        # 11. 标签类别和值复合索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_raw_data_tag_category_value 
            ON raw_data_tags (tag_category, tag_value)
        """))
        
        conn.commit()


def show_table_structure():
    """
    显示原始数据表结构
    """
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    
    # 原始数据表结构
    columns = inspector.get_columns('raw_data')
    print("原始数据表结构:")
    print("=" * 80)
    for column in columns:
        print(f"{column['name']:<25} {str(column['type']):<30} {'NOT NULL' if not column['nullable'] else 'NULL':<10}")
    print("=" * 80)
    
    # 原始数据标签表结构
    columns = inspector.get_columns('raw_data_tags')
    print("\n原始数据标签表结构:")
    print("=" * 80)
    for column in columns:
        print(f"{column['name']:<25} {str(column['type']):<30} {'NOT NULL' if not column['nullable'] else 'NULL':<10}")
    print("=" * 80)


def show_indexes():
    """
    显示原始数据表的索引
    """
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # 原始数据表索引
        result = conn.execute(text("""
            SELECT indexname AS index_name, indexdef AS index_definition
            FROM pg_indexes
            WHERE tablename = 'raw_data'
            ORDER BY indexname
        """))
        
        indexes = result.fetchall()
        
        print("原始数据表索引:")
        print("=" * 80)
        for index in indexes:
            # 索引返回的是一个元组，第一个元素是索引名称，第二个是定义
            print(f"{index[0]}: {index[1]}")
        print("=" * 80)
        
        # 原始数据标签表索引
        result = conn.execute(text("""
            SELECT indexname AS index_name, indexdef AS index_definition
            FROM pg_indexes
            WHERE tablename = 'raw_data_tags'
            ORDER BY indexname
        """))
        
        indexes = result.fetchall()
        
        print("\n原始数据标签表索引:")
        print("=" * 80)
        for index in indexes:
            print(f"{index[0]}: {index[1]}")
        print("=" * 80)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "create":
            create_raw_data_tables()
        elif command == "drop":
            drop_raw_data_tables()
        elif command == "reset":
            reset_raw_data_tables()
        elif command == "structure":
            show_table_structure()
        elif command == "indexes":
            show_indexes()
        else:
            print("用法: python -m database.db_builder.raw_data_table [create|drop|reset|structure|indexes]")
    else:
        print("用法: python -m database.db_builder.raw_data_table [create|drop|reset|structure|indexes]")