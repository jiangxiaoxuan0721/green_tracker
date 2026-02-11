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

# 检查PostgreSQL服务状态
echo -e "${GREEN}检查PostgreSQL服务状态...${NC}"
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ PostgreSQL服务正在运行${NC}"
else
    echo -e "${GREEN}启动PostgreSQL服务...${NC}"
    sudo systemctl start postgresql
    sleep 2
    if systemctl is-active --quiet postgresql; then
        echo -e "${GREEN}✓ PostgreSQL服务启动成功${NC}"
    else
        echo -e "${GREEN}✗ PostgreSQL服务启动失败${NC}"
        exit 1
    fi
fi

# 初始化数据库（如果需要）
echo -e "${GREEN}检查数据库初始化状态...${NC}"
"$SCRIPT_DIR/init_all.sh"

# 启动MinIO
echo -e "${GREEN}正在启动MinIO...${NC}"
"$SCRIPT_DIR/minio.sh" start

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
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ PostgreSQL服务正在运行${NC}"
    PGPASSWORD=green_tracker psql -h localhost -p 5433 -U green_tracker -d green_tracker -c "SELECT current_database();" 2>/dev/null | grep green_tracker && echo "  数据库连接正常" || echo "  警告: 数据库连接失败"
else
    echo -e "${RED}✗ PostgreSQL服务未运行${NC}"
fi

echo ""
# MinIO状态
echo "MinIO状态："
"$SCRIPT_DIR/minio.sh" status

echo ""
echo -e "${GREEN}所有服务启动完成！${NC}"
echo -e "${GREEN}您现在可以启动后端和前端服务了${NC}"
