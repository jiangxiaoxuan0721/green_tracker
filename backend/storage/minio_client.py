"""
MinIO 客户端 - 专门用于算法存储
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import logging
import io
from typing import Optional

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

logger = logging.getLogger(__name__)


class MinioClient:
    """算法存储 MinIO 客户端"""

    # 存储桶名称
    ALGORITHMS_BUCKET = "algorithms"

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

            self._client = Minio(
                f"{self.MINIO_ENDPOINT}:{self.MINIO_PORT}",
                access_key=self.MINIO_ACCESS_KEY,
                secret_key=self.MINIO_SECRET_KEY,
                secure=self.MINIO_SECURE
            )

            # 确保算法存储桶存在
            self._ensure_bucket_exists(self.ALGORITHMS_BUCKET)

            logger.info(f"算法存储 MinIO 客户端初始化成功 - 存储桶: {self.ALGORITHMS_BUCKET}")

        except ImportError:
            logger.error("未安装 minio 库")
            raise
        except Exception as e:
            logger.error(f"MinIO 初始化失败: {e}")
            raise

    def _ensure_bucket_exists(self, bucket_name: str):
        """确保存储桶存在"""
        try:
            if not self._client.bucket_exists(bucket_name):
                logger.info(f"存储桶 {bucket_name} 不存在，正在创建...")
                self._client.make_bucket(bucket_name)
                logger.info(f"存储桶 {bucket_name} 创建成功")
        except Exception as e:
            logger.error(f"检查/创建存储桶失败: {e}")
            raise

    def upload_file(
        self,
        bucket: str,
        object_name: str,
        data: bytes,
        content_type: str = "application/zip"
    ):
        """
        上传文件到 MinIO
        
        Args:
            bucket: 存储桶名称
            object_name: 对象名称
            data: 文件数据
            content_type: 内容类型
        """
        try:
            self._client.put_object(
                bucket_name=bucket,
                object_name=object_name,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type
            )
            logger.info(f"文件上传成功: {bucket}/{object_name}")
        except Exception as e:
            logger.error(f"文件上传失败: {e}")
            raise

    def get_object(self, bucket: str, object_name: str) -> bytes:
        """
        获取文件内容
        
        Args:
            bucket: 存储桶名称
            object_name: 对象名称
        
        Returns:
            文件二进制数据
        """
        try:
            response = self._client.get_object(bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except Exception as e:
            logger.error(f"获取文件失败: {e}")
            raise

    def remove_object(self, bucket: str, object_name: str):
        """
        删除文件
        
        Args:
            bucket: 存储桶名称
            object_name: 对象名称
        """
        try:
            self._client.remove_object(bucket, object_name)
            logger.info(f"文件删除成功: {bucket}/{object_name}")
        except Exception as e:
            logger.error(f"删除文件失败: {e}")
            raise

    def get_presigned_url(self, bucket: str, object_name: str, expires: int = 3600) -> str:
        """
        生成预签名URL
        
        Args:
            bucket: 存储桶名称
            object_name: 对象名称
            expires: 过期时间(秒)
        
        Returns:
            预签名URL
        """
        try:
            from datetime import timedelta
            url = self._client.presigned_get_object(
                bucket_name=bucket,
                object_name=object_name,
                expires=timedelta(seconds=expires)
            )
            return url
        except Exception as e:
            logger.error(f"生成预签名URL失败: {e}")
            raise


# 全局单例
_minio_client = None


def get_minio_client() -> MinioClient:
    """获取 MinIO 客户端单例"""
    global _minio_client
    if _minio_client is None:
        _minio_client = MinioClient()
    return _minio_client


# 导出简化版
minio_client = get_minio_client()