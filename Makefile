# Green Tracker 项目 Makefile
# 用于启动和管理前端、后端、Nginx 与 HTTPS 证书

.PHONY: help install start stop dev dev-frontend dev-backend clean restart check-env \
        build deploy serve-prod serve-dev mode \
        mqtt-start mqtt-stop mqtt-status mqtt-logs \
        setup-https nginx-install nginx-start nginx-stop nginx-restart nginx-reload nginx-status nginx-test

# 默认目标
help:
	@echo "Green Tracker 项目命令列表:"
	@echo ""
	@echo "【基础】"
	@echo "  install          - 安装所有依赖 (前端和后端)"
	@echo "  check-env        - 检查环境配置"
	@echo "  check-deps       - 扫描声明 vs 运行 conda env 一致性（缺哪些包 / 哪些源码 import 未声明）"
	@echo "  start            - 启动所有服务 (数据库 / MinIO / Nginx)"
	@echo "  stop             - 停止所有服务"
	@echo "  restart          - 重启服务"
	@echo "  dev              - 开发模式 (启动前后端，支持热加载)"
	@echo "  dev-frontend     - 仅启动前端 (热加载)"
	@echo "  dev-backend      - 仅启动后端 (热加载)"
	@echo "  clean            - 清理临时文件和容器"
	@echo ""
	@echo "【构建 / 部署模式】（开发热加载 vs 生产静态成品）"
	@echo "  build            - 构建前端生产产物到 frontend/dist"
	@echo "  deploy           - 一键: build + 切换到生产静态模式"
	@echo "  serve-prod       - 切换 Nginx 到生产模式 (服务 dist/ 静态成品)"
	@echo "  serve-dev        - 切换 Nginx 到开发模式 (反代 Vite，热加载)"
	@echo "  mode             - 查看当前前端模式 (dev / prod)"
	@echo ""
	@echo "【HTTPS / Nginx】（推荐使用）"
	@echo "  setup-https      - 一键申请/生成 HTTPS 证书并安装 Nginx"
	@echo "  nginx-install    - 安装 Nginx (仅首次)"
	@echo "  nginx-start      - 启动 Nginx (并 reload 配置)"
	@echo "  nginx-stop       - 停止 Nginx"
	@echo "  nginx-restart    - 重启 Nginx"
	@echo "  nginx-reload     - 热加载 Nginx 配置"
	@echo "  nginx-status     - Nginx 状态"
	@echo "  nginx-test       - 验证 Nginx 配置语法"
	@echo ""
	@echo "【MQTT】"
	@echo "  mqtt-start       - 启动 MQTT Broker (Docker)"
	@echo "  mqtt-stop        - 停止 MQTT Broker"
	@echo "  mqtt-status      - MQTT Broker 状态"
	@echo "  mqtt-logs        - MQTT Broker 日志"

# 检查环境配置
check-env:
	@if [ ! -f ".env" ]; then \
		echo "错误: 未找到 .env 文件。请复制 .env.example 到 .env 并配置您的环境变量。"; \
		exit 1; \
	fi
	@echo "环境配置检查通过 ✓"

# 声明 vs 运行 conda env 一致性扫描（仅读，不改环境）
# 自动检测当前 conda env，激活 green 后跑 scripts/check_deps_env_sync.py
check-deps:
	@GREEN_PY="$${GREEN_PY:-/home/jiangxiaoxuan/miniconda3/envs/green/bin/python}"; \
	if [ ! -x "$$GREEN_PY" ]; then \
		echo "错误: 未找到 $$GREEN_PY，请先 make install 创建 green env 并装依赖"; exit 1; \
	fi; \
	$$GREEN_PY scripts/check_deps_env_sync.py

# 安装依赖
install: check-env
	@echo "安装后端依赖..."
	cd backend && pip install -e .
	@echo "安装前端依赖..."
	cd frontend && npm install
	@echo "所有依赖安装完成 ✓"

# 启动所有服务（数据库 / MinIO / Nginx）
start: check-env
	@echo "启动所有基础服务 (数据库 / MinIO)..."
	./scripts/start-services.sh
	@echo ""
	@echo "启动 Nginx (HTTPS 反向代理)..."
	@bash scripts/nginx.sh start || true

# 开发模式 - 同时启动前后端 (支持热加载)
dev: check-env
	@echo "启动开发环境 (前端和后端，支持热加载)..."
	@if [ -f ".env" ]; then \
		echo "前端将运行在: http://$$(grep '^PORT=' .env | cut -d'=' -f2) (经 Nginx 对外提供 https://$$(grep '^DOMAIN=' .env | cut -d'=' -f2))"; \
		echo "后端将运行在: http://$$(grep '^API_HOST=' .env | cut -d'=' -f2):$$(grep '^API_PORT=' .env | cut -d'=' -f2) (仅本地)"; \
	fi
	@echo "按 Ctrl+C 停止所有服务"
	@sleep 1
	@$(MAKE) -j2 dev-frontend dev-backend

