"""
容器管理服务 - 管理算法容器的生命周期
"""

import os
import logging
import asyncio
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# 容器配置
CONTAINER_PREFIX = "green_tracker_algorithm_"
MAX_CONTAINERS = 100


class ContainerManager:
    """算法容器管理器"""

    def __init__(self):
        self.registry = os.getenv("DOCKER_REGISTRY", "localhost:5000")

    async def start_container(
        self,
        algorithm_uuid: str,
        image_name: str,
        port: int,
        env: Optional[Dict[str, str]] = None
    ) -> Tuple[bool, str, int, str]:
        """
        启动算法容器
        
        Args:
            algorithm_uuid: 算法UUID
            image_name: 镜像名称
            port: 端口（可能会被修改如果端口被占用）
            env: 环境变量
        
        Returns:
            (成功标志, 容器ID, 实际端口, 错误信息)
        """
        try:
            container_name = f"{CONTAINER_PREFIX}{algorithm_uuid[:8]}"

            # 构建环境变量
            env_list = [f"-e {k}={v}" for k, v in (env or {}).items()]
            env_list.append(f"-e ALGORITHM_UUID={algorithm_uuid}")

            # 检查端口是否已被占用
            original_port = port  # 保存原始端口用于日志
            if await self._is_port_in_use(port):
                logger.warning(f"端口 {port} 已被占用，尝试寻找新端口")
                port = await self._find_available_port()
                if not port:
                    return False, "", 0, "无可用端口"

            # 构建 docker run 命令
            # 始终暴露 8000 端口（算法容器内固定端口）
            # 容器内部使用 8000，与主机映射解耦
            cmd = [
                'docker', 'run', '-d',
                '--name', container_name,
                '--restart', 'unless-stopped',
                '-p', f'{port}:8000',  # 主机端口 -> 容器 8000
            ] + env_list + [
                '--memory', '4g',
                '--memory-swap', '4g',
                image_name
            ]

            logger.info(f"启动容器: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "未知错误"
                logger.error(f"容器启动失败: {error_msg}")
                return False, "", port, error_msg

            container_id = stdout.decode().strip()
            logger.info(f"容器启动成功: {container_id}, 实际端口: {port} (原始端口: {original_port})")

            # 等待容器内服务启动（最多等待30秒）
            # 注意：容器内部是8000，但对外映射到主机端口 {port}
            logger.info(f"等待容器服务启动...")
            import httpx
            health_url = f"http://localhost:{port}/health"  # 使用主机端口访问容器服务
            for i in range(30):
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        resp = await client.get(health_url)
                        if resp.status_code == 200:
                            logger.info(f"容器服务健康检查通过")
                            return True, container_id, port, ""
                except Exception as e:
                    if i % 5 == 0:  # 每5秒记录一次日志
                        logger.debug(f"容器健康检查尝试 {i+1}/30 失败: {str(e)}")
                await asyncio.sleep(1)

            # 如果健康检查失败，返回警告但仍然认为启动成功
            logger.warning(f"容器已启动但健康检查未通过，请检查容器日志")
            return True, container_id, port, ""

        except FileNotFoundError:
            return False, "", port, "Docker未安装或不在PATH中"
        except Exception as e:
            logger.error(f"启动容器异常: {str(e)}")
            return False, "", port, str(e)

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
        """检查端口是否已被占用"""
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
        """查找可用端口"""
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