#!/bin/bash
# 一键初始化数据库并启动服务

set -e  # 遇到错误立即退出

echo "========================================="
echo "Green Tracker 一键初始化脚本"
echo "========================================="

# 切换到项目根目录
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo ""
echo "[1/4] 进入后端目录..."
cd "$PROJECT_ROOT/backend"

echo ""
echo "[2/4] 初始化元数据库..."
python -c "
from database.database_initializer import DatabaseInitializer
import logging
logging.basicConfig(level=logging.INFO)
DatabaseInitializer.init_meta_database()
"
if [ $? -eq 0 ]; then
    echo "✓ 元数据库初始化成功"
else
    echo "✗ 元数据库初始化失败"
    exit 1
fi

echo ""
echo "[3/4] 初始化模板数据库..."
python -c "
from database.database_initializer import DatabaseInitializer
import logging
logging.basicConfig(level=logging.INFO)
DatabaseInitializer.init_template_database()
"
if [ $? -eq 0 ]; then
    echo "✓ 模板数据库初始化成功"
else
    echo "✗ 模板数据库初始化失败"
    exit 1
fi

echo ""
echo "[4/4] 启动后端服务..."
# 停止已运行的服务
pkill -f "uvicorn.*main:app" 2>/dev/null || true
sleep 1

# 启动服务
nohup python -m uvicorn main:app --host 0.0.0.0 --port 6130 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

# 检查服务是否启动成功
if ps -p $BACKEND_PID > /dev/null; then
    echo "✓ 后端服务启动成功 (PID: $BACKEND_PID)"
    echo ""
    echo "========================================="
    echo "初始化完成！"
    echo "========================================="
    echo ""
    echo "后端服务地址: http://localhost:6130"
    echo "健康检查: http://localhost:6130/health"
    echo ""
    echo "查看日志: tail -f /tmp/backend.log"
    echo "停止服务: pkill -f 'uvicorn.*main:app'"
    echo ""
else
    echo "✗ 后端服务启动失败"
    echo "查看错误日志:"
    tail -50 /tmp/backend.log
    exit 1
fi
