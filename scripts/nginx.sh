#!/usr/bin/env bash
# =============================================================================
# Green Tracker - Nginx 服务管理脚本
# =============================================================================
# 用法：
#   bash scripts/nginx.sh start    # 启动（已运行则 reload 配置）
#   bash scripts/nginx.sh stop     # 停止
#   bash scripts/nginx.sh restart   # 重启
#   bash scripts/nginx.sh reload   # 热加载配置（不中断连接）
#   bash scripts/nginx.sh status   # 查看状态
#   bash scripts/nginx.sh test     # 测试配置语法
#
#   bash scripts/nginx.sh switch-to-dev    # 切换到开发模式（前端走 Vite，热加载）
#   bash scripts/nginx.sh switch-to-prod   # 切换到生产模式（前端走静态成品 dist/）
#   bash scripts/nginx.sh mode             # 查看当前前端模式
# =============================================================================

set -e

# ---------- 路径 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NGINX_DIR="$PROJECT_DIR/nginx"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
log_ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]\033[0m  $*"; }
log_error() { echo -e "${RED}[FAIL]\033[0m  $*"; }

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "未找到命令: $1"
        return 1
    fi
}

ACTION="${1:-status}"

is_running() {
    systemctl is-active --quiet nginx 2>/dev/null && return 0
    pgrep -x nginx >/dev/null 2>&1 && return 0
    return 1
}

do_test() {
    require_cmd nginx || exit 1
    log_info "测试 Nginx 配置语法..."
    if sudo nginx -t; then
        log_ok "配置语法正确"
    else
        log_error "配置语法错误"
        exit 1
    fi
}

do_start() {
    require_cmd nginx || exit 1
    if is_running; then
        log_info "Nginx 已运行，执行 reload 重新加载配置"
        do_reload
        return $?
    fi

    log_info "启动 Nginx..."
    if systemctl list-unit-files | grep -q "^nginx.service"; then
        sudo systemctl start nginx
        sudo systemctl enable nginx >/dev/null 2>&1 || true
    else
        # 没有 systemd（如容器 / macOS），直接启动
        sudo nginx
    fi

    sleep 1
    if is_running; then
        log_ok "Nginx 已启动"
    else
        log_error "Nginx 启动失败，请查看日志: sudo journalctl -u nginx -n 30"
        exit 1
    fi
}

do_stop() {
    if ! is_running; then
        log_warn "Nginx 未运行"
        return 0
    fi
    log_info "停止 Nginx..."
    sudo systemctl stop nginx 2>/dev/null || sudo nginx -s stop
    log_ok "Nginx 已停止"
}

do_restart() {
    log_info "重启 Nginx..."
    do_stop
    sleep 1
    do_start
}

do_reload() {
    do_test
    log_info "热加载 Nginx 配置..."
    sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload
    log_ok "Nginx 配置已重新加载（连接不中断）"
}

do_status() {
    if is_running; then
        log_ok "Nginx 正在运行"
        systemctl status nginx --no-pager 2>/dev/null | head -10 || pgrep -lx nginx
    else
        log_warn "Nginx 未运行"
    fi

    # 显示站点配置是否启用
    if [ -f /etc/nginx/sites-enabled/green-tracker ]; then
        log_ok "green-tracker 站点配置已启用: /etc/nginx/sites-enabled/green-tracker"
    else
        log_warn "green-tracker 站点未启用，请先运行: make setup-https"
    fi
}

# ---------- 前端模式切换（dev / prod）----------
do_switch_mode() {
    local mode="$1"
    local render_script="$SCRIPT_DIR/render_nginx.sh"
    if [ ! -f "$render_script" ]; then
        log_error "找不到渲染脚本: $render_script"
        exit 1
    fi
    log_info "切换前端模式为: $mode"
    bash "$render_script" "$mode"
}

do_mode() {
    local mode=""
    if [ -f "$NGINX_DIR/.current-mode" ]; then
        mode="$(cat "$NGINX_DIR/.current-mode")"
    fi
    case "$mode" in
        dev)
            log_ok "当前前端模式: dev（Vite 开发服务器，支持热加载）"
            ;;
        prod)
            log_ok "当前前端模式: prod（静态成品 frontend/dist，无热加载）"
            ;;
        "")
            log_warn "尚未记录前端模式（请先运行 make setup-https 或 make serve-dev / serve-prod）"
            ;;
        *)
            log_warn "当前前端模式: $mode"
            ;;
    esac

    # 顺带展示已安装的片段，便于排查
    if [ -f /etc/nginx/snippets/green-tracker-frontend.conf ]; then
        if grep -q "try_files" /etc/nginx/snippets/green-tracker-frontend.conf 2>/dev/null; then
            echo "  已安装片段: 静态成品（prod）"
        elif grep -q "proxy_pass" /etc/nginx/snippets/green-tracker-frontend.conf 2>/dev/null; then
            echo "  已安装片段: Vite 代理（dev）"
        fi
    else
        echo "  未检测到 /etc/nginx/snippets/green-tracker-frontend.conf"
    fi
}

case "$ACTION" in
    start)   do_start ;;
    stop)    do_stop ;;
    restart) do_restart ;;
    reload)  do_reload ;;
    status)  do_status ;;
    test)    do_test ;;
    switch-to-dev)  do_switch_mode dev ;;
    switch-to-prod) do_switch_mode prod ;;
    mode)    do_mode ;;
    *)
        echo "用法: $0 {start|stop|restart|reload|status|test|switch-to-dev|switch-to-prod|mode}"
        exit 1
        ;;
esac