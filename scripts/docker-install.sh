#!/bin/bash

# Docker 一键安装脚本
# 用于在Ubuntu/Debian系统上安装Docker和Docker Compose
# 用途: 为Green Tracker算法镜像构建提供Docker支持

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Docker 一键安装脚本${NC}"
echo -e "${GREEN}  为Green Tracker算法构建提供支持${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用sudo运行此脚本${NC}"
    echo "示例: sudo bash scripts/docker-install.sh"
    exit 1
fi

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}无法检测操作系统版本${NC}"
    exit 1
fi

echo -e "${GREEN}检测到操作系统: $OS $VERSION${NC}"
echo ""

# 检查Docker是否已安装
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | sed 's/,//')
    echo -e "${YELLOW}Docker已安装: $DOCKER_VERSION${NC}"

    # 检查Docker服务是否运行
    if systemctl is-active --quiet docker; then
        echo -e "${GREEN}Docker服务正在运行${NC}"
    else
        echo -e "${YELLOW}Docker已安装但服务未运行，正在启动...${NC}"
        systemctl start docker
        systemctl enable docker
    fi

    # 检查当前用户是否在docker组
    if groups $SUDO_USER | grep -q '\bdocker\b'; then
        echo -e "${GREEN}当前用户已在docker组，无需额外配置${NC}"
    else
        echo -e "${YELLOW}正在将当前用户添加到docker组...${NC}"
        usermod -aG docker $SUDO_USER
        echo -e "${GREEN}已添加用户到docker组（退出重新登录后生效）${NC}"
    fi

    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}Docker安装检查完成！${NC}"
    echo -e "${GREEN}=====================================${NC}"
    exit 0
fi

echo -e "${GREEN}开始安装Docker...${NC}"
echo ""

# 卸载旧版本Docker（如果存在）
echo -e "${YELLOW}检查并移除旧版本Docker...${NC}"
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# 更新包列表
echo -e "${GREEN}更新包列表...${NC}"
apt-get update

# 安装基础依赖包
echo -e "${GREEN}安装基础依赖包...${NC}"
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    apt-transport-https \
    ca-certificates \
    software-properties-common

# 添加Docker官方GPG密钥
echo -e "${GREEN}添加Docker官方GPG密钥...${NC}"
mkdir -p /etc/apt/keyrings
if [ -f /etc/apt/keyrings/docker.gpg ]; then
    echo "Docker GPG密钥已存在"
else
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
fi

# 添加Docker仓库
echo -e "${GREEN}添加Docker仓库...${NC}"
if [ "$OS" = "ubuntu" ]; then
    # Ubuntu
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
elif [ "$OS" = "debian" ]; then
    # Debian
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
fi

# 更新包列表
echo -e "${GREEN}更新包列表...${NC}"
apt-get update

# 安装Docker CE
echo -e "${GREEN}安装Docker CE...${NC}"
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动Docker服务
echo -e "${GREEN}启动Docker服务...${NC}"
systemctl start docker
systemctl enable docker

# 检查Docker是否安装成功
if command -v docker &> /dev/null; then
    echo -e "${GREEN}Docker安装成功！${NC}"
else
    echo -e "${RED}Docker安装失败${NC}"
    exit 1
fi

# 获取当前用户
CURRENT_USER=${SUDO_USER:-$(whoami)}

# 将用户添加到docker组（避免每次使用sudo）
echo -e "${GREEN}将用户添加到docker组...${NC}"
usermod -aG docker $CURRENT_USER

# 设置Docker服务开机自启
systemctl enable docker

# 创建Docker配置目录
mkdir -p /etc/docker

# 获取项目根目录路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# 检查并更新.env文件中的Docker配置
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
ALGORITHM_PORT_START=${ALGORITHM_PORT_START:-8000}
ALGORITHM_PORT_END=${ALGORITHM_PORT_END:-9000}

# 验证Docker安装
echo ""
echo -e "${GREEN}验证Docker安装...${NC}"
docker --version
docker compose version

echo ""
echo -e "${BLUE}测试Docker运行状态...${NC}"
docker ps 2>/dev/null || echo -e "${YELLOW}Docker守护进程可能需要重新登录后生效${NC}"

# 获取Docker版本信息
DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | sed 's/,//')
COMPOSE_VERSION=$(docker compose version 2>/dev/null | awk '{print $4}')

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Docker安装完成！${NC}"
echo -e "${GREEN}=====================================${NC}"
echo "Docker版本: $DOCKER_VERSION"
echo "Docker Compose版本: $COMPOSE_VERSION"
echo ""
echo -e "${YELLOW}重要提示：${NC}"
echo "1. 用户已添加到docker组，退出SSH后重新登录即可生效"
echo "2. 如果需要立即生效，可以运行: newgrp docker"
echo "3. Docker守护进程将在重启后自动启动"
echo ""
echo -e "${BLUE}验证Docker可用性：${NC}"
echo "  运行: sudo docker run hello-world"
echo ""

# 更新.env.example添加Docker配置
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
if [ -f "$ENV_EXAMPLE" ]; then
    if ! grep -q "DOCKER_REGISTRY" "$ENV_EXAMPLE"; then
        echo "" >> "$ENV_EXAMPLE"
        echo "# =============================================================================" >> "$ENV_EXAMPLE"
        echo "# Docker配置 (算法镜像构建)" >> "$ENV_EXAMPLE"
        echo "# =============================================================================" >> "$ENV_EXAMPLE"
        echo "" >> "$ENV_EXAMPLE"
        echo "# Docker镜像仓库地址（用于存储算法镜像）" >> "$ENV_EXAMPLE"
        echo "# 生产环境建议使用私有镜像仓库" >> "$ENV_EXAMPLE"
        echo "DOCKER_REGISTRY=localhost:5000" >> "$ENV_EXAMPLE"
        echo "" >> "$ENV_EXAMPLE"
        echo "# 算法容器端口范围" >> "$ENV_EXAMPLE"
        echo "ALGORITHM_PORT_START=8000" >> "$ENV_EXAMPLE"
        echo "ALGORITHM_PORT_END=9000" >> "$ENV_EXAMPLE"
        echo "" >> "$ENV_EXAMPLE"
        echo "# 镜像清理策略" >> "$ENV_EXAMPLE"
        echo "# DOCKER_CLEANUP_DAYS=30  # 自动清理超过指定天数的旧镜像" >> "$ENV_EXAMPLE"
        echo "" >> "$ENV_EXAMPLE"
        echo -e "${GREEN}已更新.env.example文件添加Docker配置项${NC}"
    fi
fi

echo -e "${GREEN}安装脚本执行完毕！${NC}"
