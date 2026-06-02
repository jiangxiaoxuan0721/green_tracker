#!/bin/bash

# MQTT Broker (Mosquitto) 一键安装配置脚本
# 用于为 Green Tracker 设备心跳 & 指令下发提供 MQTT 支持
#
# 功能：
#   1. 安装 Mosquitto Broker
#   2. 创建后端客户端账号（用于订阅心跳、下发指令）
#   3. 配置 ACL 权限控制
#   4. 可选启用 TLS (8883)
#   5. 自动更新 .env 配置

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  MQTT Broker (Mosquitto) 安装配置${NC}"
echo -e "${GREEN}  Green Tracker 设备在线状态追踪${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 sudo 运行此脚本${NC}"
    echo "示例: sudo bash scripts/mqtt-broker-setup.sh"
    exit 1
fi

# =============================================================================
# 参数解析（支持命令行覆盖默认值）
# =============================================================================
MQTT_PORT=${MQTT_PORT:-1883}
MQTT_TLS_PORT=${MQTT_TLS_PORT:-8883}
MQTT_BACKEND_USER=${MQTT_BACKEND_USER:-"green-tracker-backend"}
MQTT_BACKEND_PASS=${MQTT_BACKEND_PASS:-""}
ENABLE_TLS=${ENABLE_TLS:-false}

# 从 .env 读取已有配置（如果存在）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

get_env_value() {
    local key=$1
    if [ -f "$ENV_FILE" ]; then
        grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | head -1
    fi
}

# 尝试从 .env 读取已有配置
if [ -z "$MQTT_BACKEND_PASS" ]; then
    ENV_PASS=$(get_env_value "MQTT_PASSWORD")
    if [ -n "$ENV_PASS" ] && [ "$ENV_PASS" != "your-platform-password" ]; then
        MQTT_BACKEND_PASS="$ENV_PASS"
    fi
fi

# 如果没有密码则自动生成
if [ -z "$MQTT_BACKEND_PASS" ]; then
    MQTT_BACKEND_PASS=$(openssl rand -base64 24 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
    echo -e "${BLUE}已自动生成后端客户端密码${NC}"
fi

# 获取 Broker 主机地址
MQTT_BROKER_HOST=${MQTT_BROKER_HOST:-"localhost"}
ENV_HOST=$(get_env_value "MQTT_BROKER_HOST")
if [ -n "$ENV_HOST" ] && [ "$ENV_HOST" != "your-cloud-server-ip" ]; then
    MQTT_BROKER_HOST="$ENV_HOST"
fi

echo ""
echo -e "${BLUE}配置信息：${NC}"
echo "  Broker 地址 & 端口 : ${MQTT_BROKER_HOST}:${MQTT_PORT}"
echo "  TLS 端口           : ${MQTT_TLS_PORT} (启用TLS: ${ENABLE_TLS})"
echo "  后端客户端用户名     : ${MQTT_BACKEND_USER}"
echo ""

# =============================================================================
# 1. 安装 Mosquitto
# =============================================================================
echo -e "${GREEN}[1/5] 检查并安装 Mosquitto...${NC}"

install_mosquitto() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo -e "${RED}无法检测操作系统${NC}"
        exit 1
    fi

    case "$OS" in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y mosquitto mosquitto-clients
            ;;
        centos|rhel|fedora)
            yum install -y epel-release
            yum install -y mosquitto mosquitto-clients
            ;;
        *)
            echo -e "${RED}不支持的操作系统: $OS${NC}"
            echo "请手动安装 Mosquitto: https://mosquitto.org/download/"
            exit 1
            ;;
    esac
}

if command -v mosquitto &> /dev/null; then
    MOSQUITTO_VERSION=$(mosquitto -h 2>&1 | head -1 || echo "unknown")
    echo -e "${YELLOW}Mosquitto 已安装: ${MOSQUITTO_VERSION}${NC}"
else
    echo -e "${GREEN}正在安装 Mosquitto...${NC}"
    install_mosquitto
    echo -e "${GREEN}Mosquitto 安装完成${NC}"
fi

# =============================================================================
# 2. 创建 Mosquitto 配置
# =============================================================================
echo ""
echo -e "${GREEN}[2/5] 配置 Mosquitto...${NC}"

MOSQUITTO_CONF_DIR="/etc/mosquitto"
MOSQUITTO_CONF="$MOSQUITTO_CONF_DIR/mosquitto.conf"
MOSQUITTO_CONF_BAK="$MOSQUITTO_CONF_DIR/mosquitto.conf.bak.$(date +%Y%m%d%H%M%S)"

