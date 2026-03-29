"""
MinIO 存储管理器

存储路径规范：
- 所有用户共享存储桶：green-tracker-minio
- 原始数据路径：user_{user_id}/data/session_{session_id}/{filename}
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import logging
from typing import Optional, Dict, Any

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
    MINIO_PORT = os.getenv("MINIO_PORT", "9100")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
    MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

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

    def _get_object_path(
        self,
        user_id: str,
        filename: str,
        session_id: str
    ) -> str:
        """
        构建对象完整路径

        路径规范：user_{user_id}/data/session_{session_id}/{filename}

        Args:
            user_id: 用户ID
            filename: 文件名
            session_id: 采集会话ID

        Returns:
            对象完整路径
        """
        parts = [
            f"user_{user_id}",
            "data",
            f"session_{session_id}",
            filename
        ]

        return "/".join(parts)

    def _infer_content_type(self, filename: str, default_type: Optional[str] = None) -> str:
        """
        根据文件扩展名推断内容类型

        Args:
            filename: 文件名
            default_type: 默认内容类型

        Returns:
            推断的内容类型
        """
        if not filename:
            return default_type or 'application/octet-stream'

        # 扩展名到MIME类型的映射
        ext_map = {
            # 图像
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.tif': 'image/tiff',
            '.tiff': 'image/tiff',
            # 视频
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
            # 文档
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.xml': 'application/xml',
        }

        ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''
        return ext_map.get(ext, default_type or 'application/octet-stream')

    def upload_bytes(
        self,
        user_id: str,
        data: bytes,
        filename: str,
        session_id: str,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        上传字节流到 MinIO

        Args:
            user_id: 用户ID
            data: 字节数据
            filename: 文件名
            session_id: 采集会话ID
            content_type: 内容类型

        Returns:
            上传结果字典
        """
        try:
            import io

            object_path = self._get_object_path(user_id, filename, session_id)

            logger.info(f"上传字节流: {len(data)} bytes -> {object_path}")

            # 确保 content_type 不为 None，优先使用提供的类型，否则根据文件名推断
            if content_type and content_type != 'application/octet-stream':
                final_content_type = content_type
            else:
                final_content_type = self._infer_content_type(filename, content_type)

            self._client.put_object(
                bucket_name=self.BUCKET_NAME,
                object_name=object_path,
                data=io.BytesIO(data),
                length=len(data),
                content_type=final_content_type
            )

            file_url = self._get_file_url(object_path)

            logger.info(f"上传成功，内容类型: {final_content_type}")

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

    def _get_file_bytes_direct(self, object_path: str) -> Dict[str, Any]:
        """
        直接通过完整对象路径获取文件二进制数据

        Args:
            object_path: 完整的对象路径

        Returns:
            包含文件数据的字典
        """
        try:
            logger.info(f"直接获取文件数据: {object_path}")

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
                    "message": f"文件不存在: {object_path}"
                }
            raise
        except Exception as e:
            logger.error(f"直接获取文件数据失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }

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

    def get_public_url(
        self,
        object_path: str,
        expires: int = 7 * 24 * 60 * 60
    ) -> str:
        """
        生成公开访问URL（优先使用直接URL，因为已配置公开访问）

        Args:
            object_path: 对象路径
            expires: 过期时间（秒），默认7天

        Returns:
            可访问的URL（优先直接URL）
        """
        try:
            # 获取MinIO配置
            endpoint = os.getenv('MINIO_ENDPOINT', 'localhost')
            port = os.getenv('MINIO_PORT', '9100')
            secure = os.getenv('MINIO_SECURE', 'false').lower() == 'true'
            bucket_name = os.getenv('MINIO_BUCKET_NAME', 'green-tracker-minio')

            # 构建直接访问URL（因为已配置公开访问）
            protocol = 'https' if secure else 'http'
            url = f"{protocol}://{endpoint}:{port}/{bucket_name}/{object_path}"

            # 先测试直接URL是否可访问
            try:
                import requests
                response = requests.head(url, timeout=2)
                if response.status_code == 200:
                    logger.info(f"使用直接URL（公开访问）: {url}")
                    return url
            except:
                logger.info(f"直接URL不可访问，尝试预签名URL: {url}")

            # 如果直接URL不可访问，回退到预签名URL
            presigned_url = self._get_file_url(object_path, expires)
            if presigned_url:
                logger.info(f"使用预签名URL: {presigned_url}")
                return presigned_url

            logger.error(f"无法生成可访问的URL: {object_path}")
            return url  # 最后返回直接URL作为备选

        except Exception as e:
            logger.error(f"生成URL失败: {e}")
            return ""


# 全局单例
_storage_manager = None


def get_storage_manager() -> StorageManager:
    """获取存储管理器单例"""
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager
