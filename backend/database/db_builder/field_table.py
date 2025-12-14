"""
地块表管理模块
提供创建和删除地块表的功能
使用方法：
1. 从backend目录运行：python -m database.db_builder.field_table create
2. 从backend目录运行：python -m database.db_builder.field_table drop
"""

import sys
from pathlib import Path
from database.main_db import engine, Base
from database.db_models.field_model import Field

# 尝试导入GeoAlchemy2，检查PostGIS是否可用
try:
    from geoalchemy2 import Geometry
    HAS_POSTGIS = True
except ImportError:
    HAS_POSTGIS = False

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


def create_field_table():
    """
    创建地块表
    """
    print("正在创建地块表...")
    
    # 首先测试数据库连接
    if not test_db_connection():
        print("无法连接到数据库，请检查配置。")
        return False
    
    # 创建表
    try:
        Field.__table__.create(engine, checkfirst=True)
        print("地块表创建成功！")
        
        # 尝试创建空间索引（如果有PostGIS）
        if HAS_POSTGIS:
            try:
                with engine.connect() as conn:
                    from sqlalchemy import text
                    # 创建空间索引
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_field_location_geom ON field USING GIST (location_geom)"))
                    conn.commit()
                    print("空间索引创建成功！")
            except Exception as e:
                print(f"创建空间索引时出错: {e}")
                print("空间索引可能需要手动创建")
        else:
            print("PostGIS不可用，跳过空间索引创建")
        
        # 创建其他索引
        try:
            with engine.connect() as conn:
                from sqlalchemy import text
                # 创建作物类型索引
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_field_crop_type ON field (crop_type)"))
                conn.commit()
                print("作物类型索引创建成功！")
        except Exception as e:
            print(f"创建作物类型索引时出错: {e}")
        
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
                Field.__table__.create(engine, checkfirst=True)
                print(f"在用户{current_user}的schema中创建地块表成功！")
                
                # 尝试创建空间索引（如果有PostGIS）
                if HAS_POSTGIS:
                    try:
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_field_location_geom ON field USING GIST (location_geom)"))
                        conn.commit()
                        print("空间索引创建成功！")
                    except Exception as e2:
                        print(f"创建空间索引时出错: {e2}")
                else:
                    print("PostGIS不可用，跳过空间索引创建")
                
                # 创建其他索引
                try:
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_field_crop_type ON field (crop_type)"))
                    conn.commit()
                    print("作物类型索引创建成功！")
                except Exception as e3:
                    print(f"创建作物类型索引时出错: {e3}")
                
                return True
        except Exception as e2:
            print(f"在用户schema中创建表也失败: {e2}")
            return False


def drop_field_table():
    """
    删除地块表
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认删除地块表？这将删除所有数据(y/n): ")
    if confirm.lower() == 'y':
        print("正在删除地块表...")
        Field.__table__.drop(engine, checkfirst=True)
        print("地块表删除成功！")
    else:
        print("操作已取消")


def reset_field_table():
    """
    重置地块表（先删除再创建）
    注意：此操作将删除表中的所有数据，请谨慎使用！
    """
    confirm = input("确认重置地块表？这将删除所有数据并重新创建表(y/n): ")
    if confirm.lower() == 'y':
        print("正在重置地块表...")
        Field.__table__.drop(engine, checkfirst=True)
        create_field_table()
        print("地块表重置成功！")
    else:
        print("操作已取消")


def check_postgis_status():
    """
    检查PostGIS状态
    """
    try:
        with engine.connect() as conn:
            from sqlalchemy import text
            result = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'postgis'")).fetchone()
            if result:
                print("PostGIS扩展已安装")
                return True
            else:
                print("PostGIS扩展未安装")
                return False
    except Exception as e:
        print(f"检查PostGIS状态时出错: {e}")
        return False


def install_postgis():
    """
    提供PostGIS安装指导
    """
    print("\n=== PostGIS安装指导 ===")
    print("PostGIS是PostgreSQL的空间数据库扩展，用于处理地理空间数据。")
    print("\n在Ubuntu/Debian系统上安装PostGIS:")
    print("sudo apt-get update")
    print("sudo apt-get install postgis postgresql-16-postgis-3")
    print("\n在CentOS/RHEL系统上安装PostGIS:")
    print("sudo yum install postgis30_16")
    print("\n安装后，在PostgreSQL中启用扩展:")
    print("CREATE EXTENSION IF NOT EXISTS postgis;")
    print("\n完成后，重新运行此脚本创建支持空间数据的地块表。")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == "create":
            create_field_table()
        elif command == "drop":
            drop_field_table()
        elif command == "reset":
            reset_field_table()
        elif command == "check":
            check_postgis_status()
        elif command == "install":
            install_postgis()
        else:
            print("用法: python -m database.db_builder.field_table [create|drop|reset|check|install]")
    else:
        print("用法: python -m database.db_builder.field_table [create|drop|reset|check|install]")
        print("检查PostGIS状态: python -m database.db_builder.field_table check")
        print("获取PostGIS安装指导: python -m database.db_builder.field_table install")