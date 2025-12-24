"""
管理用户特定表的命令行工具
用于初始化、管理和维护用户特定的raw_data表
"""

import sys
import argparse
from database.main_db import engine, SessionLocal
from database.db_services.user_service import get_user_by_id, get_user_by_username
from database.db_services.user_raw_data_service import (
    init_user_raw_data_tables, 
    remove_user_raw_data_tables
)


def init_user_tables(userid: str = None, username: str = None):
    """
    为用户初始化表
    
    Args:
        userid: 用户ID
        username: 用户名
    """
    db = SessionLocal()
    try:
        # 查找用户
        user = None
        if userid:
            user = get_user_by_id(db, userid)
        elif username:
            user = get_user_by_username(db, username)
        else:
            print("请提供用户ID或用户名")
            return False
        
        if not user:
            print("用户不存在")
            return False
        
        # 初始化表
        print(f"正在为用户 {user.username} (ID: {user.userid}) 初始化表...")
        if init_user_raw_data_tables(user.userid):
            print("表初始化成功")
            return True
        else:
            print("表初始化失败")
            return False
    finally:
        db.close()


def delete_user_tables(userid: str = None, username: str = None):
    """
    删除用户的表
    
    Args:
        userid: 用户ID
        username: 用户名
    """
    db = SessionLocal()
    try:
        # 查找用户
        user = None
        if userid:
            user = get_user_by_id(db, userid)
        elif username:
            user = get_user_by_username(db, username)
        else:
            print("请提供用户ID或用户名")
            return False
        
        if not user:
            print("用户不存在")
            return False
        
        # 确认删除
        confirm = input(f"确认删除用户 {user.username} (ID: {user.userid}) 的所有表？这将删除所有原始数据(y/n): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return False
        
        # 删除表
        print(f"正在删除用户 {user.username} (ID: {user.userid}) 的表...")
        if remove_user_raw_data_tables(user.userid):
            print("表删除成功")
            return True
        else:
            print("表删除失败")
            return False
    finally:
        db.close()


def list_all_users():
    """
    列出所有用户
    """
    db = SessionLocal()
    try:
        from database.db_models.user_model import User
        users = db.query(User).all()
        
        print("所有用户:")
        for user in users:
            print(f"  ID: {user.userid}, 用户名: {user.username}, 邮箱: {user.email}")
    finally:
        db.close()


def list_user_tables(userid: str = None, username: str = None):
    """
    列出用户的表
    
    Args:
        userid: 用户ID
        username: 用户名
    """
    db = SessionLocal()
    try:
        # 查找用户
        user = None
        if userid:
            user = get_user_by_id(db, userid)
        elif username:
            user = get_user_by_username(db, username)
        else:
            print("请提供用户ID或用户名")
            return
        
        if not user:
            print("用户不存在")
            return
        
        # 查询表
        from database.db_builder.user_raw_data_table import get_user_table_name
        
        raw_data_table = get_user_table_name(user.userid, "raw_data")
        raw_data_tags_table = get_user_table_name(user.userid, "raw_data_tags")
        
        print(f"用户 {user.username} (ID: {user.userid}) 的表:")
        print(f"  原始数据表: {raw_data_table}")
        print(f"  原始数据标签表: {raw_data_tags_table}")
        
        # 检查表是否存在
        with engine.connect() as conn:
            try:
                result = conn.execute(f"SELECT COUNT(*) FROM {raw_data_table}").fetchone()
                print(f"  原始数据记录数: {result[0] if result else 0}")
            except:
                print(f"  原始数据表不存在或无法访问")
            
            try:
                result = conn.execute(f"SELECT COUNT(*) FROM {raw_data_tags_table}").fetchone()
                print(f"  标签记录数: {result[0] if result else 0}")
            except:
                print(f"  原始数据标签表不存在或无法访问")
    finally:
        db.close()


def init_all_users_tables():
    """
    为所有现有用户初始化表
    """
    db = SessionLocal()
    try:
        from database.db_models.user_model import User
        users = db.query(User).all()
        
        print(f"找到 {len(users)} 个用户")
        
        success_count = 0
        for user in users:
            print(f"正在为用户 {user.username} (ID: {user.userid}) 初始化表...")
            if init_user_raw_data_tables(user.userid):
                print(f"  成功")
                success_count += 1
            else:
                print(f"  失败")
        
        print(f"完成: {success_count}/{len(users)} 个用户表初始化成功")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="管理用户特定的表")
    subparsers = parser.add_subparsers(dest="command", help="命令")
    
    # 初始化表命令
    init_parser = subparsers.add_parser("init", help="为用户初始化表")
    init_group = init_parser.add_mutually_exclusive_group(required=True)
    init_group.add_argument("--userid", help="用户ID")
    init_group.add_argument("--username", help="用户名")
    
    # 删除表命令
    delete_parser = subparsers.add_parser("delete", help="删除用户的表")
    delete_group = delete_parser.add_mutually_exclusive_group(required=True)
    delete_group.add_argument("--userid", help="用户ID")
    delete_group.add_argument("--username", help="用户名")
    
    # 列出用户命令
    subparsers.add_parser("list-users", help="列出所有用户")
    
    # 列出用户表命令
    list_parser = subparsers.add_parser("list-tables", help="列出用户的表")
    list_group = list_parser.add_mutually_exclusive_group(required=True)
    list_group.add_argument("--userid", help="用户ID")
    list_group.add_argument("--username", help="用户名")
    
    # 初始化所有用户表命令
    subparsers.add_parser("init-all", help="为所有用户初始化表")
    
    # 解析参数
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 执行命令
    if args.command == "init":
        init_user_tables(args.userid, args.username)
    elif args.command == "delete":
        delete_user_tables(args.userid, args.username)
    elif args.command == "list-users":
        list_all_users()
    elif args.command == "list-tables":
        list_user_tables(args.userid, args.username)
    elif args.command == "init-all":
        init_all_users_tables()


if __name__ == "__main__":
    main()