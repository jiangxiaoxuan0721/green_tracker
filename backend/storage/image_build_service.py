"""
算法镜像构建服务 - 处理算法的镜像构建和管理
"""

import asyncio
import os
import logging
import subprocess as _sp
import shutil
import zipfile
from typing import Callable, Optional, Tuple

import yaml

logger = logging.getLogger(__name__)

# Docker 配置
DOCKER_REGISTRY = os.getenv("DOCKER_REGISTRY", "localhost:5000")
DOCKER_BUILD_CONTEXT = "/tmp/algorithm_builds"


class ImageBuildService:
    """算法镜像构建服务

    流式日志 + build 前清理同前缀旧 tag（避免镜像冲突）。
    端口由 ContainerManager 自管，build_image 不再返回端口（返回 None）。
    """

    def __init__(self):
        self.build_context = DOCKER_BUILD_CONTEXT
        os.makedirs(self.build_context, exist_ok=True)

    @staticmethod
    def image_tag(uuid: str) -> str:
        """单 tag 命名：与 ContainerManager.image_tag 一致。"""
        return f"algorithm_{uuid.replace('-', '')}:latest"

    def _next_tag(self, uuid: str) -> str:
        """每次 build 用临时 build-tag（与 :latest 别名同步）。"""
        return f"algorithm_{uuid.replace('-', '')}:build-{os.getpid()}"

    async def build_image(
        self,
        algorithm_uuid: str,
        minio_path: str,
        minio_client,
        *,
        log_sink: Optional[Callable[[str], None]] = None,
    ) -> Tuple[bool, str, object]:
        log = log_sink or (lambda _msg: None)
        try:
            log(f"下载算法包: {minio_path}")
            package = minio_client.get_object("algorithms", minio_path)

            build_dir = os.path.join(self.build_context, algorithm_uuid)
            os.makedirs(build_dir, exist_ok=True)
            zip_path = os.path.join(build_dir, "algorithm.zip")
            with open(zip_path, 'wb') as f:
                f.write(package)

            extract_dir = os.path.join(build_dir, "extracted")
            with zipfile.ZipFile(zip_path, 'r') as zr:
                zr.extractall(extract_dir)

            config_path = None
            for root, _dirs, files in os.walk(extract_dir):
                if 'algorithm.yaml' in files:
                    config_path = os.path.join(root, 'algorithm.yaml')
                    break
            if not config_path:
                return False, "", "算法包缺少 algorithm.yaml"
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)

            from storage.dockerfile_generator import get_dockerfile_generator
            generator = get_dockerfile_generator()
            dockerfile_content, _ = generator.generate_dockerfile(
                algorithm_dir=extract_dir,
                algorithm_uuid=algorithm_uuid,
                framework=config.get('framework', 'python'),
            )
            dockerfile_path = os.path.join(extract_dir, 'Dockerfile')
            with open(dockerfile_path, 'w') as f:
                f.write(dockerfile_content)

            # ★ 关键：build 前清理同前缀旧 tag（spec 决策 C）
            old_tags = await self._list_image_tags(algorithm_uuid)
            for t in old_tags:
                log(f"清理旧镜像: {t}")
                await self._exec(['docker', 'rmi', t], check=False)

            new_tag = self._next_tag(algorithm_uuid)
            log(f"构建镜像: {new_tag}")
            ok = await self._build_docker_image(
                extract_dir, dockerfile_path, new_tag, log_sink=log,
            )
            if not ok:
                return False, "", "Docker 镜像构建失败"

            # 让 :latest 别名同步指向新 build tag
            await self._exec(['docker', 'tag', new_tag, self.image_tag(algorithm_uuid)], check=False)

            shutil.rmtree(build_dir, ignore_errors=True)
            log(f"镜像构建成功: {new_tag}")
            return True, new_tag, None  # 端口由 ContainerManager 自管

        except Exception as e:
            logger.error(f"镜像构建失败: {e}")
            return False, "", str(e)

    async def _list_image_tags(self, uuid: str) -> list[str]:
        """列出同前缀的所有 image tag（待清理）。"""
        try:
            result = _sp.run(
                ["docker", "images", "--format", "{{.Repository}}:{{.Tag}}",
                 "--filter", f"reference=algorithm_{uuid.replace('-', '')}"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode != 0:
                return []
            return [line.strip() for line in result.stdout.splitlines() if line.strip()]
        except (FileNotFoundError, _sp.TimeoutExpired):
            return []

    async def _exec(self, cmd: list[str], check: bool = False) -> tuple[int, str, str]:
        """统一 docker CLI 执行。"""
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        return process.returncode, stdout.decode(errors="replace"), stderr.decode(errors="replace")

    async def _build_docker_image(
        self,
        context: str,
        dockerfile: str,
        image_name: str,
        log_sink: Optional[Callable[[str], None]] = None,
    ) -> bool:
        """流式构建：逐行写入 log_sink。"""
        cmd = ['docker', 'build', '-f', dockerfile, '-t', image_name, context]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        if log_sink is not None:
            async for line in process.stdout:
                log_sink(line.decode(errors="replace").rstrip())
        rc = await process.wait()
        if rc != 0:
            logger.error(f"Docker 构建失败: rc={rc}")
        return rc == 0

    async def push_image(self, image_name: str) -> bool:
        """推送镜像到仓库。"""
        try:
            cmd = ['docker', 'push', image_name]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
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