# 备份旧配置
if [ -f "$MOSQUITTO_CONF" ]; then
    cp "$MOSQUITTO_CONF" "$MOSQUITTO_CONF_BAK"
    echo -e "${YELLOW}已备份旧配置: ${MOSQUITTO_CONF_BAK}${NC}"
fi

cat > "$MOSQUITTO_CONF" << EOF
# =============================================================================
# Mosquitto Broker 配置文件
# 由 Green Tracker mqtt-broker-setup.sh 自动生成
# 生成时间: $(date)
# =============================================================================

# --- 基础设置 ---
# 持久化（重启后保留会话数据）
persistence true
persistence_location /var/lib/mosquitto/

# 日志
log_dest file /var/log/mosquitto/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
log_timestamp true

# --- MQTT 监听器 ---

# TCP (无加密，端口 ${MQTT_PORT})
listener ${MQTT_PORT} 0.0.0.0
protocol mqtt

# --- 认证 ---
# 使用密码文件认证
allow_anonymous false
password_file /etc/mosquitto/passwd

# --- ACL 权限控制 ---
# 后端客户端可订阅所有设备心跳、下发指令
acl_file /etc/mosquitto/acl

# --- 连接限制 ---
max_connections -1
max_keepalive 300

# --- MQTT v5 支持 ---
EOF

# 如果启用 TLS
if [ "$ENABLE_TLS" = true ]; then
    cat >> "$MOSQUITTO_CONF" << EOF

# --- TLS 加密监听器 (端口 ${MQTT_TLS_PORT}) ---
listener ${MQTT_TLS_PORT} 0.0.0.0
protocol mqtt
cafile /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key
tls_version tlsv1.2
EOF

    # 生成自签名证书（如果没有提供）
    if [ ! -f "$MOSQUITTO_CONF_DIR/certs/server.crt" ]; then
        echo -e "${BLUE}生成自签名 TLS 证书...${NC}"
        mkdir -p "$MOSQUITTO_CONF_DIR/certs"
        openssl req -new -x509 -days 3650 -nodes \
            -subj "/CN=${MQTT_BROKER_HOST}/O=GreenTracker" \
            -keyout "$MOSQUITTO_CONF_DIR/certs/server.key" \
            -out "$MOSQUITTO_CONF_DIR/certs/server.crt" 2>/dev/null
        cp "$MOSQUITTO_CONF_DIR/certs/server.crt" "$MOSQUITTO_CONF_DIR/certs/ca.crt"
        chmod 600 "$MOSQUITTO_CONF_DIR/certs/server.key"
        echo -e "${GREEN}自签名证书已生成${NC}"
    fi
fi

echo -e "${GREEN}Mosquitto 配置文件已生成: ${MOSQUITTO_CONF}${NC}"

# =============================================================================
# 3. 创建密码文件
# =============================================================================
echo ""
echo -e "${GREEN}[3/5] 创建客户端认证...${NC}"

PASSWD_FILE="$MOSQUITTO_CONF_DIR/passwd"

# 创建/更新后端客户端密码
if [ -f "$PASSWD_FILE" ]; then
    # 删除旧的后端用户（如果存在）
    if grep -q "^${MQTT_BACKEND_USER}:" "$PASSWD_FILE"; then
        # 移除旧条目
        grep -v "^${MQTT_BACKEND_USER}:" "$PASSWD_FILE" > "${PASSWD_FILE}.tmp"
        mv "${PASSWD_FILE}.tmp" "$PASSWD_FILE"
    fi
fi

# 使用 mosquitto_passwd 加密写入（优先 -b 批处理模式，失败则用 stdin）
if mosquitto_passwd -b "$PASSWD_FILE" "$MQTT_BACKEND_USER" "$MQTT_BACKEND_PASS" 2>/dev/null; then
    echo -e "${GREEN}密码文件创建成功（批处理模式）${NC}"
else
    echo -e "${YELLOW}-b 模式不可用，使用交互式模式创建...${NC}"
    # 通过 stdin 传入两次密码（部分旧版 mosquitto_passwd 不支持 -b）
    echo -e "${MQTT_BACKEND_PASS}\n${MQTT_BACKEND_PASS}" | \
        mosquitto_passwd -c "$PASSWD_FILE" "$MQTT_BACKEND_USER" 2>/dev/null || {
        echo -e "${RED}密码文件创建失败，尝试使用 openssl 生成...${NC}"
        # 最终回退：使用 openssl 生成兼容格式的密码哈希
        SALT=$(openssl rand -base64 6 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 2)
        HASH=$(echo -n "$MQTT_BACKEND_PASS" | openssl passwd -6 -salt "$SALT" -stdin 2>/dev/null) || \
            HASH=$(python3 -c "import crypt; print(crypt.crypt('${MQTT_BACKEND_PASS}'))" 2>/dev/null)
        if [ -n "$HASH" ]; then
            echo "${MQTT_BACKEND_USER}:${HASH}" > "$PASSWD_FILE"
            echo -e "${YELLOW}已使用 openssl 生成密码哈希${NC}"
        else
            echo -e "${RED}无法创建密码文件，请手动执行:${NC}"
            echo "  sudo mosquitto_passwd -c /etc/mosquitto/passwd ${MQTT_BACKEND_USER}"
            exit 1
        fi
    }
