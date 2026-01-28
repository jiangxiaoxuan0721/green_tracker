#!/bin/bash

# 快速测试脚本
# 快速验证 PostgreSQL 连接和配置

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  快速配置验证${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 加载环境变量
if [ -f ".env" ]; then
    source .env
    echo -e "${GREEN}✓ .env 文件加载成功${NC}"
else
    echo -e "${RED}✗ .env 文件不存在${NC}"
    exit 1
fi

# 显示配置
echo ""
echo -e "${YELLOW}数据库配置:${NC}"
echo "  主机: ${DB_HOST}"
echo "  端口: ${DB_PORT}"
echo "  用户: ${DB_USER}"
echo "  数据库: ${DB_NAME}"
echo "  超级用户: ${DB_SUPERUSER}"
echo "  使用 Unix Socket: ${USE_UNIX_SOCKET}"
echo ""

# 测试 PostgreSQL 连接
echo -e "${YELLOW}测试 PostgreSQL 连接...${NC}"
if PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL 连接成功${NC}"
else
    echo -e "${RED}✗ PostgreSQL 连接失败${NC}"
    echo -e "${YELLOW}请检查:${NC}"
    echo "  1. PostgreSQL 服务是否运行"
    echo "  2. 端口是否正确"
    echo "  3. 用户名和密码是否正确"
    exit 1
fi

# 测试超级用户连接
echo -e "${YELLOW}测试超级用户连接...${NC}"
if PGPASSWORD=${DB_SUPERPASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_SUPERUSER} -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 超级用户连接成功${NC}"
else
    echo -e "${YELLOW}⚠ 超级用户连接失败（可能不影响使用）${NC}"
fi

# 检查用户权限
echo -e "${YELLOW}检查用户权限...${NC}"
USER_INFO=$(PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_SUPERUSER} -d postgres -t -c "\du ${DB_USER}" 2>/dev/null)
if echo "$USER_INFO" | grep -q "Create DB"; then
    echo -e "${GREEN}✓ 用户 ${DB_USER} 有 CREATEDB 权限${NC}"
else
    echo -e "${RED}✗ 用户 ${DB_USER} 没有 CREATEDB 权限${NC}"
    echo -e "${YELLOW}请运行: sudo bash scripts/grant_db_permissions.sh${NC}"
fi

if echo "$USER_INFO" | grep -q "Superuser"; then
    echo -e "${GREEN}✓ 用户 ${DB_USER} 有 SUPERUSER 权限${NC}"
else
    echo -e "${YELLOW}⚠ 用户 ${DB_USER} 没有 SUPERUSER 权限${NC}"
    echo -e "${YELLOW}如果使用模板数据库方案，这是正常的${NC}"
fi

# 检查模板数据库（如果存在）
echo -e "${YELLOW}检查模板数据库...${NC}"
TEMPLATE_EXISTS=$(PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_SUPERUSER} -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='green_tracker_template'" 2>/dev/null | xargs)
if [ "$TEMPLATE_EXISTS" == "1" ]; then
    echo -e "${GREEN}✓ 模板数据库存在${NC}"
    
    # 检查 PostGIS 扩展
    EXTENSIONS=$(PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_SUPERUSER} -d green_tracker_template -t -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'uuid-ossp', 'pg_trgm');" 2>/dev/null)
    echo -e "${YELLOW}  模板数据库中的扩展:${NC}"
    echo "$EXTENSIONS" | while read ext; do
        echo -e "${GREEN}    - $ext${NC}"
    done
else
    echo -e "${YELLOW}⚠ 模板数据库不存在${NC}"
    echo -e "${YELLOW}请运行: sudo bash scripts/init_template_database.sh${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  配置验证完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo -e "  1. 运行数据库创建测试: ${GREEN}python tests/test_database_creation.py${NC}"
echo -e "  2. 启动后端服务: ${GREEN}cd backend && python main.py${NC}"
echo -e "  3. 运行完整注册测试: ${GREEN}python tests/test_registration_flow.py${NC}"
echo ""
