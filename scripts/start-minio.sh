#!/bin/bash

# MinIO启动脚本
# 用于启动MinIO服务

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 配置变量
CONTAINER_NAME="minio"
MINIO_DATA_DIR="$HOME/minio-data"
API_PORT=9000
CONSOLE_PORT=9001

# 获取项目根目录路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# 从.env文件读取MinIO配置
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    MINIO_USER=${MINIO_ACCESS_KEY:-"minioadmin"}
    MINIO_PASSWORD=${MINIO_SECRET_KEY:-"minioadmin123"}
else
    echo "错误：未找到.env文件，请先创建.env文件并配置MinIO参数"
    echo "参考.env.example文件创建.env文件"
    echo "期望的.env文件路径: $ENV_FILE"
    exit 1
fi

echo -e "${GREEN}正在启动MinIO服务...${NC}"

# 创建数据目录（如果不存在）
if [ ! -d "$MINIO_DATA_DIR" ]; then
    echo "创建MinIO数据目录: $MINIO_DATA_DIR"
    mkdir -p "$MINIO_DATA_DIR"
fi

# 检查容器是否已存在
if [ "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
    echo "容器 $CONTAINER_NAME 已存在，正在停止并删除..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# 启动MinIO容器
echo "启动MinIO容器..."
docker run -d \
  -p $API_PORT:$API_PORT \
  -p $CONSOLE_PORT:$CONSOLE_PORT \
  --name $CONTAINER_NAME \
  -e "MINIO_ROOT_USER=$MINIO_USER" \
  -e "MINIO_ROOT_PASSWORD=$MINIO_PASSWORD" \
  -v $MINIO_DATA_DIR:/data \
  minio/minio server /data --console-address ":$CONSOLE_PORT"

echo -e "${GREEN}MinIO服务已启动！${NC}"
echo -e "${GREEN}API端点: http://localhost:$API_PORT${NC}"
echo -e "${GREEN}控制台: http://localhost:$CONSOLE_PORT${NC}"
echo -e "${GREEN}用户名: $MINIO_USER${NC}"
echo -e "${GREEN}密码: $MINIO_PASSWORD${NC}"

# 更新.env文件中的MinIO配置
echo "更新.env文件中的MinIO配置..."
if grep -q "MINIO_ENDPOINT=" "$ENV_FILE"; then
    sed -i "s/MINIO_ENDPOINT=.*/MINIO_ENDPOINT=localhost/" "$ENV_FILE"
else
    echo "" >> "$ENV_FILE"
    echo "# MinIO配置" >> "$ENV_FILE"
    echo "MINIO_ENDPOINT=localhost" >> "$ENV_FILE"
fi

if grep -q "MINIO_PORT=" "$ENV_FILE"; then
    sed -i "s/MINIO_PORT=.*/MINIO_PORT=$API_PORT/" "$ENV_FILE"
else
    echo "MINIO_PORT=$API_PORT" >> "$ENV_FILE"
fi

if grep -q "MINIO_ACCESS_KEY=" "$ENV_FILE"; then
    sed -i "s/MINIO_ACCESS_KEY=.*/MINIO_ACCESS_KEY=$MINIO_USER/" "$ENV_FILE"
else
    echo "MINIO_ACCESS_KEY=$MINIO_USER" >> "$ENV_FILE"
fi

if grep -q "MINIO_SECRET_KEY=" "$ENV_FILE"; then
    sed -i "s/MINIO_SECRET_KEY=.*/MINIO_SECRET_KEY=$MINIO_PASSWORD/" "$ENV_FILE"
else
    echo "MINIO_SECRET_KEY=$MINIO_PASSWORD" >> "$ENV_FILE"
fi

if grep -q "MINIO_BUCKET_NAME=" "$ENV_FILE"; then
    sed -i "s/MINIO_BUCKET_NAME=.*/MINIO_BUCKET_NAME=green-tracker-assets/" "$ENV_FILE"
else
    echo "MINIO_BUCKET_NAME=green-tracker-assets" >> "$ENV_FILE"
fi

echo -e "${GREEN}MinIO配置已更新到.env文件！${NC}"
