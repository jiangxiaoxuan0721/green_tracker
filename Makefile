# Green Tracker 项目 Makefile
# 用于启动和管理前端和后端服务

.PHONY: help install start stop dev dev-frontend dev-backend clean restart check-env

# 默认目标
help:
	@echo "Green Tracker 项目命令列表:"
	@echo "  install          - 安装所有依赖 (前端和后端)"
	@echo "  check-env        - 检查环境配置"
	@echo "  start            - 启动所有服务 (包括数据库和MinIO)"
	@echo "  dev              - 开发模式 (启动前后端，支持热加载)"
	@echo "  dev-frontend     - 仅启动前端 (热加载)"
	@echo "  dev-backend      - 仅启动后端 (热加载)"
	@echo "  stop             - 停止所有服务"
	@echo "  restart          - 重启所有服务"
	@echo "  clean            - 清理临时文件和容器"

# 检查环境配置
check-env:
	@if [ ! -f ".env" ]; then \
		echo "错误: 未找到 .env 文件。请复制 .env.example 到 .env 并配置您的环境变量。"; \
		exit 1; \
	fi
	@echo "环境配置检查通过 ✓"

# 安装依赖
install: check-env
	@echo "安装后端依赖..."
	cd backend && pip install -e .
	@echo "安装前端依赖..."
	cd frontend && npm install
	@echo "所有依赖安装完成 ✓"

# 启动所有服务
start: check-env
	@echo "启动所有基础服务 (数据库和MinIO)..."
	./scripts/start-services.sh

# 开发模式 - 同时启动前后端 (支持热加载)
dev: check-env
	@echo "启动开发环境 (前端和后端，支持热加载)..."
	@echo "前端将运行在: http://localhost:3010"
	@echo "后端将运行在: http://localhost:6130"
	@echo "按 Ctrl+C 停止所有服务"
	@sleep 1
	@$(MAKE) -j2 dev-frontend dev-backend

# 仅启动前端 (热加载)
dev-frontend: check-env
	@echo "启动前端开发服务器 (热加载)..."
	@echo "前端配置："
	@echo "- 端口: $$(grep '^PORT=' .env | cut -d'=' -f2)"
	@echo "- API基础URL: $$(grep '^VITE_API_BASE_URL=' .env | cut -d'=' -f2)"
	@cd frontend && npm run dev

# 仅启动后端 (热加载)
dev-backend: check-env
	@echo "启动后端开发服务器 (热加载)..."
	@echo "后端配置："
	@echo "- 端口: $$(grep '^API_PORT=' .env | cut -d'=' -f2)"
	@cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 6130

# 停止所有服务
stop:
	@echo "停止所有服务..."
	@./scripts/stop-services.sh
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