#!/bin/bash
# MinIO 统一管理脚本
# 用法: bash minio.sh {install|start|stop|restart|status|test}

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取项目根目录路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# MinIO 配置（从环境变量读取）
MINIO_DIR="${MINIO_DATA_DIR:-$HOME/minio-data}"
MINIO_PID_FILE="/tmp/minio.pid"
MINIO_LOG_FILE="/tmp/minio.log"

# 显示帮助信息
show_help() {
    cat << EOF
MinIO 统一管理脚本

用法: bash minio.sh <command> [options]

命令:
  install    安装 MinIO
  start      启动 MinIO 服务
  stop       停止 MinIO 服务
  restart    重启 MinIO 服务
  status     查看 MinIO 服务状态
  test       测试 MinIO 连接
  cleanup    清理 MinIO 数据目录

选项:
  --no-docker    不使用 Docker，直接运行二进制文件
  --force        强制操作（如强制安装）

示例:
  bash minio.sh install              # 安装 MinIO（优先使用 Docker）
  bash minio.sh start                # 启动 MinIO
  bash minio.sh stop                 # 停止 MinIO
  bash minio.sh status               # 查看状态
  bash minio.sh test                 # 测试连接
  bash minio.sh install --no-docker  # 安装二进制版本
EOF
}

# 加载环境变量
load_env() {
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"

        # 设置默认值
        MINIO_ENDPOINT=${MINIO_ENDPOINT:-"localhost"}
        MINIO_PORT=${MINIO_PORT:-"9000"}
        MINIO_USER=${MINIO_ACCESS_KEY:-"minioadmin"}
        MINIO_PASSWORD=${MINIO_SECRET_KEY:-"minioadmin123"}
        MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME:-"green-tracker-minio"}
        MINIO_SECURE=${MINIO_SECURE:-"false"}
        USE_DOCKER=${USE_DOCKER:-"true"}
    else
        echo -e "${RED}错误: 未找到 .env 文件${NC}"
        echo "期望的路径: $ENV_FILE"
        exit 1
    fi
}

