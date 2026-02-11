"""
MinIO 存储管理器
采用单存储桶 + 用户前缀的架构进行隔离
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import logging
from typing import Optional, List, BinaryIO
from datetime import datetime

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

logger = logging.getLogger(__name__)


class StorageManager:
    """MinIO 存储管理器"""

    # 存储桶名称
    BUCKET_NAME = os.getenv("MINIO_BUCKET_NAME", "green-tracker-minio")

    # MinIO 配置
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost")
    MINIO_PORT = os.getenv("MINIO_PORT", "6130")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
    MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

    # 目录结构常量
    DIR_RAW = "raw"
    DIR_PROCESSED = "processed"
    DIR_MODELS = "models"
    DIR_TEMP = "temp"

    # 原始数据子目录
    DIR_RAW_TRAIN = "train"
    DIR_RAW_TEST = "test"
    DIR_RAW_VAL = "val"

    def __init__(self):
        """初始化 MinIO 客户端"""
        try:
            from minio import Minio
            from minio.error import S3Error

            self._client = Minio(
                f"{self.MINIO_ENDPOINT}:{self.MINIO_PORT}",
                access_key=self.MINIO_ACCESS_KEY,
                secret_key=self.MINIO_SECRET_KEY,
                secure=self.MINIO_SECURE
            )
            self._S3Error = S3Error

            # 确保存储桶存在
            self._ensure_bucket_exists()

            logger.info(f"MinIO 存储管理器初始化成功 - 存储桶: {self.BUCKET_NAME}")

        except ImportError:
            logger.error("未安装 minio 库，请运行: pip install minio")
            raise
        except Exception as e:
            logger.error(f"MinIO 初始化失败: {e}")
            raise

    def _ensure_bucket_exists(self):
        """确保存储桶存在"""
        try:
            if not self._client.bucket_exists(self.BUCKET_NAME):
                logger.info(f"存储桶 {self.BUCKET_NAME} 不存在，正在创建...")
                self._client.make_bucket(self.BUCKET_NAME)
                logger.info(f"存储桶 {self.BUCKET_NAME} 创建成功")
        except self._S3Error as e:
            logger.error(f"检查/创建存储桶失败: {e}")
            raise

    def _get_user_prefix(self, user_id: str) -> str:
        """获取用户前缀路径"""
        # 使用 user_ 前缀确保路径唯一性
        return f"user_{user_id}"

    def _get_object_path(
        self,
        user_id: str,
        category: str,
        filename: str,
        subcategory: Optional[str] = None
    ) -> str:
        """
        构建对象完整路径

        Args:
            user_id: 用户ID
            category: 主目录 (raw, processed, models, temp)
            filename: 文件名
            subcategory: 子目录 (train, test, val 等)

        Returns:
            对象完整路径
        """
        parts = [self._get_user_prefix(user_id), category]

        if subcategory:
            parts.append(subcategory)

        parts.append(filename)

        return "/".join(parts)

    def upload_file(
        self,
        user_id: str,
        file_path: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None,
        object_name: Optional[str] = None
    ) -> dict:
        """
        上传文件到 MinIO

        Args:
            user_id: 用户ID
            file_path: 本地文件路径
            category: 主目录 (raw, processed, models, temp)
            subcategory: 子目录 (train, test, val 等)
            object_name: 自定义对象名（可选，默认使用文件名）

        Returns:
            上传结果字典
        """
        try:
            file_obj = Path(file_path)
            if not file_obj.exists():
                return {
                    "success": False,
                    "message": f"文件不存在: {file_path}"
                }

            filename = object_name or file_obj.name
            object_path = self._get_object_path(user_id, category, filename, subcategory)

            logger.info(f"上传文件: {file_path} -> {object_path}")

            self._client.fput_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path,
                file_path=str(file_obj)
            )

            file_url = self._get_file_url(object_path)

            return {
                "success": True,
                "message": "上传成功",
                "bucket": self.BUCKET_NAME,
                "path": object_path,
                "url": file_url,
                "filename": filename
            }

        except Exception as e:
            logger.error(f"上传文件失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }

    def upload_bytes(
        self,
        user_id: str,
        data: bytes,
        filename: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None,
        content_type: Optional[str] = "application/octet-stream"
    ) -> dict:
        """
        上传字节流到 MinIO

        Args:
            user_id: 用户ID
            data: 字节数据
            filename: 文件名
            category: 主目录
            subcategory: 子目录
            content_type: 内容类型

        Returns:
            上传结果字典
        """
        try:
            import io

            object_path = self._get_object_path(user_id, category, filename, subcategory)

            logger.info(f"上传字节流: {len(data)} bytes -> {object_path}")

            self._client.put_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type
            )

            file_url = self._get_file_url(object_path)

            return {
                "success": True,
                "message": "上传成功",
                "bucket": self.BUCKET_NAME,
                "path": object_path,
                "url": file_url,
                "filename": filename
            }

        except Exception as e:
            logger.error(f"上传字节流失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }

    def download_file(
        self,
        user_id: str,
        object_name: str,
        local_path: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None
    ) -> dict:
        """
        从 MinIO 下载文件

        Args:
            user_id: 用户ID
            object_name: 对象名
            local_path: 本地保存路径
            category: 主目录
            subcategory: 子目录

        Returns:
            下载结果字典
        """
        try:
            object_path = self._get_object_path(user_id, category, object_name, subcategory)

            logger.info(f"下载文件: {object_path} -> {local_path}")

            self._client.fget_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path,
                file_path=local_path
            )

            return {
                "success": True,
                "message": "下载成功",
                "bucket": self.BUCKET_NAME,
                "path": object_path,
                "local_path": local_path
            }

        except self._S3Error as e:
            if e.code == "NoSuchKey":
                return {
                    "success": False,
                    "message": f"文件不存在: {object_name}"
                }
            raise
        except Exception as e:
            logger.error(f"下载文件失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }

    def get_file_bytes(
        self,
        user_id: str,
        object_name: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None
    ) -> dict:
        """
        获取文件的字节数据

        Args:
            user_id: 用户ID
            object_name: 对象名
            category: 主目录
            subcategory: 子目录

        Returns:
            包含文件数据的字典
        """
        try:
            object_path = self._get_object_path(user_id, category, object_name, subcategory)

            logger.info(f"获取文件数据: {object_path}")

            response = self._client.get_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path
            )

            data = response.read()
            response.close()
            response.release_conn()

            return {
                "success": True,
                "message": "获取成功",
                "data": data,
                "content_type": response.headers.get('Content-Type', 'application/octet-stream')
            }

        except self._S3Error as e:
            if e.code == "NoSuchKey":
                return {
                    "success": False,
                    "message": f"文件不存在: {object_name}"
                }
            raise
        except Exception as e:
            logger.error(f"获取文件数据失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }

    def list_files(
        self,
        user_id: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None,
        prefix: Optional[str] = None
    ) -> List[dict]:
        """
        列出用户的文件

        Args:
            user_id: 用户ID
            category: 主目录
            subcategory: 子目录
            prefix: 额外的前缀过滤

        Returns:
            文件列表
        """
        try:
            path_parts = []

            # 只有在 user_id 不为空时才添加用户前缀
            if user_id:
                path_parts.append(self._get_user_prefix(user_id))

            # 只有在 category 不为空时才添加
            if category:
                path_parts.append(category)

            # 添加子目录
            if subcategory:
                path_parts.append(subcategory)

            # 构建路径前缀
            if path_parts:
                path_prefix = "/".join(path_parts) + "/"
            else:
                # 如果所有参数都为空，列出根目录
                path_prefix = ""

            if prefix:
                path_prefix += prefix

            logger.info(f"列出文件: {path_prefix}")

            objects = self._client.list_objects(
                bucket_name=self.BUCKET_NAME,
                prefix=path_prefix,
                recursive=True
            )

            files = []
            for obj in objects:
                files.append({
                    "name": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified,
                    "etag": obj.etag,
                    "content_type": obj.content_type
                })

            return files

        except Exception as e:
            logger.error(f"列出文件失败: {e}")
            return []

    def delete_file(
        self,
        user_id: str,
        object_name: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None
    ) -> dict:
        """
        删除文件

        Args:
            user_id: 用户ID
            object_name: 对象名
            category: 主目录
            subcategory: 子目录

        Returns:
            删除结果字典
        """
        try:
            object_path = self._get_object_path(user_id, category, object_name, subcategory)

            logger.info(f"删除文件: {object_path}")

            self._client.remove_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path
            )

            return {
                "success": True,
                "message": "删除成功",
                "path": object_path
            }

        except Exception as e:
            logger.error(f"删除文件失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }

    def file_exists(
        self,
        user_id: str,
        object_name: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None
    ) -> bool:
        """
        检查文件是否存在

        Args:
            user_id: 用户ID
            object_name: 对象名
            category: 主目录
            subcategory: 子目录

        Returns:
            文件是否存在
        """
        try:
            object_path = self._get_object_path(user_id, category, object_name, subcategory)

            self._client.stat_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path
            )
            return True

        except self._S3Error as e:
            if e.code == "NoSuchKey":
                return False
            raise
        except Exception as e:
            logger.error(f"检查文件失败: {e}")
            return False

    def get_file_info(
        self,
        user_id: str,
        object_name: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None
    ) -> Optional[dict]:
        """
        获取文件信息

        Args:
            user_id: 用户ID
            object_name: 对象名
            category: 主目录
            subcategory: 子目录

        Returns:
            文件信息字典
        """
        try:
            object_path = self._get_object_path(user_id, category, object_name, subcategory)

            stat = self._client.stat_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path
            )

            return {
                "name": object_path,
                "size": stat.size,
                "last_modified": stat.last_modified,
                "etag": stat.etag,
                "content_type": stat.content_type,
                "metadata": stat.metadata
            }

        except self._S3Error as e:
            if e.code == "NoSuchKey":
                return None
            raise
        except Exception as e:
            logger.error(f"获取文件信息失败: {e}")
            return None

    def _get_file_url(self, object_path: str, expires: int = 7 * 24 * 60 * 60) -> str:
        """
        生成文件访问URL

        Args:
            object_path: 对象路径
            expires: 过期时间（秒），默认7天

        Returns:
            预签名URL
        """
        try:
            from datetime import timedelta

            url = self._client.presigned_get_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path,
                expires=timedelta(seconds=expires)
            )

            return url

        except Exception as e:
            logger.error(f"生成URL失败: {e}")
            return ""

    def get_presigned_url(
        self,
        user_id: str,
        object_name: str,
        category: str = DIR_RAW,
        subcategory: Optional[str] = None,
        expires: int = 7 * 24 * 60 * 60
    ) -> str:
        """
        生成预签名访问URL

        Args:
            user_id: 用户ID
            object_name: 对象名
            category: 主目录
            subcategory: 子目录
            expires: 过期时间（秒）

        Returns:
            预签名URL
        """
        object_path = self._get_object_path(user_id, category, object_name, subcategory)
        return self._get_file_url(object_path, expires)


# 全局单例
_storage_manager = None


def get_storage_manager() -> StorageManager:
    """获取存储管理器单例"""
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager
