#!/usr/bin/env bash
# =============================================================================
# Green Tracker - HTTPS 证书智能配置脚本
# =============================================================================
# 功能：
#   1. 检测域名 DNS 是否解析到本机公网 IP
#   2. 如满足条件 + 已安装 certbot：申请 Let's Encrypt 正式证书（自动续期）
#   3. 否则：生成自签名证书（浏览器会警告，可手动信任或继续访问）
#   4. 渲染 Nginx 站点模板并 reload
#
# 用法：
#   bash scripts/setup_https.sh [domain]
#   bash scripts/setup_https.sh              # 默认使用 .env 中的 DOMAIN
#   bash scripts/setup_https.sh --force-selfsigned   # 强制使用自签名证书
#
# 依赖：
#   - openssl（系统自带）
#   - certbot（可选，仅 Let's Encrypt 路径需要）
#   - nginx
# =============================================================================

set -e

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[FAIL]${NC}  $*"; }

# ---------- 路径 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NGINX_DIR="$PROJECT_DIR/nginx"
SSL_DIR="$PROJECT_DIR/nginx/ssl"
mkdir -p "$SSL_DIR"

# ---------- 加载 .env ----------
# 安全加载：跳过空行/注释/非法行，支持含空格或特殊字符的值（用引号包裹整个 KEY=VALUE）
load_env_file() {
    local env_file="$1"
    [ -f "$env_file" ] || return 0

    local line key value
    while IFS= read -r line || [ -n "$line" ]; do
        # 跳过空行和注释行
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # 去掉行首空白
        line="${line#"${line%%[![:space:]]*}"}"
        # 去掉可选的 export 前缀
        line="${line#export }"
        line="${line#"${line%%[![:space:]]*}"}"
        # 必须为合法的 KEY=VALUE 格式
        [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
        # 拆分 KEY 和 VALUE（关键！不能 eval 整行，否则空格后内容会被当命令）
        key="${line%%=*}"
        value="${line#*=}"
        # 去掉值尾部空白（read -r 会保留换行符以外的空白）
        value="${value%"${value##*[![:space:]]}"}"
        # 处理值被单/双引号包裹的情况（如 KEY="value with spaces"）
        if [[ "$value" =~ ^\".*\"$ ]] || [[ "$value" =~ ^\'.*\'$ ]]; then
            value="${value:1:-1}"
        fi
        # 用 export 直接接受整个 "KEY=VALUE"（带引号保护含空格的值）
        export "$key=$value"
    done < "$env_file"
}

if [ -f "$PROJECT_DIR/.env" ]; then
    load_env_file "$PROJECT_DIR/.env"
    log_info "已加载 $PROJECT_DIR/.env"
else
    log_warn "未找到 .env，将使用脚本默认值（请参考 .env.example）"
fi

# ---------- 解析参数 ----------
FORCE_SELFSIGNED=0
DOMAIN_ARG=""
for arg in "$@"; do
    case "$arg" in
        --force-selfsigned|-s) FORCE_SELFSIGNED=1 ;;
        --help|-h)
            grep -E '^#( |$)' "$0" | sed -E 's/^# ?//'
            exit 0 ;;
        *) DOMAIN_ARG="$arg" ;;
    esac
done

DOMAIN="${DOMAIN_ARG:-${DOMAIN:-green-tracker.cn}}"
FRONTEND_PORT="${PORT:-3010}"
BACKEND_PORT="${API_PORT:-6130}"
MINIO_PORT="${MINIO_PORT:-${MINIO_LISTEN_PORT:-9100}}"
EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"

log_info "================================================="
log_info " Green Tracker HTTPS 证书配置"
log_info "================================================="
log_info "  域名        : $DOMAIN"
log_info "  前端端口    : $FRONTEND_PORT"
log_info "  后端端口    : $BACKEND_PORT"
log_info "  MinIO 端口  : $MINIO_PORT"
log_info "  证书邮箱    : $EMAIL"
log_info "  强制自签名  : $FORCE_SELFSIGNED"
log_info "================================================="

# ---------- 工具检测 ----------
require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "未找到命令: $1，请先安装"
        exit 1
    fi
}

# ---------- 网络工具 ----------
get_public_ip() {
    local ip=""
    for url in "https://api.ipify.org" "https://ifconfig.me" "https://ipinfo.io/ip"; do
        ip=$(curl -fsS --max-time 5 "$url" 2>/dev/null | tr -d '[:space:]' || true)
        [ -n "$ip" ] && break
    done
    echo "$ip"
}

get_dns_ip() {
    local ip=""
    # 优先使用 dig，其次 nslookup
    if command -v dig >/dev/null 2>&1; then
        ip=$(dig +short "$DOMAIN" @8.8.8.8 2>/dev/null | head -n1 | tr -d '[:space:]' || true)
    elif command -v nslookup >/dev/null 2>&1; then
        ip=$(nslookup -timeout=5 "$DOMAIN" 2>/dev/null | awk '/^Address: / {print $2; exit}' || true)
    elif command -v getent >/dev/null 2>&1; then
        ip=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
    fi
    echo "$ip"
}

# ---------- Let's Encrypt 申请 ----------
apply_letsencrypt() {
    require_cmd certbot
    log_info "通过 certbot 申请 Let's Encrypt 证书..."

    # 使用 webroot 模式（避免临时关闭 Nginx）
    local webroot="/var/www/html"
    sudo mkdir -p "$webroot"

    sudo certbot certonly \
        --webroot \
        -w "$webroot" \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive

    SSL_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    SSL_KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
    log_ok "Let's Encrypt 证书签发成功"
}

# ---------- 自签名证书生成 ----------
generate_selfsigned() {
    log_info "生成自签名证书（SAN: ${DOMAIN}）..."

    local cert="$SSL_DIR/${DOMAIN}.crt"
    local key="$SSL_DIR/${DOMAIN}.key"

    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -subj "/CN=${DOMAIN}/O=Green Tracker (Self-signed)/OU=Dev" \
        -addext "subjectAltName=DNS:${DOMAIN},DNS:www.${DOMAIN},IP:127.0.0.1" \
        -keyout "$key" \
        -out  "$cert" 2>/dev/null

    SSL_CERT_PATH="$cert"
    SSL_KEY_PATH="$key"
    log_ok "自签名证书已生成"
    log_warn "浏览器会显示「您的连接不是私密连接」，点击「高级 → 继续前往」即可"
}

# ---------- 安装 Nginx 配置 ----------
# 渲染逻辑已统一收敛到 scripts/render_nginx.sh（同时安装主站配置 + 前端访问片段）。
# 模式：auto —— 若存在 frontend/dist/index.html 则用静态成品，否则用 Vite 开发服务器。
render_and_install_nginx() {
    local render_script="$SCRIPT_DIR/render_nginx.sh"
    if [ ! -f "$render_script" ]; then
        log_error "找不到渲染脚本: $render_script"
        exit 1
    fi

    log_info "调用统一渲染脚本安装 Nginx 配置（${NGINX_MODE:-auto} 模式）..."
    SSL_CERT_PATH="$SSL_CERT_PATH" \
    SSL_KEY_PATH="$SSL_KEY_PATH" \
    DOMAIN="$DOMAIN" \
    PORT="$FRONTEND_PORT" \
    API_PORT="$BACKEND_PORT" \
    MINIO_PORT="$MINIO_PORT" \
    bash "$render_script" "${NGINX_MODE:-auto}" --no-reload

    log_info "Nginx 配置已安装到 /etc/nginx/sites-available/green-tracker"
}

# ---------- 验证并 reload ----------
reload_nginx() {
    log_info "验证 Nginx 配置..."
    if sudo nginx -t 2>&1 | tee /tmp/nginx-test.log | grep -q "syntax is ok"; then
        log_ok "Nginx 配置语法正确"
        sudo systemctl reload nginx
        log_ok "Nginx 已 reload"
    else
        log_error "Nginx 配置语法错误，请检查 /tmp/nginx-test.log"
        exit 1
    fi
}

# =============================================================================
# 主流程
# =============================================================================

# ---------- 1. DNS 解析检测 ----------
PUBLIC_IP="$(get_public_ip)"
DNS_IP="$(get_dns_ip)"

log_info "本机公网 IP : ${PUBLIC_IP:-<无法获取>}"
log_info "域名 DNS 解析: ${DNS_IP:-<无法获取>}"

if [ -n "$PUBLIC_IP" ] && [ -n "$DNS_IP" ] && [ "$PUBLIC_IP" = "$DNS_IP" ]; then
    DNS_OK=1
else
    DNS_OK=0
fi

# ---------- 2. 选择证书类型 ----------
USE_LETSENCRYPT=0
if [ "$FORCE_SELFSIGNED" -eq 1 ]; then
    log_warn "已指定 --force-selfsigned，使用自签名证书"
    generate_selfsigned
elif [ "$DNS_OK" -eq 1 ] && command -v certbot >/dev/null 2>&1; then
    log_info "DNS 已正确解析且已安装 certbot，尝试申请 Let's Encrypt 证书..."
    if apply_letsencrypt; then
        USE_LETSENCRYPT=1
    else
        log_warn "Let's Encrypt 申请失败，回退到自签名证书"
        generate_selfsigned
    fi
elif [ "$DNS_OK" -eq 1 ] && ! command -v certbot >/dev/null 2>&1; then
    log_warn "域名已解析但未安装 certbot，自动安装..."
    if sudo apt-get update -y >/dev/null 2>&1 && sudo apt-get install -y certbot >/dev/null 2>&1; then
        if apply_letsencrypt; then
            USE_LETSENCRYPT=1
        else
            generate_selfsigned
        fi
    else
        log_warn "certbot 安装失败，使用自签名证书"
        generate_selfsigned
    fi
else
    log_warn "域名未解析到本机（DNS=${DNS_IP:-空}，本机IP=${PUBLIC_IP:-空}），使用自签名证书"
    log_warn "提示：等域名解析生效后再次运行本脚本可升级到正式证书"
    generate_selfsigned
fi

# ---------- 3. 安装 / reload ----------
render_and_install_nginx
reload_nginx

# ---------- 4. 提示 ----------
echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN} HTTPS 证书配置完成！${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo "  访问地址    : https://${DOMAIN}"
echo "  备用地址    : https://${DOMAIN}（HTTP 80 已自动跳转）"
echo "  证书类型    : $([ "$USE_LETSENCRYPT" -eq 1 ] && echo "Let's Encrypt（受信任）" || echo "自签名（浏览器会警告，可继续访问）")"
echo "  证书路径    : ${SSL_CERT_PATH}"
echo "  Nginx 配置  : /etc/nginx/sites-available/green-tracker"
echo ""

if [ "$USE_LETSENCRYPT" -eq 1 ]; then
    echo "  自动续期    : certbot 通过 systemd timer 自动续期，无需手动干预"
    echo "  手动续期    : sudo certbot renew"
else
    echo "  升级到正式证书："
    echo "    1) 在域名服务商把 ${DOMAIN} 解析到本机公网 IP（${PUBLIC_IP:-?})"
    echo "    2) 等 DNS 生效后再次执行: make setup-https"
fi
echo ""
echo "  下一步:"
echo "    make dev    # 启动前后端（HMR 热加载）"
echo "    make start  # 启动数据库和MinIO"
echo ""
echo "  访问 https://${DOMAIN}  即可看到项目首页（无端口号）"