# 检查 Docker 是否可用
check_docker() {
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# 安装 MinIO (Docker 方式)
install_docker() {
    echo -e "${GREEN}使用 Docker 安装 MinIO...${NC}"

    if ! check_docker; then
        echo -e "${RED}错误: Docker 不可用${NC}"
        echo "请安装 Docker 或使用 --no-docker 选项"
        return 1
    fi

    # 拉取镜像
    echo "拉取 MinIO Docker 镜像..."
    docker pull minio/minio:latest

    # 创建数据目录
    mkdir -p "$MINIO_DIR"

    echo -e "${GREEN}✓ MinIO Docker 镜像安装完成${NC}"
}

# 安装 MinIO (二进制方式)
install_binary() {
    echo -e "${GREEN}下载并安装 MinIO 二进制文件...${NC}"

    # 检查是否已安装
    if command -v minio &> /dev/null; then
        echo "MinIO 已安装: $(minio --version)"

        if [ "$1" != "--force" ]; then
            read -p "是否重新安装? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                return 0
            fi
        fi
    fi

    # 下载
    echo "正在下载 MinIO..."
    wget -q https://dl.min.io/server/minio/release/linux-amd64/minio -O /tmp/minio
    chmod +x /tmp/minio

    # 安装
    if sudo mv /tmp/minio /usr/local/bin/minio 2>/dev/null; then
        echo -e "${GREEN}✓ MinIO 安装完成${NC}"
    else
        echo -e "${YELLOW}请手动安装: sudo mv /tmp/minio /usr/local/bin/minio${NC}"
    fi
}

# 启动 MinIO (Docker 方式)
start_docker() {
    local CONTAINER_NAME="minio"
    local CONSOLE_PORT=$((MINIO_PORT + 1))

    echo -e "${GREEN}启动 MinIO Docker 容器...${NC}"

    # 检查容器是否已存在
    if [ "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
        echo "容器 $CONTAINER_NAME 已存在"

        if docker ps -q -f name=$CONTAINER_NAME &> /dev/null; then
            echo "MinIO 容器已在运行"
            return 0
        else
            echo "正在启动现有容器..."
            docker start $CONTAINER_NAME
            echo -e "${GREEN}✓ MinIO 已启动${NC}"
            return 0
        fi
    fi

    # 创建数据目录
    mkdir -p "$MINIO_DIR"

    # 启动容器
    docker run -d \
        -p $MINIO_PORT:$MINIO_PORT \
        -p $CONSOLE_PORT:$CONSOLE_PORT \
        --name $CONTAINER_NAME \
        -e "MINIO_ROOT_USER=$MINIO_USER" \
        -e "MINIO_ROOT_PASSWORD=$MINIO_PASSWORD" \
        -v "$MINIO_DIR":/data \
        minio/minio server /data --console-address ":$CONSOLE_PORT"

    echo -e "${GREEN}✓ MinIO 容器已启动${NC}"
    show_info
}

# 启动 MinIO (二进制方式)
start_binary() {
    echo -e "${GREEN}启动 MinIO 服务...${NC}"

    # 检查是否已安装
    if ! command -v minio &> /dev/null; then
        echo -e "${RED}错误: MinIO 未安装${NC}"
        echo "请运行: bash minio.sh install --no-docker"
        return 1
    fi

    # 检查是否已运行
    if [ -f "$MINIO_PID_FILE" ]; then
        local pid=$(cat "$MINIO_PID_FILE")
        if ps -p $pid &> /dev/null; then
            echo "MinIO 已在运行 (PID: $pid)"
            return 0
        else
            rm -f "$MINIO_PID_FILE"
        fi
    fi

    # 检查端口
    if lsof -Pi :$MINIO_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: 端口 $MINIO_PORT 已被占用${NC}"
        read -p "是否停止现有服务? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            stop_binary
        else
            return 1
        fi
    fi

    # 创建数据目录
    mkdir -p "$MINIO_DIR"

    # 设置环境变量
    export MINIO_ROOT_USER=$MINIO_USER
    export MINIO_ROOT_PASSWORD=$MINIO_PASSWORD

    # 启动服务
    nohup minio server "$MINIO_DIR" \
        --address ":$MINIO_PORT" \
        --console-address ":$((MINIO_PORT + 1))" \
        > "$MINIO_LOG_FILE" 2>&1 &

    local pid=$!
    echo $pid > "$MINIO_PID_FILE"

    # 等待启动
    echo "等待 MinIO 启动..."
    sleep 3

    # 检查状态
    if ps -p $pid &> /dev/null; then
        echo -e "${GREEN}✓ MinIO 服务已启动 (PID: $pid)${NC}"
        show_info
    else
        echo -e "${RED}✗ MinIO 启动失败${NC}"
        echo "查看日志: tail -f $MINIO_LOG_FILE"
        return 1
    fi
}

# 停止 MinIO (Docker 方式)
stop_docker() {
    local CONTAINER_NAME="minio"

    if docker ps -q -f name=$CONTAINER_NAME &> /dev/null; then
        echo "停止 MinIO 容器..."
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        echo -e "${GREEN}✓ MinIO 容器已停止${NC}"
    else
        echo "MinIO 容器未运行"
    fi
}

# 停止 MinIO (二进制方式)
stop_binary() {
    if [ -f "$MINIO_PID_FILE" ]; then
        local pid=$(cat "$MINIO_PID_FILE")
        if ps -p $pid &> /dev/null; then
            echo "停止 MinIO 服务 (PID: $pid)..."
            kill $pid
            sleep 2

            if ps -p $pid &> /dev/null; then
                echo "强制停止..."
                kill -9 $pid
            fi
        fi
        rm -f "$MINIO_PID_FILE"
        echo -e "${GREEN}✓ MinIO 服务已停止${NC}"
    else
        # 尝试查找进程
        local pid=$(pgrep -f "minio server")
        if [ -n "$pid" ]; then
            echo "发现 MinIO 进程 (PID: $pid)，正在停止..."
            pkill -f "minio server"
            echo -e "${GREEN}✓ MinIO 服务已停止${NC}"
        else
            echo "MinIO 服务未运行"
        fi
    fi
}

# 显示服务信息
show_info() {
    local CONSOLE_PORT=$((MINIO_PORT + 1))
    local protocol="http"

    if [ "$MINIO_SECURE" = "true" ]; then
        protocol="https"
    fi

    echo ""
    echo -e "${GREEN}===================================${NC}"
    echo -e "${GREEN}  MinIO 服务信息${NC}"
    echo -e "${GREEN}===================================${NC}"
    echo "  API 端点:  $protocol://$MINIO_ENDPOINT:$MINIO_PORT"
    echo "  控制台:    $protocol://$MINIO_ENDPOINT:$CONSOLE_PORT"
    echo "  用户名:    $MINIO_USER"
    echo "  密码:      *** (查看 .env 文件中的 MINIO_SECRET_KEY)"
    echo "  存储桶:    $MINIO_BUCKET_NAME"
    echo "  数据目录:  $MINIO_DIR"
    echo -e "${GREEN}===================================${NC}"
}

# 查看状态
show_status() {
    echo -e "${GREEN}MinIO 服务状态${NC}"
    echo ""

    if check_docker && [ "$(docker ps -q -f name=minio)" ]; then
        echo -e "${GREEN}✓ 运行中 (Docker)${NC}"
        docker ps -f name=minio --format "  端口映射: {{.Ports}}\n  创建时间: {{.CreatedAt}}"
        show_info
        return 0
    fi

    if [ -f "$MINIO_PID_FILE" ]; then
        local pid=$(cat "$MINIO_PID_FILE")
        if ps -p $pid &> /dev/null; then
            echo -e "${GREEN}✓ 运行中 (二进制)${NC}"
            echo "  PID: $pid"
            show_info
            return 0
        fi
    fi

    local pid=$(pgrep -f "minio server")
    if [ -n "$pid" ]; then
        echo -e "${GREEN}✓ 运行中 (二进制)${NC}"
        echo "  PID: $pid"
        show_info
        return 0
    fi

    echo -e "${RED}✗ MinIO 未运行${NC}"
    return 1
}

# 测试连接
test_connection() {
    echo -e "${GREEN}测试 MinIO 连接...${NC}"
    echo ""

    cd "$PROJECT_DIR/backend"

    if [ -f "storage/check_minio.py" ]; then
        python storage/check_minio.py
    elif [ -f "storage/test_storage.py" ]; then
        echo "运行存储测试..."
        python storage/test_storage.py
    else
        echo -e "${RED}错误: 未找到测试脚本${NC}"
        return 1
    fi
}

# 清理数据目录
cleanup_data() {
    echo -e "${YELLOW}警告: 此操作将删除所有 MinIO 数据${NC}"
    read -p "确定要删除 $MINIO_DIR ? [y/N] " -n 1 -r
    echo
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        stop_binary
        rm -rf "$MINIO_DIR"
        echo -e "${GREEN}✓ 数据目录已清理${NC}"
    else
        echo "取消操作"
    fi
}

# 主函数
main() {
    # 解析参数
    local command="$1"
    local use_docker="true"

    shift || true

    for arg in "$@"; do
        case $arg in
            --no-docker)
                use_docker="false"
                ;;
            --force)
                FORCE_INSTALL="true"
                ;;
        esac
    done

    # 加载环境变量
    load_env

    # 根据命令执行操作
    case $command in
        install)
            if [ "$use_docker" = "true" ] && check_docker; then
                install_docker
            else
                install_binary "$FORCE_INSTALL"
            fi
            ;;
        start)
            if [ "$use_docker" = "true" ] && check_docker; then
                start_docker
            else
                start_binary
            fi
            ;;
        stop)
            if [ "$use_docker" = "true" ] && check_docker && [ "$(docker ps -q -f name=minio)" ]; then
                stop_docker
            else
                stop_binary
            fi
            ;;
        restart)
            stop
            sleep 2
            start
            ;;
        status)
            show_status
            ;;
        test)
            test_connection
            ;;
        cleanup)
            cleanup_data
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}错误: 未知命令 '$command'${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
