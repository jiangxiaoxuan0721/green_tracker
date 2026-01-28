#!/bin/bash

# PostgreSQL 一键安装脚本
# 用于在Ubuntu/Debian系统上安装和配置PostgreSQL

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}  PostgreSQL 一键安装脚本${NC}"
echo -e "${GREEN}===================================${NC}"

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}请使用sudo运行此脚本${NC}"
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

# 更新包列表
echo -e "${GREEN}更新包列表...${NC}"
apt update

# 安装PostgreSQL和PostGIS
echo -e "${GREEN}正在安装PostgreSQL和PostGIS...${NC}"
apt install -y postgresql postgresql-contrib postgis postgresql-16-postgis-3

# 启动PostgreSQL服务
echo -e "${GREEN}启动PostgreSQL服务...${NC}"
systemctl start postgresql
systemctl enable postgresql

# 检查PostgreSQL状态
echo -e "${GREEN}检查PostgreSQL服务状态...${NC}"
systemctl status postgresql --no-pager -l

# 检查PostgreSQL版本
PG_VERSION=$(sudo -u postgres psql -V | awk '{print $3}')
echo -e "${GREEN}PostgreSQL版本: $PG_VERSION${NC}"

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
else
    echo -e "${YELLOW}未找到.env文件，使用默认配置${NC}"
    DB_USER="green_tracker"
    DB_PASSWORD="green_tracker"
    DB_NAME="green_tracker"
fi

# 创建数据库用户和数据库
echo -e "${GREEN}创建数据库用户和数据库...${NC}"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || echo "用户可能已存在"

# 授予用户创建数据库的权限（重要：允许创建用户独立数据库）
echo -e "${GREEN}授予 $DB_USER 用户创建数据库的权限...${NC}"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEUSER;"

sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || echo "数据库可能已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# 授予schema权限
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"

# 创建PostGIS扩展
echo -e "${GREEN}创建PostGIS扩展...${NC}"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# 配置PostgreSQL认证方式为密码认证
echo -e "${GREEN}配置PostgreSQL认证方式...${NC}"
PG_CONF_DIR="/etc/postgresql/${PG_VERSION%.*}/main"
PG_HBA_CONF="$PG_CONF_DIR/pg_hba.conf"

# 备份原始配置文件
if [ -f "$PG_HBA_CONF" ]; then
    cp "$PG_HBA_CONF" "$PG_HBA_CONF.backup"
    echo "已备份原始配置文件到 $PG_HBA_CONF.backup"
    
    # 将本地连接的认证方式从peer改为md5
    sed -i 's/^local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA_CONF"
    
    # 重启PostgreSQL服务以应用更改
    echo -e "${GREEN}重启PostgreSQL服务以应用配置更改...${NC}"
    systemctl restart postgresql
    
    # 验证配置是否生效
    echo -e "${GREEN}验证数据库连接配置...${NC}"
    if sudo -u postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_user;" 2>/dev/null | grep -q "$DB_USER"; then
        echo -e "${GREEN}数据库配置验证成功！${NC}"
    else
        echo -e "${YELLOW}警告: 数据库配置验证可能存在问题，但服务已启动${NC}"
    fi
else
    echo -e "${YELLOW}警告: 未找到PostgreSQL配置文件，请手动配置认证方式${NC}"
fi

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}PostgreSQL安装完成！${NC}"
echo -e "${GREEN}===================================${NC}"
echo "数据库配置："
echo "主机: localhost"
echo "端口: $DB_PORT"
echo "用户: $DB_USER"
echo "密码: $DB_PASSWORD"
echo "数据库: $DB_NAME"
echo ""
echo "连接命令："
echo "psql -h localhost -U $DB_USER -d $DB_NAME"
echo ""
echo -e "${GREEN}PostgreSQL已安装并启动${NC}"
