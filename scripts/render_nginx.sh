#!/usr/bin/env bash
# =============================================================================
# Green Tracker - Nginx 配置渲染与安装脚本
# =============================================================================
# 统一负责：
#   1. 读取 .env 中的域名 / 端口 / 站点配置
#   2. 渲染主站配置模板（nginx/green-tracker.conf.template）
#   3. 按模式渲染“前端访问片段”：
#        dev  → 反代本地 Vite 开发服务器（HMR 热加载）
#        prod → Nginx 直接服务 frontend/dist 静态成品（性能最好，无热加载）
#   4. 安装到 /etc/nginx 并 reload
#
# 用法：
#   bash scripts/render_nginx.sh [dev|prod|auto] [--render-only] [--no-reload]
#
#   dev          前端走 Vite 开发服务器（热加载）
#   prod         前端走静态构建产物（成品部署，需先 make build）
#   auto（默认）  有 frontend/dist/index.html 则用 prod，否则用 dev
#
#   --render-only  只在本项目内生成 *.rendered 文件，不做 sudo 安装 / reload
#                  （用于离线校验语法，无需 root）
#   --no-reload    安装后不执行 nginx -t / reload
#
# 环境变量（可选，通常来自 .env）：
#   DOMAIN, PORT(前端端口), API_PORT(后端端口), MINIO_PORT
#   SSL_CERT_PATH, SSL_KEY_PATH（不设置则自动探测）
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
SNIPPET_SRC_DIR="$NGINX_DIR/snippets"
SSL_DIR="$NGINX_DIR/ssl"
# 渲染产物写入项目内可写目录（避免历史 sudo 生成文件导致的权限问题）
BUILD_DIR="$NGINX_DIR/build"

# ---------- 解析参数 ----------
MODE="auto"
RENDER_ONLY=0
NO_RELOAD=0
for arg in "$@"; do
    case "$arg" in
        dev|prod|auto) MODE="$arg" ;;
        --render-only) RENDER_ONLY=1 ;;
        --no-reload)   NO_RELOAD=1 ;;
        --help|-h)
            grep -E '^#( |$)' "$0" | sed -E 's/^# ?//'
            exit 0 ;;
        *)
            log_error "未知参数: $arg（可用: dev|prod|auto|--render-only|--no-reload）"
            exit 1 ;;
    esac
done

