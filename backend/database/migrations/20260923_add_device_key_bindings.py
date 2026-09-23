"""
[一次性修复] 为存量用户库与模板库补齐 device_key_bindings 表

背景：
    用户库由模板库克隆而来（CREATE DATABASE ... TEMPLATE ...），
    device_key_bindings 是后加的模型，若模板库未包含它，
    所有已存在的用户库都会缺表，导致设备上报密钥时写入失败
    （异常被吞，接口仍返回 200，表现为「设备尚未上报所使用的API密钥」）。

现状：
    device_key_bindings 已并入启动期自动迁移
    （`DatabaseInitializer.migrate_user_databases()`）与新建库校验
    （`create_user_database.py`），本脚本退化为「一次性历史修复」：
    仅在不想重启服务、需要立即补齐线上库时使用。

用法：
    cd backend && python database/migrations/20260923_add_device_key_bindings.py

命名约定：
    迁移脚本统一 `YYYYMMDD_描述.py` 前缀，保证多迁移时的执行顺序。
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

# 本文件位于 backend/database/migrations/，向上四级才是项目根（.env 所在）
project_root = Path(__file__).parent.parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

# 直接 `python database/migrations/xxx.py` 执行时 sys.path[0] 是 migrations 目录，
# 这里把 backend 目录补进去，保证 database 包可导入
sys.path.insert(0, str(project_root / 'backend'))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "green_tracker")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
TEMPLATE_DB_NAME = os.getenv("TEMPLATE_DB_NAME", "green_tracker_template")


def _ensure_table(db_name: str, host: str, port: str) -> str:
    """建表（已存在则跳过），返回 created / exists / error"""
    url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{host}:{port}/{db_name}"
    engine = create_engine(url)
    try:
        existing = inspect(engine).get_table_names()
        if 'device_key_bindings' in existing:
            return 'exists'
        from database.db_models.user_models import DeviceKeyBinding
        DeviceKeyBinding.__table__.create(bind=engine, checkfirst=True)
        return 'created'
    except Exception as e:
        return f'error: {e}'
    finally:
        engine.dispose()


def main() -> None:
    # 1) 模板库：保证后续新建的用户库自带该表
    print(f"[模板库] {TEMPLATE_DB_NAME}: {_ensure_table(TEMPLATE_DB_NAME, DB_HOST, DB_PORT)}")

    # 2) 存量用户库
    from database.main_db import SessionLocal
    from database.db_models.meta_model import UserDatabase

    with SessionLocal() as meta_db:
        records = meta_db.query(UserDatabase).filter(
            UserDatabase.is_active == True
        ).all()
        targets = [
            (r.database_name, r.database_host or DB_HOST, r.database_port or DB_PORT)
            for r in records
        ]

    for name, host, port in targets:
        print(f"[用户库] {name}: {_ensure_table(name, host, port)}")

    print(f"处理完成，共 {len(targets)} 个用户库")


if __name__ == "__main__":
    main()