fi

# 校验密码文件是否已创建
if [ ! -f "$PASSWD_FILE" ] || [ ! -s "$PASSWD_FILE" ]; then
    echo -e "${RED}密码文件创建失败，文件为空或不存在${NC}"
    echo "请手动执行: sudo mosquitto_passwd -c /etc/mosquitto/passwd ${MQTT_BACKEND_USER}"
    exit 1
fi

# 设置权限（仅 root/mosquitto 可读）
chmod 600 "$PASSWD_FILE"
chown mosquitto:mosquitto "$PASSWD_FILE" 2>/dev/null || true

echo -e "${GREEN}后端客户端账号已创建: ${MQTT_BACKEND_USER}${NC}"

# =============================================================================
# 4. 创建 ACL 文件
# =============================================================================
echo ""
echo -e "${GREEN}[4/5] 配置 ACL 权限...${NC}"

ACL_FILE="$MOSQUITTO_CONF_DIR/acl"

cat > "$ACL_FILE" << EOF
# =============================================================================
# Mosquitto ACL 权限配置
# 由 Green Tracker mqtt-broker-setup.sh 自动生成
# =============================================================================
#
# 主题约定:
#   device/{uuid}/heartbeat  - 设备心跳
#   device/{uuid}/cmd        - 指令下发
#   device/{uuid}/#          - 设备所有消息
#
# =============================================================================

# --- 后端管理客户端 ---
# 可订阅所有设备心跳、下发指令到任意设备
user ${MQTT_BACKEND_USER}
topic readwrite device/+/heartbeat
topic readwrite device/+/cmd
topic readwrite device/+/#

# --- 设备客户端 ---
# 每个设备只能读写自己 UUID 下的主题
# 设备通过 device/{uuid}/heartbeat 发送心跳
# 设备通过 device/{uuid}/cmd 接收指令
pattern readwrite device/%u/#

# --- 默认拒绝 ---
topic deny #
EOF

chmod 644 "$ACL_FILE"
chown mosquitto:mosquitto "$ACL_FILE" 2>/dev/null || true

echo -e "${GREEN}ACL 权限配置完成${NC}"

# =============================================================================
# 5. 启动服务并更新 .env
# =============================================================================
echo ""
echo -e "${GREEN}[5/5] 启动服务 & 更新 .env...${NC}"

# 创建日志目录
mkdir -p /var/log/mosquitto
chown mosquitto:mosquitto /var/log/mosquitto 2>/dev/null || true

# 启动/重启 Mosquitto
systemctl enable mosquitto
systemctl restart mosquitto

sleep 2

# 检查服务状态
if systemctl is-active --quiet mosquitto; then
    echo -e "${GREEN}Mosquitto 服务已启动${NC}"
else
    echo -e "${RED}Mosquitto 服务启动失败，请检查日志: journalctl -u mosquitto -n 50${NC}"
    exit 1
fi

# 更新 .env 文件
update_env() {
    local key=$1
    local value=$2
    if [ -f "$ENV_FILE" ]; then
        if grep -q "^${key}=" "$ENV_FILE"; then
            sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        else
            echo "${key}=${value}" >> "$ENV_FILE"
        fi
    fi
}

if [ -f "$ENV_FILE" ]; then
    update_env "MQTT_BROKER_HOST" "$MQTT_BROKER_HOST"
    update_env "MQTT_BROKER_PORT" "$MQTT_PORT"
    update_env "MQTT_USERNAME" "$MQTT_BACKEND_USER"
    update_env "MQTT_PASSWORD" "$MQTT_BACKEND_PASS"
    update_env "MQTT_KEEPALIVE" "60"
    echo -e "${GREEN}已更新 .env 文件中的 MQTT 配置${NC}"
