"""
MinIO 存储管理器测试脚本
验证单存储桶 + 用户前缀隔离架构
"""

import os
import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from storage.storage_manager import StorageManager, get_storage_manager

print("=" * 70)
print("MinIO 存储管理器测试")
print("=" * 70)

# 获取存储管理器
try:
    storage = get_storage_manager()
    print("\n✓ 存储管理器初始化成功")
    print(f"  存储桶: {storage.BUCKET_NAME}")
    print(f"  端点: {storage.MINIO_ENDPOINT}:{storage.MINIO_PORT}")
except Exception as e:
    print(f"\n✗ 存储管理器初始化失败: {e}")
    exit(1)

# 测试用户ID列表
test_users = ["alice", "bob", "charlie"]

def print_section(title):
    """打印测试章节"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def test_upload_files():
    """测试文件上传"""
    print_section("测试1: 上传文件到不同用户目录")

    for user_id in test_users:
        print(f"\n--- 用户 {user_id} ---")

        # 创建测试文件
        test_file = f"/tmp/test_{user_id}.txt"
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(f"这是用户 {user_id} 的测试文件\n")

        # 上传到 raw/train 目录
        result = storage.upload_file(
            user_id=user_id,
            file_path=test_file,
            category=storage.DIR_RAW,
            subcategory=storage.DIR_RAW_TRAIN
        )

        if result['success']:
            print(f"  ✓ 上传成功: {result['filename']}")
            print(f"    路径: {result['path']}")
            print(f"    URL: {result['url']}")
        else:
            print(f"  ✗ 上传失败: {result['message']}")

        # 上传到 raw/test 目录
        test_file2 = f"/tmp/test_{user_id}_test.txt"
        with open(test_file2, 'w', encoding='utf-8') as f:
            f.write(f"这是用户 {user_id} 的测试集文件\n")

        result = storage.upload_file(
            user_id=user_id,
            file_path=test_file2,
            category=storage.DIR_RAW,
            subcategory=storage.DIR_RAW_TEST
        )

        if result['success']:
            print(f"  ✓ 上传成功: {result['filename']}")
            print(f"    路径: {result['path']}")
        else:
            print(f"  ✗ 上传失败: {result['message']}")

        # 上传到 processed 目录
        test_file3 = f"/tmp/test_{user_id}_processed.txt"
        with open(test_file3, 'w', encoding='utf-8') as f:
            f.write(f"这是用户 {user_id} 的处理后文件\n")

        result = storage.upload_file(
            user_id=user_id,
            file_path=test_file3,
            category=storage.DIR_PROCESSED
        )

        if result['success']:
            print(f"  ✓ 上传成功: {result['filename']}")
            print(f"    路径: {result['path']}")
        else:
            print(f"  ✗ 上传失败: {result['message']}")

def test_upload_bytes():
    """测试字节流上传"""
    print_section("测试2: 上传字节流数据")

    for user_id in test_users[:2]:  # 只测试前两个用户
        print(f"\n--- 用户 {user_id} ---")

        # 上传字节流到 models 目录
        data = f"这是用户 {user_id} 的模型数据".encode('utf-8')
        result = storage.upload_bytes(
            user_id=user_id,
            data=data,
            filename="model.pkl",
            category=storage.DIR_MODELS,
            content_type="application/octet-stream"
        )

        if result['success']:
            print(f"  ✓ 上传成功: {result['filename']}")
            print(f"    路径: {result['path']}")
        else:
            print(f"  ✗ 上传失败: {result['message']}")

def test_list_files():
    """测试列出文件"""
    print_section("测试3: 列出用户文件")

    for user_id in test_users[:2]:
        print(f"\n--- 用户 {user_id} ---")

        # 列出 raw 目录下所有文件
        files = storage.list_files(
            user_id=user_id,
            category=storage.DIR_RAW
        )

        print(f"  raw 目录下共有 {len(files)} 个文件:")
        for f in files:
            print(f"    - {f['name']} ({f['size']} bytes)")

        # 列出 models 目录下所有文件
        files = storage.list_files(
            user_id=user_id,
            category=storage.DIR_MODELS
        )

        print(f"  models 目录下共有 {len(files)} 个文件:")
        for f in files:
            print(f"    - {f['name']} ({f['size']} bytes)")

def test_file_exists():
    """测试文件存在性检查"""
    print_section("测试4: 检查文件是否存在")

    user_id = test_users[0]
    filename = f"test_{user_id}.txt"

    exists = storage.file_exists(
        user_id=user_id,
        object_name=filename,
        category=storage.DIR_RAW,
        subcategory=storage.DIR_RAW_TRAIN
    )

    print(f"\n--- 用户 {user_id} ---")
    print(f"  文件 '{filename}' 存在: {'是' if exists else '否'}")

    # 检查不存在的文件
    exists = storage.file_exists(
        user_id=user_id,
        object_name="nonexistent.txt",
        category=storage.DIR_RAW
    )
    print(f"  文件 'nonexistent.txt' 存在: {'是' if exists else '否'}")

def test_get_file_info():
    """测试获取文件信息"""
    print_section("测试5: 获取文件信息")

    user_id = test_users[0]
    filename = f"test_{user_id}.txt"

    info = storage.get_file_info(
        user_id=user_id,
        object_name=filename,
        category=storage.DIR_RAW,
        subcategory=storage.DIR_RAW_TRAIN
    )

    if info:
        print(f"\n--- 用户 {user_id} ---")
        print(f"  文件名: {info['name']}")
        print(f"  大小: {info['size']} bytes")
        print(f"  最后修改: {info['last_modified']}")
        print(f"  ETag: {info['etag']}")
        print(f"  内容类型: {info['content_type']}")
    else:
        print(f"\n  文件不存在")

def test_download_file():
    """测试下载文件"""
    print_section("测试6: 下载文件")

    user_id = test_users[0]
    filename = f"test_{user_id}.txt"
    download_path = f"/tmp/downloaded_{user_id}.txt"

    result = storage.download_file(
        user_id=user_id,
        object_name=filename,
        local_path=download_path,
        category=storage.DIR_RAW,
        subcategory=storage.DIR_RAW_TRAIN
    )

    if result['success']:
        print(f"\n--- 用户 {user_id} ---")
        print(f"  ✓ 下载成功")
        print(f"    保存路径: {result['local_path']}")

        # 读取并显示文件内容
        with open(download_path, 'r', encoding='utf-8') as f:
            content = f.read()
            print(f"    文件内容: {content.strip()}")
    else:
        print(f"\n  ✗ 下载失败: {result['message']}")

def test_get_presigned_url():
    """测试生成预签名URL"""
    print_section("测试7: 生成预签名URL")

    user_id = test_users[0]
    filename = f"test_{user_id}.txt"

    url = storage.get_presigned_url(
        user_id=user_id,
        object_name=filename,
        category=storage.DIR_RAW,
        subcategory=storage.DIR_RAW_TRAIN,
        expires=3600  # 1小时
    )

    if url:
        print(f"\n--- 用户 {user_id} ---")
        print(f"  ✓ 预签名URL生成成功")
        print(f"    URL: {url}")
    else:
        print(f"\n  ✗ 预签名URL生成失败")

def test_directory_structure():
    """测试目录结构"""
    print_section("测试8: 验证目录结构")

    print("\n  期望的目录结构:")
    print("  green-tracker-minio/")
    for user_id in test_users:
        print(f"  ├── user_{user_id}/")
        print(f"  │   ├── raw/")
        print(f"  │   │   ├── train/")
        print(f"  │   │   └── test/")
        print(f"  │   ├── processed/")
        print(f"  │   └── models/")

    print("\n  实际文件列表:")
    files = storage.list_files(
        user_id="",
        category=""
    )

    # 按用户分组显示
    user_files = {}
    for f in files:
        path_parts = f['name'].split('/')
        if len(path_parts) >= 2:
            user_prefix = path_parts[0]
            if user_prefix not in user_files:
                user_files[user_prefix] = []
            user_files[user_prefix].append(f)

    for user_prefix, files_list in sorted(user_files.items()):
        print(f"\n  {user_prefix}/")
        for f in files_list:
            indent = "    " * (f['name'].count('/') - 1)
            print(f"{indent}├── {Path(f['name']).name}")

def cleanup_test_files():
    """清理测试文件"""
    print_section("清理测试文件")

    for user_id in test_users:
        print(f"\n--- 用户 {user_id} ---")
        deleted_count = 0

        # 遍历各个目录删除文件
        for category in [storage.DIR_RAW, storage.DIR_PROCESSED, storage.DIR_MODELS]:
            for subcategory in [storage.DIR_RAW_TRAIN, storage.DIR_RAW_TEST, storage.DIR_RAW_VAL, None]:
                # 跳过无效的组合
                if category != storage.DIR_RAW and subcategory is not None:
                    continue

                files = storage.list_files(
                    user_id=user_id,
                    category=category,
                    subcategory=subcategory
                )

                for f in files:
                    # 提取文件名（不含路径）
                    object_name = f['name'].split('/')[-1]

                    result = storage.delete_file(
                        user_id=user_id,
                        object_name=object_name,
                        category=category,
                        subcategory=subcategory
                    )

                    if result['success']:
                        deleted_count += 1

        print(f"  已删除 {deleted_count} 个文件")

    # 清理本地文件
    print(f"\n  清理本地文件...")
    for user_id in test_users:
        for suffix in ["", "_test", "_processed"]:
            test_file = f"/tmp/test_{user_id}{suffix}.txt"
            if os.path.exists(test_file):
                os.remove(test_file)
                print(f"  - 已删除: {test_file}")

        download_file = f"/tmp/downloaded_{user_id}.txt"
        if os.path.exists(download_file):
            os.remove(download_file)
            print(f"  - 已删除: {download_file}")

if __name__ == "__main__":
    # 运行所有测试
    test_upload_files()
    test_upload_bytes()
    test_list_files()
    test_file_exists()
    test_get_file_info()
    test_download_file()
    test_get_presigned_url()
    test_directory_structure()

    # 清理
    cleanup_test_files()

    print("\n" + "=" * 70)
    print("  所有测试完成!")
    print("=" * 70)
