#!/bin/bash

# 停止所有服务脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}===================================${NC}"
echo -e "${RED}  停止所有服务${NC}"
echo -e "${RED}===================================${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 停止MinIO
echo -e "${RED}正在停止MinIO...${NC}"
if [ "$(docker ps -q -f name=minio)" ]; then
    docker stop minio
    docker rm minio
    echo -e "${RED}MinIO已停止${NC}"
else
    echo "MinIO容器未运行"
fi

# 停止PostgreSQL
echo -e "${RED}正在停止PostgreSQL...${NC}"
"$SCRIPT_DIR/manage-postgres.sh" stop

echo -e "${RED}所有服务已停止${NC}"
