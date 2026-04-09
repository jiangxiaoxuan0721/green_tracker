"""
Dockerfile 生成器 - 根据算法包自动生成 Dockerfile
"""

import os
import yaml
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# 基础镜像映射
BASE_IMAGES = {
    "pytorch": "pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime",
    "tensorflow": "tensorflow/tensorflow:2.13.0-gpu",
    "onnx": "onnx/onnxruntime:latest",
    "opencv": "python:3.9-slim",
    "python": "python:3.9-slim"
}

# 端口范围
CONTAINER_PORT_START = 8001
CONTAINER_PORT_END = 8100


class DockerfileGenerator:
    """Dockerfile 生成器"""

    def __init__(self):
        self.port_counter = CONTAINER_PORT_START

    def get_next_port(self) -> int:
        """获取下一个可用端口"""
        port = self.port_counter
        if self.port_counter < CONTAINER_PORT_END:
            self.port_counter += 1
        return port

    def reset_port_counter(self):
        """重置端口计数器"""
        self.port_counter = CONTAINER_PORT_START

    def generate_dockerfile(
        self,
        algorithm_dir: str,
        algorithm_uuid: str,
        framework: str = "python"
    ) -> Tuple[str, None]:
        """
        生成 Dockerfile 内容
        
        Args:
            algorithm_dir: 算法解压后的目录
            algorithm_uuid: 算法UUID
            framework: 框架类型
        
        Returns:
            Dockerfile 内容字符串
        """
        # 选择基础镜像
        base_image = BASE_IMAGES.get(framework, BASE_IMAGES["python"])

        # 解析 algorithm.yaml 获取依赖
        requirements = self._parse_requirements(algorithm_dir)

        # 生成 Dockerfile
        dockerfile = f"""# 自动生成的 Dockerfile
# 算法: {algorithm_uuid}
# 框架: {framework}

FROM {base_image}

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONUNBUFFERED=1

# 安装系统依赖
RUN apt-get update && apt-get install -y \\
    curl \\
    libgl1-mesa-glx \\
    libglib2.0-0 \\
    && rm -rf /var/lib/apt/lists/*

# 复制算法代码
COPY . /app/

# 安装 Python 依赖
RUN if [ -f /app/requirements.txt ]; then \\
    pip install --no-cache-dir -r requirements.txt; \\
    fi

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# 安装 curl（用于健康检查）
RUN if ! command -v curl &> /dev/null; then \\
    apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*; \\
    fi

# 启动命令 - 容器内部端口固定为8000
CMD ["python", "-m", "uvicorn", "src.predict:app", "--host", "0.0.0.0", "--port", "8000"]
"""
        logger.info(f"生成 Dockerfile，容器内部端口固定为8000")
        return dockerfile, None  # 不再返回端口，容器内部固定为8000

    def _parse_requirements(self, algorithm_dir: str) -> Dict[str, Any]:
        """解析算法目录获取依赖信息"""
        requirements = {
            "packages": [],
            "framework": "python"
        }

        # 读取 algorithm.yaml
        yaml_path = os.path.join(algorithm_dir, "algorithm.yaml")
        if os.path.exists(yaml_path):
            try:
                with open(yaml_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    if config:
                        requirements['framework'] = config.get('framework', 'python')
                        requirements['input_type'] = config.get('input', {}).get('type', 'image')
                        requirements['output_type'] = config.get('output', {}).get('type', 'json')
                        requirements['name'] = config.get('name', 'Algorithm')
                        requirements['version'] = config.get('version', '1.0.0')
            except Exception as e:
                logger.warning(f"解析 algorithm.yaml 失败: {e}")

        return requirements

    def generate_docker_compose(
        self,
        algorithm_name: str,
        algorithm_uuid: str,
        docker_image: str,
        port: int,
        environment: Optional[Dict[str, str]] = None
    ) -> str:
        """
        生成 docker-compose.yml
        
        Args:
            algorithm_name: 算法名称
            algorithm_uuid: 算法UUID
            docker_image: 镜像名称
            port: 端口
            environment: 环境变量
        
        Returns:
            docker-compose.yml 内容
        """
        env_str = ""
        if environment:
            env_items = [f"      {k}: {v}" for k, v in environment.items()]
            env_str = "\n".join(env_items)

        compose = f"""version: '3.8'

services:
  {algorithm_uuid}:
    image: {docker_image}
    container_name: algorithm_{algorithm_uuid[:8]}
    ports:
      - "{port}:8000"
    environment:
{env_str}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 1G
"""
        return compose


# 全局单例
_dockerfile_generator = None


def get_dockerfile_generator() -> DockerfileGenerator:
    """获取 Dockerfile 生成器单例"""
    global _dockerfile_generator
    if _dockerfile_generator is None:
        _dockerfile_generator = DockerfileGenerator()
    return _dockerfile_generator