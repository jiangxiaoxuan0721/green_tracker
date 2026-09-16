"""
容器管理服务 - 管理算法容器的生命周期
"""

import os
import logging
import asyncio
import subprocess
from typing import Optional, List, Dict, Any, Tuple, Callable

logger = logging.getLogger(__name__)

# 容器配置
CONTAINER_PREFIX = "green_tracker_algorithm_"
CONTAINER_PORT_MIN = 8001
CONTAINER_PORT_MAX = 9999  # 含


class PortExhaustedError(Exception):
    """8001-9999 端口池耗尽时抛出。"""


class ContainerManager:
    """算法容器管理器"""

    def __init__(self):
        self.registry = os.getenv("DOCKER_REGISTRY", "localhost:5000")
        self._port_pool_lock = asyncio.Lock()
        self._allocated_ports: set[int] = set()

    @staticmethod
    def container_name(uuid: str) -> str:
        """完整 uuid 命名（去横杠）：保证全局唯一，零碰撞。"""
        return f"green_tracker_algorithm_{uuid.replace('-', '')}"

    @staticmethod
    def image_tag(uuid: str) -> str:
        """单 tag 命名：重建时由 ImageBuildService 显式清理旧 tag。"""
        return f"algorithm_{uuid.replace('-', '')}:latest"

    async def allocate_port(self) -> int:
        async with self._port_pool_lock:
            used = self._allocated_ports | await self._scan_docker_used_ports()
            for p in range(CONTAINER_PORT_MIN, CONTAINER_PORT_MAX + 1):
                if p not in used:
                    self._allocated_ports.add(p)
                    return p
            raise PortExhaustedError("8001-9999 端口已用尽")

    async def release_port(self, port: int) -> None:
        async with self._port_pool_lock:
            self._allocated_ports.discard(port)

    async def _scan_docker_used_ports(self) -> set[int]:
        """列出所有已暴露给 docker 容器的主机端口。失败时返回空集（保守行为）。"""
        try:
            result = subprocess.run(
                ["docker", "ps", "--format", "{{.Ports}}"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode != 0:
                return set()
            ports: set[int] = set()
            import re
            stdout = result.stdout
            # 兼容 bytes 与 str（test mock 返回 bytes；text=True 真实路径返回 str）
            if isinstance(stdout, bytes):
                stdout = stdout.decode("utf-8", errors="ignore")
            for m in re.finditer(r":(\d+)->", stdout):
                ports.add(int(m.group(1)))
            return ports
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return set()

    async def _exec(self, cmd: list[str], check: bool = False) -> tuple[int, str, str]:
        """统一的 docker CLI 执行：返回 (returncode, stdout, stderr)。"""
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        return process.returncode, stdout.decode(errors="replace"), stderr.decode(errors="replace")

    async def _exec_stream(
        self,
        cmd: list[str],
        log_sink: Optional[Callable[[str], None]] = None,
    ) -> tuple[int, str, str]:
        """流式执行：stdout 逐行写入 log_sink，返回 (rc, full_stdout, stderr)。

        - 有 sink：异步迭代 stdout，逐行调 sink；完成后用 stderr.read() 取 stderr
        - 无 sink：直接 process.communicate() 取全部 stdout/stderr
        """
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        if log_sink is not None:
            full_stdout_parts: list[str] = []
            async for line in process.stdout:
                decoded = line.decode(errors="replace").rstrip()
                full_stdout_parts.append(decoded)
                log_sink(decoded)
            stderr_bytes = await process.stderr.read() if process.stderr else b""
            return (
                process.returncode,
                "\n".join(full_stdout_parts),
                stderr_bytes.decode(errors="replace"),
            )
        stdout_bytes, stderr_bytes = await process.communicate()
        return (
            process.returncode,
            stdout_bytes.decode(errors="replace"),
            stderr_bytes.decode(errors="replace"),
        )

    async def wait_healthy(self, port: int, timeout: int = 30) -> bool:
        """等待容器内服务就绪（GET /health 返回 200）。"""
        import httpx
        health_url = f"http://localhost:{port}/health"
        for _ in range(timeout):
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(health_url)
                    if resp.status_code == 200:
                        return True
            except Exception:
                pass
            await asyncio.sleep(1)
        return False

    async def start_container(
        self,
        algorithm_uuid: str,
        image_name: str,
        env: Optional[Dict[str, str]] = None,
        log_sink: Optional[Callable[[str], None]] = None,
    ) -> Tuple[bool, str, int, str]:
        """启动算法容器（先清理同名旧容器；端口自管；可选流式日志）。

        返回 (ok, container_id, port, error)。port 由 allocate_port 自管，
        调用方不再传入——确保不会和现存的同 uuid 容器撞端口。
        log_sink 接受单行字符串回调，用于把 docker stdout 实时推给前端。
        """
        container_name = self.container_name(algorithm_uuid)
        port: Optional[int] = None
        try:
            # 1. 启动前清理同名旧容器（修复撞名 bug）
            await self._exec(['docker', 'rm', '-f', container_name], check=False)

            # 2. 自管端口分配
            port = await self.allocate_port()

            # 3. 构建 docker run
            env_list = [f"-e {k}={v}" for k, v in (env or {}).items()]
            env_list.append(f"-e ALGORITHM_UUID={algorithm_uuid}")
            cmd = [
                'docker', 'run', '-d',
                '--name', container_name,
                '--restart', 'unless-stopped',
                '-p', f'{port}:8000',
            ] + env_list + [
                '--memory', '4g',
                '--memory-swap', '4g',
                image_name,
            ]
            rc, stdout, stderr = await self._exec_stream(cmd, log_sink)
            if rc != 0:
                if port is not None:
                    await self.release_port(port)
                return False, "", 0, stderr or "docker run 失败"

            container_id = stdout.strip()
            logger.info(f"容器启动成功: {container_id}, name={container_name}, port={port}")
            return True, container_id, port, ""

        except PortExhaustedError as e:
            return False, "", 0, str(e)
        except FileNotFoundError:
            return False, "", 0, "Docker 未安装或不在 PATH 中"
        except Exception as e:
            logger.error(f"启动容器异常: {e}")
            if port is not None:
                try:
                    await self.release_port(port)
                except Exception:
                    pass
            return False, "", 0, str(e)

    async def stop_container(self, algorithm_uuid: str) -> bool:
        """
        停止算法容器

        Args:
            algorithm_uuid: 算法UUID

        Returns:
            是否成功
        """
        try:
            container_name = f"{CONTAINER_PREFIX}{algorithm_uuid[:8]}"

            cmd = ['docker', 'stop', container_name]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.warning(f"停止容器失败: {stderr.decode()}")
                return False

            logger.info(f"容器已停止: {container_name}")
            return True

        except Exception as e:
            logger.error(f"停止容器异常: {str(e)}")
            return False

    async def remove_container(self, algorithm_uuid: str) -> bool:
        """
        删除算法容器

        Args:
            algorithm_uuid: 算法UUID

        Returns:
            是否成功
        """
        try:
            container_name = f"{CONTAINER_PREFIX}{algorithm_uuid[:8]}"

            # 先停止再删除
            await self.stop_container(algorithm_uuid)

            cmd = ['docker', 'rm', '-f', container_name]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.warning(f"删除容器失败: {stderr.decode()}")
                return False

            logger.info(f"容器已删除: {container_name}")
            return True

        except Exception as e:
            logger.error(f"删除容器异常: {str(e)}")
            return False

    async def get_container_status(self, algorithm_uuid: str) -> Dict[str, Any]:
        """
        获取容器状态

        Args:
            algorithm_uuid: 算法UUID

        Returns:
            状态信息字典
        """
        try:
            container_name = f"{CONTAINER_PREFIX}{algorithm_uuid[:8]}"

            cmd = ['docker', 'inspect', '--format',
                   '{{.State.Status}}|{{.State.Health.Status}}|{{.Config.Env}}',
                   container_name]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                return {
                    "exists": False,
                    "status": "not_found"
                }

            result = stdout.decode().strip().split('|')
            status = result[0] if len(result) > 0 else "unknown"
            health = result[1] if len(result) > 1 else "unknown"

            return {
                "exists": True,
                "status": status,
                "health": health,
                "container_name": container_name
            }

        except Exception as e:
            logger.error(f"获取容器状态异常: {str(e)}")
            return {
                "exists": False,
                "status": "error",
                "error": str(e)
            }

    async def list_containers(self) -> List[str]:
        """列出所有算法容器"""
        try:
            cmd = ['docker', 'ps', '-a', '--filter', f'name={CONTAINER_PREFIX}',
                   '--format', '{{.Names}}']

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                return []

            containers = stdout.decode().strip().split('\n')
            return [c for c in containers if c]

        except Exception as e:
            logger.error(f"列出容器异常: {str(e)}")
            return []

    async def _is_port_in_use(self, port: int) -> bool:
        """检查端口是否已被占用（start_container 内部使用）。"""
        try:
            cmd = ['docker', 'ps', '--format', '{{.Ports}}']
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()
            ports_output = stdout.decode()

            return f':{port}->' in ports_output

        except Exception:
            return False

    async def _find_available_port(self) -> Optional[int]:
        """查找可用端口（start_container 内部使用）。"""
        import random
        for _ in range(20):
            port = random.randint(8001, 9100)
            if not await self._is_port_in_use(port):
                return port
        return None


# 全局单例
_container_manager = None


def get_container_manager() -> ContainerManager:
    """获取容器管理器单例"""
    global _container_manager
    if _container_manager is None:
        _container_manager = ContainerManager()
    return _container_manager