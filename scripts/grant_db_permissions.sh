#!/bin/bash

# ============================================================================
# 授权脚本 - 授予 green_tracker 用户创建数据库的权限
# ============================================================================
# 此脚本用于在已安装的 PostgreSQL 系统上授予用户必要的权限
# 适用于：系统已安装但用户权限不足的情况
# ============================================================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  数据库用户授权脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误: 请使用 sudo 运行此脚本${NC}"
    echo ""
    echo -e "执行命令: ${YELLOW}sudo $0${NC}"
    echo ""
    exit 1
fi

# 获取项目根目录路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# 读取.env文件中的配置
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    DB_USER=${DB_USER:-"green_tracker"}
    DB_PASSWORD=${DB_PASSWORD:-"green_tracker"}
    DB_NAME=${DB_NAME:-"green_tracker"}
    DB_PORT=${DB_PORT:-"5433"}
else
    echo -e "${YELLOW}未找到.env文件，使用默认配置${NC}"
    DB_USER="green_tracker"
    DB_PASSWORD="green_tracker"
    DB_NAME="green_tracker"
    DB_PORT="5433"
fi

echo -e "${GREEN}配置信息:${NC}"
echo "  数据库用户: $DB_USER"
echo "  数据库名称: $DB_NAME"
echo "  端口: $DB_PORT"
echo ""

# 检查PostgreSQL服务是否运行
echo -e "${GREEN}检查 PostgreSQL 服务状态...${NC}"
if ! systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}PostgreSQL 服务未运行，正在启动...${NC}"
    systemctl start postgresql
    sleep 2
fi

if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ PostgreSQL 服务正在运行${NC}"
else
    echo -e "${RED}✗ PostgreSQL 服务启动失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}授予 $DB_USER 用户创建数据库的权限...${NC}"

# 授予 CREATEDB 权限
if sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null; then
    echo -e "${GREEN}✓ 已授予 $DB_USER 用户 CREATEDB 权限${NC}"
else
    echo -e "${RED}✗ 授予 CREATEDB 权限失败${NC}"
    echo -e "${YELLOW}  用户 $DB_USER 可能不存在，正在创建...${NC}"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    echo -e "${GREEN}✓ 已创建用户 $DB_USER 并授予 CREATEDB 权限${NC}"
fi

# 授予 SUPERUSER 权限（创建 PostGIS 扩展需要）
if sudo -u postgres psql -c "ALTER USER $DB_USER SUPERUSER;" 2>/dev/null; then
    echo -e "${GREEN}✓ 已授予 $DB_USER 用户 SUPERUSER 权限${NC}"
else
    echo -e "${YELLOW}警告: 授予 SUPERUSER 权限失败（可能已存在）${NC}"
fi

# 授予 CREATEUSER 权限
if sudo -u postgres psql -c "ALTER USER $DB_USER CREATEUSER;" 2>/dev/null; then
    echo -e "${GREEN}✓ 已授予 $DB_USER 用户 CREATEUSER 权限${NC}"
else
    echo -e "${YELLOW}警告: 授予 CREATEUSER 权限失败（可能已存在）${NC}"
fi

# 验证权限
echo ""
echo -e "${GREEN}验证用户权限...${NC}"
USER_INFO=$(sudo -u postgres psql -t -c "\du $DB_USER" 2>/dev/null)
if echo "$USER_INFO" | grep -q "Create"; then
    echo -e "${GREEN}✓ 权限验证成功！用户 $DB_USER 具有创建数据库的权限${NC}"
else
    echo -e "${YELLOW}警告: 无法验证用户权限，但已尝试授权${NC}"
fi

# 如果数据库不存在，创建它
echo ""
echo -e "${GREEN}检查并创建数据库...${NC}"
DB_EXISTS=$(sudo -u postgres psql -t -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | xargs)
if [ "$DB_EXISTS" != "1" ]; then
    echo -e "${YELLOW}数据库 $DB_NAME 不存在，正在创建...${NC}"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
    echo -e "${GREEN}✓ 数据库 $DB_NAME 创建成功${NC}"
else
    echo -e "${GREEN}✓ 数据库 $DB_NAME 已存在${NC}"
fi

# 创建PostGIS扩展
echo ""
echo -e "${GREEN}创建 PostGIS 扩展...${NC}"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>/dev/null && \
    echo -e "${GREEN}✓ PostGIS 扩展创建成功${NC}" || \
    echo -e "${YELLOW}警告: PostGIS 扩展创建失败（可能已安装或不支持）${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  授权完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}当前权限状态:${NC}"
sudo -u postgres psql -c "\du $DB_USER"
echo ""
echo -e "${GREEN}可用数据库:${NC}"
sudo -u postgres psql -c "\l" | grep -E "(Name|Owner|$DB_NAME)"
echo ""
echo -e "下一步:"
echo -e "  1. 运行初始化脚本: ${YELLOW}cd /home/jiangxiaoxuan/workspace/green_tracker && bash scripts/init_new_architecture.sh${NC}"
echo -e "  2. 启动后端服务: ${YELLOW}cd backend && python main.py${NC}"
echo ""