# ---------- 安全加载 .env ----------
load_env_file() {
    local env_file="$1"
    [ -f "$env_file" ] || return 0
    local line key value
    while IFS= read -r line || [ -n "$line" ]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line#export }"
        line="${line#"${line%%[![:space:]]*}"}"
        [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
        key="${line%%=*}"
        value="${line#*=}"
        value="${value%"${value##*[![:space:]]}"}"
        if [[ "$value" =~ ^\".*\"$ ]] || [[ "$value" =~ ^\'.*\'$ ]]; then
            value="${value:1:-1}"
        fi
        export "$key=$value"
    done < "$env_file"
}

if [ -f "$PROJECT_DIR/.env" ]; then
    load_env_file "$PROJECT_DIR/.env"
fi

# ---------- 配置解析 ----------
DOMAIN="${DOMAIN:-green-tracker.cn}"
FRONTEND_PORT="${PORT:-3010}"
BACKEND_PORT="${API_PORT:-6130}"
MINIO_PORT="${MINIO_PORT:-${MINIO_LISTEN_PORT:-9100}}"
STATIC_ROOT="${STATIC_ROOT:-$PROJECT_DIR/frontend/dist}"

# ---------- 决定前端模式 ----------
if [ "$MODE" = "auto" ]; then
    if [ -f "$STATIC_ROOT/index.html" ]; then
        MODE="prod"
    else
        MODE="dev"
    fi
fi

if [ "$MODE" = "prod" ] && [ ! -f "$STATIC_ROOT/index.html" ]; then
    log_error "生产模式需要构建产物，但未找到 $STATIC_ROOT/index.html"
    log_error "请先执行: make build"
    exit 1
fi

# ---------- 证书探测 ----------
# 注：/etc/letsencrypt/live 仅 root 可读，普通用户 [ -f ] 会误判"无证书"。
# 回退方案：经本机 443 TLS 握手确认 Let's Encrypt 证书已部署（Nginx 以 root 加载），
# 仍按标准路径写入配置。
if [ -z "${SSL_CERT_PATH:-}" ] || [ -z "${SSL_KEY_PATH:-}" ]; then
    if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        SSL_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
        SSL_KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
        log_info "使用 Let's Encrypt 证书"
    elif openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" </dev/null 2>/dev/null \
            | openssl x509 -noout -issuer 2>/dev/null | grep -q "Let's Encrypt"; then
        SSL_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
        SSL_KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
        log_info "使用 Let's Encrypt 证书（经 TLS 握手确认已部署）"
    elif [ -f "$SSL_DIR/${DOMAIN}.crt" ]; then
        SSL_CERT_PATH="$SSL_DIR/${DOMAIN}.crt"
        SSL_KEY_PATH="$SSL_DIR/${DOMAIN}.key"
        log_info "使用自签名证书"
    else
        log_error "未找到可用 SSL 证书（$DOMAIN）"
        log_error "请先运行: make setup-https"
        exit 1
    fi
fi

log_info "================================================="
log_info " 渲染 Nginx 配置"
log_info "  域名        : $DOMAIN"
log_info "  前端模式    : $MODE"
[ "$MODE" = "prod" ] && log_info "  静态根目录  : $STATIC_ROOT"
[ "$MODE" = "dev" ]  && log_info "  Vite 端口   : $FRONTEND_PORT"
log_info "  后端端口    : $BACKEND_PORT"
log_info "  证书        : $SSL_CERT_PATH"
log_info "================================================="

# ---------- 静态根目录可访问性预检（仅 prod）----------
# nginx worker 以非特权用户（默认 www-data）运行，必须能「穿越」STATIC_ROOT
# 的每一级父目录。典型故障：/home/<user> 默认 750（other 无 x），
# dev 模式只做 proxy_pass 不读文件系统因此不暴露，切到 prod 后立刻 403 Forbidden。
if [ "$MODE" = "prod" ]; then
    NGINX_USER="$(awk '/^[[:space:]]*user[[:space:]]/{print $2}' /etc/nginx/nginx.conf 2>/dev/null | tr -d ';' | head -1)"
    NGINX_USER="${NGINX_USER:-www-data}"

    dir_traversable() {
        local dir="$1" mode
        mode="$(stat -c '%A' "$dir" 2>/dev/null || echo '')"
        # other 用户位（10 字符权限串的索引 9）
        case "${mode:9:1}" in
            x|s|t) return 0 ;;
        esac
        # 或经由 ACL 显式授予 nginx worker 用户 x 权限
        if command -v getfacl >/dev/null 2>&1; then
            if getfacl "$dir" 2>/dev/null | grep -qE "^user:${NGINX_USER}:[r-]?[w-]?x"; then
                return 0
            fi
        fi
        return 1
    }

    BLOCKED_DIR=""
    CHECK_DIR="$(dirname "$STATIC_ROOT")"
    while [ -n "$CHECK_DIR" ] && [ "$CHECK_DIR" != "/" ]; do
        if [ -d "$CHECK_DIR" ] && ! dir_traversable "$CHECK_DIR"; then
            BLOCKED_DIR="$CHECK_DIR"
            break
        fi
        CHECK_DIR="$(dirname "$CHECK_DIR")"
    done

    if [ -n "$BLOCKED_DIR" ]; then
        log_warn "Nginx worker（$NGINX_USER）无法穿越目录: $BLOCKED_DIR"
        log_warn "prod 模式下静态资源将返回 403 Forbidden，请任选一种修复："
        log_warn "  A) sudo chmod o+x $BLOCKED_DIR"
        log_warn "  B) sudo apt-get install -y acl && sudo setfacl -m u:$NGINX_USER:x $BLOCKED_DIR"
    fi
fi

# ---------- 工具检测 ----------
command -v perl >/dev/null 2>&1 || { log_error "未找到 perl（渲染模板必需）"; exit 1; }

# ---------- 渲染主站配置 ----------
MAIN_TEMPLATE="$NGINX_DIR/green-tracker.conf.template"
mkdir -p "$BUILD_DIR"
MAIN_RENDERED="$BUILD_DIR/green-tracker.conf.rendered"

[ -f "$MAIN_TEMPLATE" ] || { log_error "找不到主配置模板: $MAIN_TEMPLATE"; exit 1; }

DOMAIN="$DOMAIN" \
SSL_CERT_PATH="$SSL_CERT_PATH" \
SSL_KEY_PATH="$SSL_KEY_PATH" \
FRONTEND_PORT="$FRONTEND_PORT" \
BACKEND_PORT="$BACKEND_PORT" \
MINIO_PORT="$MINIO_PORT" \
perl -0777 -pe '
    s/\$\{DOMAIN\}/$ENV{DOMAIN}/g;
    s/\$\{SSL_CERT_PATH\}/$ENV{SSL_CERT_PATH}/g;
    s/\$\{SSL_KEY_PATH\}/$ENV{SSL_KEY_PATH}/g;
    s/\$\{FRONTEND_PORT\}/$ENV{FRONTEND_PORT}/g;
    s/\$\{BACKEND_PORT\}/$ENV{BACKEND_PORT}/g;
    s/\$\{MINIO_PORT\}/$ENV{MINIO_PORT}/g;
' "$MAIN_TEMPLATE" > "$MAIN_RENDERED"
log_ok "主站配置已渲染: $MAIN_RENDERED"

# ---------- 渲染前端片段 ----------
if [ "$MODE" = "prod" ]; then
    FRAGMENT_TEMPLATE="$SNIPPET_SRC_DIR/frontend-static.conf"
else
    FRAGMENT_TEMPLATE="$SNIPPET_SRC_DIR/frontend-dev.conf"
fi
FRAGMENT_RENDERED="$BUILD_DIR/green-tracker-frontend.rendered.conf"

[ -f "$FRAGMENT_TEMPLATE" ] || { log_error "找不到前端片段模板: $FRAGMENT_TEMPLATE"; exit 1; }

FRONTEND_PORT="$FRONTEND_PORT" STATIC_ROOT="$STATIC_ROOT" \
perl -0777 -pe '
    s/\$\{FRONTEND_PORT\}/$ENV{FRONTEND_PORT}/g;
    s/\$\{STATIC_ROOT\}/$ENV{STATIC_ROOT}/g;
' "$FRAGMENT_TEMPLATE" > "$FRAGMENT_RENDERED"
log_ok "前端访问片段已渲染（$MODE）: $FRAGMENT_RENDERED"

# ---------- 仅渲染（离线校验，无需 root）----------
if [ "$RENDER_ONLY" -eq 1 ]; then
    echo ""
    echo "  --render-only 模式：未执行 sudo 安装。"
    echo "  主站配置   : $MAIN_RENDERED"
    echo "  前端片段   : $FRAGMENT_RENDERED"
    echo ""
    echo "  如需安装到系统 Nginx："
    echo "    make serve-$MODE"
    echo ""
    exit 0
fi

# ---------- 安装到系统 Nginx ----------
log_info "安装配置到 /etc/nginx ..."
sudo mkdir -p /etc/nginx/snippets

sudo cp "$MAIN_RENDERED" /etc/nginx/sites-available/green-tracker
sudo ln -sf /etc/nginx/sites-available/green-tracker /etc/nginx/sites-enabled/green-tracker
sudo cp "$FRAGMENT_RENDERED" /etc/nginx/snippets/green-tracker-frontend.conf
sudo cp "$NGINX_DIR/ssl-params.conf" /etc/nginx/snippets/green-tracker-ssl-params.conf

# 移除默认站点，避免 80 端口冲突
[ -f /etc/nginx/sites-enabled/default ] && sudo rm -f /etc/nginx/sites-enabled/default

log_ok "配置已安装（前端模式: $MODE）"

# 记录当前模式，供 make mode 查看
echo "$MODE" > "$NGINX_DIR/.current-mode"

# ---------- 校验并 reload ----------
if [ "$NO_RELOAD" -eq 1 ]; then
    log_warn "--no-reload：跳过 nginx -t / reload，请手动执行 sudo nginx -t && sudo systemctl reload nginx"
    exit 0
fi

log_info "校验 Nginx 配置语法..."
if sudo nginx -t; then
    log_ok "语法正确，正在 reload..."
    sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload
    log_ok "Nginx 已应用新配置"
else
    log_error "Nginx 配置语法错误，请检查后重试"
    exit 1
fi

echo ""
log_ok "完成。当前前端模式：${MODE}"
if [ "$MODE" = "dev" ]; then
    echo "  开发模式：页面由 Vite 开发服务器提供（支持热加载）"
    echo "  提示：需确保前端已运行，例如 make dev-frontend"
else
    echo "  生产模式：页面为静态成品（无热加载，性能最优）"
    echo "  提示：发版后需重新执行 make build && make serve-prod"
fi
