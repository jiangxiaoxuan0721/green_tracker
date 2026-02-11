#!/bin/bash

# 停止所有服务脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}===================================${NC}"
echo -e "${RED}  停止所有服务${NC}"
echo -e "${RED}===================================${NC}"

# 停止MinIO
echo -e "${RED}正在停止MinIO...${NC}"
bash "$SCRIPT_DIR/minio.sh" stop

# 停止后端服务
echo -e "${RED}正在停止后端服务...${NC}"
if pkill -f "uvicorn.*main:app"; then
    echo -e "${RED}✓ 后端服务已停止${NC}"
else
    echo "  后端服务未运行"
fi

# 停止PostgreSQL（可选）
echo ""
echo -e "${YELLOW}是否要停止PostgreSQL服务? [y/N]${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    if sudo systemctl stop postgresql 2>/dev/null; then
        echo -e "${RED}✓ PostgreSQL服务已停止${NC}"
    else
        echo -e "${RED}✗ PostgreSQL服务停止失败${NC}"
    fi
else
    echo "  PostgreSQL服务保持运行"
fi

echo ""
echo -e "${RED}所有服务已停止${NC}"