# 仅启动前端 (热加载)
dev-frontend: check-env
	@echo "启动前端开发服务器 (热加载)..."
	@echo "前端配置："
	@echo "- 端口: $$(grep '^PORT=' .env | cut -d'=' -f2)"
	@echo "- API基础URL: /api (相对路径，由 Nginx 反代)"
	@cd frontend && npm run dev

# 仅启动后端 (热加载)
dev-backend: check-env
	@echo "启动后端开发服务器 (热加载)..."
	@echo "后端配置："
	@echo "- 端口: $$(grep '^API_PORT=' .env | cut -d'=' -f2)"
	@echo "- 主机: $$(grep '^API_HOST=' .env | cut -d'=' -f2) (127.0.0.1 = 仅本地监听)"
	@cd backend && python -m uvicorn main:app --reload --host $$(cd .. && grep '^API_HOST=' .env | cut -d'=' -f2) --port $$(cd .. && grep '^API_PORT=' .env | cut -d'=' -f2)

# 停止所有服务
stop:
	@echo "停止所有服务..."
	@./scripts/stop-services.sh
	@echo "正在停止 Nginx..."
	@bash scripts/nginx.sh stop || true
	@echo "正在停止前端和后端开发服务器..."
	@pkill -f "vite\|uvicorn" || true
	@echo "所有服务已停止 ✓"

# 重启所有服务
restart: stop start

# 清理临时文件和容器
clean:
	@echo "清理项目..."
	@cd frontend && npm run clean || rm -rf node_modules/.vite || true
	@docker stop minio || true
	@docker rm minio || true
	@echo "清理完成 ✓"

# ============================================================
# 构建 / 部署模式（开发热加载 vs 生产静态成品）
# ============================================================

# 构建前端生产产物到 frontend/dist
build: check-env
	@echo "构建前端生产产物..."
	@cd frontend && npm run build
	@echo "构建完成 ✓ 产物目录: frontend/dist"

# 一键部署：构建 + 切换 Nginx 到生产静态模式
deploy: build serve-prod
	@echo "生产部署完成 ✓"

# 切换到生产模式：Nginx 直接服务静态成品（无热加载，性能最优）
serve-prod:
	@echo "切换前端模式为生产（静态成品 frontend/dist）..."
	@bash scripts/nginx.sh switch-to-prod

# 切换到开发模式：Nginx 反代 Vite 开发服务器（热加载）
serve-dev:
	@echo "切换前端模式为开发（Vite 热加载）..."
	@bash scripts/nginx.sh switch-to-dev

# 查看当前前端模式
mode:
	@bash scripts/nginx.sh mode

# ============================================================
# HTTPS / Nginx 管理
# ============================================================

# 安装 Nginx（首次部署时使用）
nginx-install:
	@echo "安装 Nginx..."
	@if command -v nginx >/dev/null 2>&1; then \
		echo "Nginx 已安装: $$(nginx -v 2>&1)"; \
	else \
		echo "尝试通过 apt 安装 Nginx..."; \
		sudo apt-get update && sudo apt-get install -y nginx; \
	fi
	@echo "Nginx 安装完成 ✓"

# 一键申请 HTTPS 证书并配置反向代理
setup-https: check-env nginx-install
	@echo "开始配置 HTTPS 证书..."
	@bash scripts/setup_https.sh
	@echo ""
	@echo "==========================================="
	@echo " HTTPS 部署完成！"
	@echo "==========================================="
	@echo " 访问地址: https://$$(grep '^DOMAIN=' .env | cut -d'=' -f2)"
	@echo "==========================================="

# Nginx 服务管理
nginx-start:
	@bash scripts/nginx.sh start

nginx-stop:
	@bash scripts/nginx.sh stop

nginx-restart:
	@bash scripts/nginx.sh restart

nginx-reload:
	@bash scripts/nginx.sh reload

nginx-status:
	@bash scripts/nginx.sh status

nginx-test:
	@bash scripts/nginx.sh test

# ============================================================
# MQTT Broker 管理
# ============================================================
mqtt-start: check-env
	@echo "启动 MQTT Broker..."
	@cd mqtt-broker && bash deploy_mqtt.sh start

mqtt-stop:
	@echo "停止 MQTT Broker..."
	@cd mqtt-broker && bash deploy_mqtt.sh stop

mqtt-status:
	@cd mqtt-broker && bash deploy_mqtt.sh status

mqtt-logs:
	@cd mqtt-broker && bash deploy_mqtt.sh logs