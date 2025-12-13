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
"$SCRIPT_DIR/manage-postgres.sh" start

# 等待PostgreSQL启动
echo "等待PostgreSQL启动完成..."
sleep 3

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
sudo systemctl status postgresql --no-pager -l --lines=2

echo ""
# MinIO状态
echo "MinIO状态："
if [ "$(docker ps -q -f name=minio)" ]; then
    echo -e "${GREEN}MinIO容器正在运行${NC}"
    echo "API: http://localhost:9000"
    echo "控制台: http://localhost:9001"
    echo "用户名: minioadmin"
    echo "密码: minioadmin123"
else
    echo -e "${RED}MinIO容器未运行${NC}"
fi

echo ""
echo -e "${GREEN}所有服务启动完成！${NC}"
echo -e "${GREEN}您现在可以启动后端和前端服务了${NC}"