else
    echo -e "${YELLOW}未找到 .env 文件: ${ENV_FILE}${NC}"
    echo -e "${YELLOW}请手动在 .env 中添加以下配置：${NC}"
    echo ""
    echo "MQTT_BROKER_HOST=${MQTT_BROKER_HOST}"
    echo "MQTT_BROKER_PORT=${MQTT_PORT}"
    echo "MQTT_USERNAME=${MQTT_BACKEND_USER}"
    echo "MQTT_PASSWORD=${MQTT_BACKEND_PASS}"
    echo "MQTT_KEEPALIVE=60"
fi

# 验证 MQTT 连接
echo ""
echo -e "${BLUE}验证 MQTT Broker 可用性...${NC}"
if mosquitto_sub -h "$MQTT_BROKER_HOST" -p "$MQTT_PORT" \
    -u "$MQTT_BACKEND_USER" -P "$MQTT_BACKEND_PASS" \
    -t "green-tracker/test" -C 1 -W 2 2>/dev/null; then
    echo -e "${GREEN}MQTT 连接验证通过${NC}"
else
    # 使用本地测试
    if mosquitto_pub -h "localhost" -p "$MQTT_PORT" \
        -u "$MQTT_BACKEND_USER" -P "$MQTT_BACKEND_PASS" \
        -t "green-tracker/test" -m "test" -q 1 2>/dev/null; then
        echo -e "${GREEN}MQTT (localhost) 连接测试通过${NC}"
    else
        echo -e "${YELLOW}MQTT 连接测试未通过（可能是防火墙限制，请检查）${NC}"
    fi
fi

# =============================================================================
# 完成
# =============================================================================
echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  MQTT Broker 安装配置完成！${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}Broker 信息：${NC}"
echo "  TCP 端口          : ${MQTT_PORT}"
if [ "$ENABLE_TLS" = true ]; then
    echo "  TLS 端口          : ${MQTT_TLS_PORT}"
fi
echo "  后端客户端用户名    : ${MQTT_BACKEND_USER}"
echo "  后端客户端密码      : ${MQTT_BACKEND_PASS}"
echo "  心跳订阅主题        : device/+/heartbeat"
echo "  指令下发主题        : device/{uuid}/cmd"
echo ""

echo -e "${BLUE}管理命令：${NC}"
echo "  查看状态           : systemctl status mosquitto"
echo "  重启服务           : systemctl restart mosquitto"
echo "  查看日志           : journalctl -u mosquitto -f"
echo ""
echo -e "${BLUE}设备凭据管理：${NC}"
echo "  添加设备到Broker    : sudo mosquitto_passwd /etc/mosquitto/passwd <device_uuid>"
echo "                        (输入设备密钥，与 POST /api/devices/{id}/provision 返回的 mqtt_password 一致)"
echo "  从Broker删除设备    : sudo mosquitto_passwd -D /etc/mosquitto/passwd <device_uuid>"
echo "  查看所有设备账号    : sudo cat /etc/mosquitto/passwd"

echo ""
echo -e "${BLUE}远程设备部署：${NC}"
echo "  1. 在平台上调用 POST /api/devices/{id}/provision 获取凭据"
echo "  2. 将返回的 JSON 保存为 device_config.json"
echo "  3. 安装依赖: pip install paho-mqtt"
echo "  4. 运行客户端: python3 scripts/device-client.py device_config.json"

echo ""
echo -e "${BLUE}设备连接示例：${NC}"
echo "  # 发送心跳"
echo "  mosquitto_pub -h ${MQTT_BROKER_HOST} -p ${MQTT_PORT} \\"
echo "    -u <device_uuid> -P <device_secret> \\"
echo "    -t device/<device_uuid>/heartbeat \\"
echo "    -m '{\"device_id\":\"<device_uuid>\",\"type\":\"heartbeat\",\"timestamp\":$(date +%s)}'"
echo ""

echo -e "${BLUE}测试订阅（后端视角）：${NC}"
echo "  mosquitto_sub -h ${MQTT_BROKER_HOST} -p ${MQTT_PORT} \\"
echo "    -u ${MQTT_BACKEND_USER} -P ${MQTT_BACKEND_PASS} \\"
echo "    -t device/+/heartbeat -v"
echo ""

echo -e "${YELLOW}重要提示：${NC}"
echo "1. 请确保防火墙已开放端口 ${MQTT_PORT}（以及 ${MQTT_TLS_PORT}）"
echo "2. 设备使用自己的 UUID 作为 MQTT 用户名，密码需要平台分配"
echo "3. 生产环境建议启用 TLS (设置 ENABLE_TLS=true 重新运行此脚本)"
echo "4. 后端启动时会自动连接此 Broker 订阅心跳"
echo ""
echo -e "${GREEN}脚本执行完毕！${NC}"
