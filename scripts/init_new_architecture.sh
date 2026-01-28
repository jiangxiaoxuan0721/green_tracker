#!/bin/bash
# ==============================================================================
# 初始化新架构脚本
# ==============================================================================
# 此脚本执行以下操作：
# 1. 初始化元数据库
# 2. 初始化模板数据库（可选）
# 3. 验证数据库配置
# ==============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  初始化新数据库架构${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 设置 PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"

echo -e "${YELLOW}步骤 1: 初始化元数据库${NC}"
python -c "from database.database_initializer import init_meta; init_meta()"
echo ""

echo -e "${YELLOW}步骤 2: 初始化模板数据库${NC}"
python -c "from database.database_initializer import init_template; init_template()"
echo ""

echo -e "${YELLOW}步骤 3: 验证数据库${NC}"
python -c "from database.database_initializer import verify; verify()"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  初始化完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "下一步:"
echo -e "  1. 启动后端服务: ${YELLOW}cd backend && python main.py${NC}"
echo -e "  2. 测试用户注册（会自动创建用户数据库）"
echo -e "  3. 访问数据库管理 API: ${YELLOW}GET /api/admin/database/list${NC}"
echo ""

