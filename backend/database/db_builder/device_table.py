"""
设备表管理模块
提供创建和删除设备表的功能
使用方法：
1. 从backend目录运行：python -m database.db_builder.device_table create
2. 从backend目录运行：python -m database.db_builder.device_table drop
"""

import sys
from database.main_db import engine, Base
from database.db_models.device_model import Device


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


def create_device_table():
    """
    创建设备表
    """
    print("正在创建设备表...")
    
    # 首先测试数据库连接
    if not test_db_connection():
        print("无法连接到数据库，请检查配置。")
        return False
    
    try:
        # 创建设备表
        Device.__table__.create(engine, checkfirst=True)
        print("设备表创建成功！")
        
        # 创建必要的索引
        from sqlalchemy import text
        with engine.connect() as conn:
            # 设备类型索引
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_device_type ON device (device_type)"))
            # 平台层级索引
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_device_platform_level ON device (platform_level)"))
            # 所有者ID索引
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_device_owner_id ON device (owner_id)"))
            conn.commit()
            print("设备表索引创建成功！")
        
        return True
    except Exception as e:
        print(f"创建设备表失败: {e}")
        return False


def drop_device_table():
    """
    删除设备表
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认删除设备表？这将删除所有数据(y/n): ")
    if confirm.lower() == 'y':
        print("正在删除设备表...")
        Device.__table__.drop(engine, checkfirst=True)
        print("设备表删除成功！")
    else:
        print("操作已取消")


def reset_device_table():
    """
    重置设备表（先删除再创建）
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认重置设备表？这将删除所有数据并重新创建表(y/n): ")
    if confirm.lower() == 'y':
        print("正在重置设备表...")
        Device.__table__.drop(engine, checkfirst=True)
        Device.__table__.create(engine, checkfirst=True)
        
        # 创建索引
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_device_type ON device (device_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_device_platform_level ON device (platform_level)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_device_owner_id ON device (owner_id)"))
            conn.commit()
            print("设备表索引创建成功！")
            
        print("设备表重置成功！")
    else:
        print("操作已取消")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "create":
            create_device_table()
        elif command == "drop":
            drop_device_table()
        elif command == "reset":
            reset_device_table()
        else:
            print("用法: python -m database.db_builder.device_table [create|drop|reset]")
    else:
        print("用法: python -m database.db_builder.device_table [create|drop|reset]")