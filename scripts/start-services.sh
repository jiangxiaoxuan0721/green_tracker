#!/bin/bash

# 一键启动所有必要服务
# 用于启动PostgreSQL和MinIO服务

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}  绿色追踪系统服务启动脚本${NC}"
echo -e "${GREEN}===================================${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到项目根目录
cd "$PROJECT_DIR"

# 启动PostgreSQL
echo -e "${GREEN}正在启动PostgreSQL...${NC}"
"$SCRIPT_DIR/postgres-docker.sh" start

# 等待PostgreSQL启动
echo "等待PostgreSQL启动完成..."
sleep 5

# 初始化数据库（如果需要）
echo -e "${GREEN}检查数据库初始化状态...${NC}"
"$SCRIPT_DIR/init-db.sh"

# 启动MinIO
echo -e "${GREEN}正在启动MinIO...${NC}"
"$SCRIPT_DIR/start-minio.sh"

# 等待MinIO启动
echo "等待MinIO启动完成..."
sleep 5

# 显示服务状态
echo ""
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}  服务状态${NC}"
echo -e "${GREEN}===================================${NC}"

# PostgreSQL状态
echo "PostgreSQL状态："
"$SCRIPT_DIR/postgres-docker.sh" status

echo ""
# MinIO状态
echo "MinIO状态："
if [ "$(docker ps -q -f name=minio)" ]; then
    echo -e "${GREEN}MinIO容器正在运行${NC}"
    echo "API: http://localhost:9000"
    echo "控制台: http://localhost:9001"
    
    # 获取项目根目录路径
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    ENV_FILE="$PROJECT_DIR/.env"
    
    # 从环境变量读取用户名和密码（如果存在）
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
        echo "用户名: ${MINIO_ACCESS_KEY:-"minioadmin"}"
        echo "密码: [已隐藏，请查看.env文件中的MINIO_SECRET_KEY]"
    else
        echo "用户名: [请查看.env文件中的MINIO_ACCESS_KEY]"
        echo "密码: [已隐藏，请查看.env文件中的MINIO_SECRET_KEY]"
    fi
else
    echo -e "${RED}MinIO容器未运行${NC}"
fi

echo ""
echo -e "${GREEN}所有服务启动完成！${NC}"
echo -e "${GREEN}您现在可以启动后端和前端服务了${NC}"
