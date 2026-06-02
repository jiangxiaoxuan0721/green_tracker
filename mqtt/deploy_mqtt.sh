#!/bin/bash
# ============================================================
# Green Tracker MQTT Broker 一键部署脚本
#
# 用法:
#   ./deploy_mqtt.sh start     首次部署 (初始化配置 + 启动 Broker)
#   ./deploy_mqtt.sh stop      停止 Broker
#   ./deploy_mqtt.sh restart   重启 Broker
#   ./deploy_mqtt.sh status    查看状态
#   ./deploy_mqtt.sh logs      查看日志
#   ./deploy_mqtt.sh add-device <device_id> [secret]  添加设备MQTT用户
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Docker Compose 命令兼容
DC="docker compose"
$DC version &>/dev/null 2>&1 || DC="docker-compose"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step()    { echo -e "\n${CYAN}▶ $1${NC}"; }

# 从根目录 .env 加载环境变量
load_env() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

# ============================================================
# 初始化配置
# ============================================================
init_config() {
    step "初始化 MQTT Broker 配置..."

    mkdir -p "$SCRIPT_DIR/mosquitto/config" \
             "$SCRIPT_DIR/mosquitto/data" \
             "$SCRIPT_DIR/mosquitto/log"

    # 生成密码文件
    local PASSWD_FILE="$SCRIPT_DIR/mosquitto/config/passwd"
    local MQTT_USER="${MQTT_USERNAME:-admin}"
    local MQTT_PASS="${MQTT_PASSWORD:-admin123}"

    if [ ! -f "$PASSWD_FILE" ]; then
        touch "$PASSWD_FILE"
    fi

    # 创建/更新管理员用户
    docker run --rm \
        -v "$PASSWD_FILE:/tmp/passwd" \
        eclipse-mosquitto:2.0 \
        mosquitto_passwd -b /tmp/passwd "$MQTT_USER" "$MQTT_PASS" 2>/dev/null || \
    info "管理员用户已存在或创建完成"

    # 设置正确的文件权限
    chmod 644 "$SCRIPT_DIR/mosquitto/config/mosquitto.conf" 2>/dev/null || true
    chmod 644 "$SCRIPT_DIR/mosquitto/config/acl.conf" 2>/dev/null || true

    info "配置初始化完成 ✓"
}

# ============================================================
# 启动 Broker
# ============================================================
start_broker() {
    step "构建并启动 MQTT Broker..."
    cd "$SCRIPT_DIR"

    $DC -f docker-compose.mqtt.yml up -d 2>&1 || error "Broker 启动失败!"

    sleep 3

    if $DC -f docker-compose.mqtt.yml ps 2>/dev/null | grep -qiE "Up|running"; then
        local MQTT_PORT="${MQTT_PORT:-1883}"
        local MQTT_WS_PORT="${MQTT_WS_PORT:-9001}"
        echo ""
        echo "============================================="
        info "  MQTT Broker 启动成功! ✓"
        echo "============================================="
        echo -e "  ${CYAN}MQTT TCP:${NC}     tcp://localhost:${MQTT_PORT}"
        echo -e "  ${CYAN}WebSocket:${NC}   ws://localhost:${MQTT_WS_PORT}/mqtt"
        echo ""
        echo "  常用命令:"
        echo "    ./deploy_mqtt.sh status          查看状态"
        echo "    ./deploy_mqtt.sh logs            查看日志"
        echo "    ./deploy_mqtt.sh stop            停止 Broker"
        echo "    ./deploy_mqtt.sh add-device <id> 添加设备用户"
        echo "============================================="
    else
        error "Broker 未启动！运行 ./deploy_mqtt.sh logs 排查"
    fi
}

# ============================================================
# 停止 Broker
# ============================================================
stop_broker() {
    step "停止 MQTT Broker..."
    cd "$SCRIPT_DIR"
    $DC -f docker-compose.mqtt.yml down 2>/dev/null
    info "Broker 已停止 ✓"
}

# ============================================================
# 添加设备 MQTT 用户
# ============================================================
add_device_user() {
    local DEVICE_ID="$1"
    local DEVICE_SECRET="${2:-}"

    if [ -z "$DEVICE_ID" ]; then
        error "用法: $0 add-device <device_id> [secret]"
    fi

    if [ -z "$DEVICE_SECRET" ]; then
        DEVICE_SECRET=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
    fi

    local PASSWD_FILE="$SCRIPT_DIR/mosquitto/config/passwd"
    if [ ! -f "$PASSWD_FILE" ]; then
        touch "$PASSWD_FILE"
    fi

    docker run --rm \
        -v "$PASSWD_FILE:/tmp/passwd" \
        eclipse-mosquitto:2.0 \
        mosquitto_passwd -b /tmp/passwd "$DEVICE_ID" "$DEVICE_SECRET" 2>/dev/null

    info "设备 MQTT 用户已添加:"
    echo "  device_id:  $DEVICE_ID"
    echo "  secret:     $DEVICE_SECRET"

    # 热重载配置（不重启 Broker）
    if docker ps --format '{{.Names}}' | grep -q "green-tracker-mqtt-broker"; then
        docker exec green-tracker-mqtt-broker kill -HUP 1 2>/dev/null || \
        docker restart green-tracker-mqtt-broker
        info "Broker 已重载配置"
    fi
}

# ============================================================
# 查看状态/日志
# ============================================================
show_status() {
    cd "$SCRIPT_DIR"
    $DC -f docker-compose.mqtt.yml ps 2>/dev/null
}

show_logs() {
    cd "$SCRIPT_DIR"
    $DC -f docker-compose.mqtt.yml logs --tail=100 -f 2>/dev/null
}

show_help() {
    echo "用法: $0 {命令}"
    echo ""
    echo "  start                        首次部署（初始化+启动）"
    echo "  stop                         停止 Broker"
    echo "  restart                      重启 Broker"
    echo "  status                       查看容器状态"
    echo "  logs                         查看日志"
    echo "  add-device <id> [secret]     添加设备 MQTT 认证用户"
    echo "  help                         帮助"
    echo ""
    echo "架构:"
    echo "  green-tracker-mqtt-broker   Mosquitto 2.0  :1883(MQTT)  :9001(WS)"
    echo "  云端 MQTT 客户端            集成在 FastAPI 后端 (api/mqtt/*)"
}

# ============================================================
# 主入口
# ============================================================
main() {
    load_env

    case "${1:-help}" in
        start)
            init_config
            start_broker
            ;;
        stop)
            stop_broker
            ;;
        restart)
            stop_broker
            sleep 1
            start_broker
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        add-device)
            add_device_user "$2" "$3"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "未知命令: $1 (运行 $0 help 查看帮助)"
            ;;
    esac
}

main "$@"
