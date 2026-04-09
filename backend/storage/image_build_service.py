"""
算法镜像构建服务 - 处理算法的镜像构建和管理
"""

import os
import logging
import zipfile
import tempfile
import shutil
import uuid
from typing import Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# Docker 配置
DOCKER_REGISTRY = os.getenv("DOCKER_REGISTRY", "localhost:5000")
DOCKER_BUILD_CONTEXT = "/tmp/algorithm_builds"


class ImageBuildService:
    """算法镜像构建服务"""

    def __init__(self):
        self.build_context = DOCKER_BUILD_CONTEXT
        os.makedirs(self.build_context, exist_ok=True)

    async def build_image(
        self,
        algorithm_uuid: str,
        minio_path: str,
        minio_client,
        assigned_port: int = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        构建算法镜像
        
        Args:
            algorithm_uuid: 算法UUID
            minio_path: MinIO存储路径
            minio_client: MinIO客户端
            assigned_port: 分配的主机端口（可选）
        
        Returns:
            (成功标志, 镜像名, 主机端口号或错误信息)
        """
        try:
            logger.info(f"开始构建算法镜像: {algorithm_uuid}")

            # 1. 创建临时目录
            build_dir = os.path.join(self.build_context, algorithm_uuid)
            os.makedirs(build_dir, exist_ok=True)

            # 2. 下载算法包
            logger.info(f"从MinIO下载算法包: {minio_path}")
            algorithm_package = minio_client.get_object("algorithms", minio_path)

            # 3. 解压算法包
            zip_path = os.path.join(build_dir, "algorithm.zip")
            with open(zip_path, 'wb') as f:
                f.write(algorithm_package)

            extract_dir = os.path.join(build_dir, "extracted")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

            logger.info(f"算法包解压到: {extract_dir}")

            # 4. 解析 algorithm.yaml
            import yaml
            config_path = None
            for root, dirs, files in os.walk(extract_dir):
                if 'algorithm.yaml' in files:
                    config_path = os.path.join(root, 'algorithm.yaml')
                    break

            if not config_path:
                return False, "", "算法包缺少 algorithm.yaml 文件"

            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)

            # 5. 生成 Dockerfile
            from storage.dockerfile_generator import get_dockerfile_generator
            generator = get_dockerfile_generator()
            framework = config.get('framework', 'python')

            # 找到src目录
            src_dir = None
            for item in os.listdir(extract_dir):
                item_path = os.path.join(extract_dir, item)
                if os.path.isdir(item_path) and item == 'src':
                    src_dir = item_path
                    break

            # 生成Dockerfile，容器内部端口固定为8000
            dockerfile_content, _ = generator.generate_dockerfile(
                algorithm_dir=extract_dir,
                algorithm_uuid=algorithm_uuid,
                framework=framework
            )
            
            # 如果传入了分配端口，使用它作为主机端口
            port = assigned_port if assigned_port is not None else generator.get_next_port()

            # 写入 Dockerfile
            dockerfile_path = os.path.join(extract_dir, 'Dockerfile')
            with open(dockerfile_path, 'w') as f:
                f.write(dockerfile_content)

            # 6. 构建镜像
            docker_image = f"{DOCKER_REGISTRY}/algorithm_{algorithm_uuid}:latest"
            logger.info(f"开始构建镜像: {docker_image}")

            build_success = await self._build_docker_image(
                context=extract_dir,
                dockerfile=dockerfile_path,
                image_name=docker_image
            )

            if not build_success:
                return False, "", "Docker镜像构建失败"

            # 7. 清理临时文件
            shutil.rmtree(build_dir, ignore_errors=True)

            logger.info(f"镜像构建成功: {docker_image}, 端口: {port}")
            return True, docker_image, port

        except Exception as e:
            logger.error(f"镜像构建失败: {str(e)}")
            return False, "", str(e)

    async def _build_docker_image(
        self,
        context: str,
        dockerfile: str,
        image_name: str
    ) -> bool:
        """
        执行 Docker 构建
        
        Args:
            context: 构建上下文目录
            dockerfile: Dockerfile路径
            image_name: 镜像名称
        
        Returns:
            是否成功
        """
        try:
            import subprocess
            import asyncio

            # 使用 docker build 命令
            cmd = [
                'docker', 'build',
                '-f', dockerfile,
                '-t', image_name,
                context
            ]

            logger.info(f"执行命令: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.error(f"Docker构建失败: {stderr.decode()}")
                return False

            logger.info(f"Docker构建输出: {stdout.decode()}")
            return True

        except FileNotFoundError:
            logger.error("Docker未安装或不在PATH中")
            raise FileNotFoundError("Docker未安装或不在PATH中，请检查Docker是否正确安装并已添加到系统PATH")
        except Exception as e:
            logger.error(f"Docker构建异常: {str(e)}")
            raise

    async def push_image(self, image_name: str) -> bool:
        """
        推送镜像到仓库
        
        Args:
            image_name: 镜像名称
        
        Returns:
            是否成功
        """
        try:
            import subprocess
            import asyncio

            cmd = ['docker', 'push', image_name]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.error(f"镜像推送失败: {stderr.decode()}")
                return False

            logger.info(f"镜像推送成功: {image_name}")
            return True

        except Exception as e:
            logger.error(f"镜像推送异常: {str(e)}")
            return False


# 全局单例
_image_build_service = None


def get_image_build_service() -> ImageBuildService:
    """获取镜像构建服务单例"""
    global _image_build_service
    if _image_build_service is None:
        _image_build_service = ImageBuildService()
    return _image_build_service