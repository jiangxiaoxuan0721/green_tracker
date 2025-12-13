#!/usr/bin/env python3
"""
初始化数据库脚本 - 创建所有表
"""
from database.main_db import engine, Base
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """初始化数据库，创建所有表"""
    try:
        # 创建所有表
        Base.metadata.create_all(bind=engine)
        logger.info("数据库表创建成功")
    except Exception as e:
        logger.error(f"创建数据库表时出错: {e}")
        raise

if __name__ == "__main__":
    init_database()