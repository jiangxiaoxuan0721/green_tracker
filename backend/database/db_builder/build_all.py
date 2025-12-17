"""
数据库表统一构建模块
提供创建和删除所有表的功能
使用方法：
1. 从backend目录运行：python -m database.db_builder.build_all create
2. 从backend目录运行：python -m database.db_builder.build_all drop
"""

import sys
from database.main_db import engine, Base
# 确保导入所有模型，以便创建表
from database.db_models import Field, Device, User, Feedback, CollectionSession


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


def create_all_tables():
    """
    创建所有表
    """
    print("正在创建所有数据库表...")
    
    # 首先测试数据库连接
    if not test_db_connection():
        print("无法连接到数据库，请检查配置。")
        return False
    
    try:
        # 导入所有模型后创建表
        Base.metadata.create_all(bind=engine, checkfirst=True)
        print("所有表创建成功！")
        return True
    except Exception as e:
        print(f"创建表失败: {e}")
        return False


def drop_all_tables():
    """
    删除所有表
    注意：此操作将删除所有表中的所有数据，请谨慎使用！
    """
    confirm = input("确认删除所有表？这将删除所有数据(y/n): ")
    if confirm.lower() == 'y':
        print("正在删除所有表...")
        Base.metadata.drop_all(bind=engine)
        print("所有表删除成功！")
    else:
        print("操作已取消")


def reset_all_tables():
    """
    重置所有表（先删除再创建）
    注意：此操作将删除所有数据，请谨慎使用！
    """
    confirm = input("确认重置所有表？这将删除所有数据并重新创建表(y/n): ")
    if confirm.lower() == 'y':
        print("正在重置所有表...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("所有表重置成功！")
    else:
        print("操作已取消")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "create":
            create_all_tables()
        elif command == "drop":
            drop_all_tables()
        elif command == "reset":
            reset_all_tables()
        else:
            print("用法: python -m database.db_builder.build_all [create|drop|reset]")
    else:
        print("用法: python -m database.db_builder.build_all [create|drop|reset]")