"""
用户表管理模块
提供创建和删除用户表的功能
使用方法：
1. 从backend目录运行：python -m database.db_builder.user_table create
2. 从backend目录运行：python -m database.db_builder.user_table drop
"""

import sys
from database.main_db import engine, Base
from database.db_models.user_model import User


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


def create_user_table():
    """
    创建用户表
    """
    print("正在创建用户表...")
    
    # 首先测试数据库连接
    if not test_db_connection():
        print("无法连接到数据库，请检查配置。")
        return False
    
    try:
        # 首先尝试创建在public schema
        User.__table__.create(engine, checkfirst=True)
        print("用户表创建成功！")
        return True
    except Exception as e:
        print(f"在public schema创建表失败: {e}")
        print("尝试在用户schema中创建表...")
        
        try:
            # 尝试在用户自己的schema中创建表
            from sqlalchemy import text
            with engine.connect() as conn:
                # 获取当前用户名
                result = conn.execute(text("SELECT current_user")).fetchone()
                if not result:
                    print("无法获取当前用户名，请检查配置。")
                    return False
                current_user = result[0]
                print(f"当前用户: {current_user}")
                
                # 为用户创建schema（如果不存在）
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {current_user}"))
                conn.commit()
                
                # 设置搜索路径以包含用户的schema
                conn.execute(text(f"SET search_path TO {current_user}, public"))
                conn.commit()
                
                # 在用户schema中创建表
                User.__table__.create(engine, checkfirst=True)
                print(f"在用户{current_user}的schema中创建用户表成功！")
                return True
        except Exception as e2:
            print(f"在用户schema中创建表也失败: {e2}")
            return False


def drop_user_table():
    """
    删除用户表
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认删除用户表？这将删除所有数据(y/n): ")
    if confirm.lower() == 'y':
        print("正在删除用户表...")
        User.__table__.drop(engine, checkfirst=True)
        print("用户表删除成功！")
    else:
        print("操作已取消")


def reset_user_table():
    """
    重置用户表（先删除再创建）
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认重置用户表？这将删除所有数据并重新创建表(y/n): ")
    if confirm.lower() == 'y':
        print("正在重置用户表...")
        User.__table__.drop(engine, checkfirst=True)
        User.__table__.create(engine, checkfirst=True)
        print("用户表重置成功！")
    else:
        print("操作已取消")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "create":
            create_user_table()
        elif command == "drop":
            drop_user_table()
        elif command == "reset":
            reset_user_table()
        else:
            print("用法: python -m database.db_builder.user_table [create|drop|reset]")
    else:
        print("用法: python -m database.db_builder.user_table [create|drop|reset]")