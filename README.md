# 🌱 Green Tracker

[![frontend](https://img.shields.io/badge/frontend-0.0.0-blue?style=flat-square)](frontend/package.json) [![backend](https://img.shields.io/badge/backend-0.1.0-orange?style=flat-square)](backend/pyproject.toml) [![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react)](https://reactjs.org/) [![Vite](https://img.shields.io/badge/Vite-5.0.8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/) [![FastAPI](https://img.shields.io/badge/FastAPI-0.124.4-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/) [![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=flat-square&logo=python)](https://www.python.org/) [![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](https://opensource.org/licenses/MIT) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

> 给农业 IoT 团队的监测与算法部署平台，多租户数据隔离。

徽章版本号直接取自 `frontend/package.json` 与 `backend/pyproject.toml`，请勿手写。

---

## 🏗️ 架构

```
浏览器
  │  HTTPS
  ▼
Nginx (:80/:443)              终止 TLS、反向代理
  ├── /          ──▶ 前端    开发: Vite dev server (127.0.0.1:3010, 支持 HMR)
  │                          生产: 静态成品 frontend/dist
  └── /api/      ──▶ FastAPI (127.0.0.1:6130)
                        ├── PostgreSQL + PostGIS ── 元数据库 + 每用户独立数据库
                        ├── MinIO (S3 兼容)      ── 原始数据 / 算法包 / 缩略图
                        ├── Docker               ── 算法镜像构建与容器化推理
                        └── MQTT (Mosquitto)     ── IoT 设备实时上报与状态同步
```

开发/生产共用同一份源码与同一套相对路径 API（`/api`），仅 Nginx 前端片段不同，由 `scripts/render_nginx.sh` 渲染切换。

---

## ✨ 功能模块

| # | 模块 | 页面 | 后端路由 | 说明 |
|---|------|------|----------|------|
| 1 | 首页 | `Home` | — | 功能入口与统计概览 |
| 2 | 设备管理 | `Devices` | `/api/devices` | 设备注册、状态监控、激活 / 停用 |
| 3 | 地块管理 | `Fields` | `/api/fields` | 基于 PostGIS 的地理空间地块管理 |
| 4 | 采集会话 | `Sessions` | `/api/collection-sessions` | 会话创建、监控与归档 |
| 5 | 数据视图 | `DataView` | `/api/raw-data` | 多维度数据浏览与检索，内置步骤式上传弹窗（图像 / 视频 / 环境 / 土壤） |
| 6 | 数据分析 | `DataAnalyze` | `/api/raw-data` | 统计图表与趋势分析 |
| 7 | 密钥管理 | `KeyManagement` | `/api/api-keys` | API Key 签发、权限（`data_upload` / `data_read` / `device_control`）与禁用 |
| 8 | 算法广场 | `AlgorithmSquare` | `/api/algorithms` | 算法浏览、打包上传、镜像构建与部署 |
| 9 | 算法使用 | `AlgorithmUse` | `/api/algorithms` | 已部署算法的在线推理 |
| 10 | 系统日志 | `Logs` | `/api/logs` | 全链路审计日志，支持筛选与 CSV 导出 |
| 11 | 设备控制 | `RemoteControl` | `/api/device-commands` | 向设备下发指令、查看授权状态与执行结果 |

其余能力：6 套主题切换、Framer Motion 动效、响应式布局、JWT 认证、用户反馈（`/api/feedback`）、数据库管理（`/api/admin/database`）、MQTT 管理（`/api/mqtt/*`）。

---

## 🚀 快速开始

在**仓库根目录**依次执行（命令与 `Makefile` target 完全一致）：

```bash
# 1. 获取代码
git clone https://github.com/jiangxiaoxuan0721/green_tracker.git
cd green_tracker

# 2. 生成环境配置，按需填写数据库 / MinIO / 域名等
cp .env.example .env

# 3. 安装前后端依赖
make install

# 4. 启动基础服务（PostgreSQL + 元数据库初始化 + MinIO + Nginx）
make start

# 5. 启动前后端开发服务（热加载）
make dev
```

- 前端：`http://localhost:3010`（本地监听，由 Nginx 对外提供 HTTPS）
- 后端：`http://127.0.0.1:6130`（仅本地监听，经 Nginx 反代 `/api/`）
- 算法部署需要 Docker，可执行 `bash scripts/docker-install.sh` 安装。

环境要求：Python ≥ 3.8（见 `backend/pyproject.toml`）、Node.js 18+（Vite 5 的运行时要求，仓库未锁定 `engines`）、PostgreSQL（需 PostGIS 扩展）、Docker、MinIO。

全部环境变量说明见 [`docs/setup/env-config.md`](docs/setup/env-config.md)。

---

## 📁 项目结构

```
green_tracker/
├── backend/                    # FastAPI 后端
│   ├── main.py                 # 应用入口，注册 12 个路由模块
│   ├── api/routes/             # auth / device / field / collection_session /
│   │                           # raw_data / api_key / algorithm / log /
│   │                           # feedback / admin_database / device_command / mqtt
│   ├── api/dependencies.py     # 跨路由共享依赖（设备控制授权守卫）
│   ├── api/schemas/            # Pydantic 请求与响应模型
│   ├── utils/                  # 缓存 / 邮件 / 图像处理 / 密钥权限定义
│   ├── database/               # 元数据库 + 每用户独立数据库管理
│   ├── storage/                # MinIO 客户端、Docker 容器与镜像构建
│   ├── mqtt/                   # MQTT 客户端、设备状态与路由
│   ├── pyproject.toml          # 后端依赖唯一来源
│   └── requirements.txt        # pyproject.toml 的镜像
├── frontend/                   # React 前端
│   ├── src/pages/Dashboard/    # 11 个业务模块页面
│   ├── src/components/ui/      # 统一组件库（Toast / StateManager 等）
│   ├── src/services/           # API 封装
│   ├── src/styles/             # 主题与样式
│   └── package.json
├── docs/                       # 分层文档，入口见 docs/README.md
├── nginx/                      # Nginx 模板 + dev/prod 前端片段
├── scripts/                    # 运维脚本（服务启停、Nginx、HTTPS、MQTT、Docker）
├── mqtt-broker/                # Mosquitto Docker 部署
├── Makefile                    # 统一命令入口
├── .env.example                # 环境变量模板
├── README.md                   # 项目总览（本文件）
├── ARCHITECTURE.md             # 架构设计
├── DEVELOPMENT.md              # 本地开发指南
├── CONTRIBUTING.md             # 贡献指南
└── CHANGELOG.md                # 版本变更记录
```

---

## 🛠️ make 命令

| 分类 | 命令 | 说明 |
|------|------|------|
| 基础 | `make help` | 查看所有命令 |
| | `make install` | 安装前后端依赖 |
| | `make check-env` | 检查 `.env` 是否存在 |
| | `make check-deps` | 扫描声明依赖与 conda env 的一致性 |
| | `make start` / `make stop` / `make restart` | 启停 / 重启基础服务 |
| | `make dev` | 同时启动前后端（热加载） |
| | `make dev-frontend` / `make dev-backend` | 仅启动前端 / 后端 |
| | `make clean` | 清理临时文件与容器 |
| 构建 / 部署 | `make build` | 构建前端产物到 `frontend/dist` |
| | `make deploy` | 一键：`build` + 切到生产静态模式 |
| | `make serve-prod` | Nginx 切换到生产模式（服务 `dist/`） |
| | `make serve-dev` | Nginx 切换到开发模式（反代 Vite） |
| | `make mode` | 查看当前前端模式（dev / prod） |
| HTTPS / Nginx | `make setup-https` | 一键申请 / 生成证书并配置 Nginx |
| | `make nginx-install` | 安装 Nginx（仅首次） |
| | `make nginx-start` / `-stop` / `-restart` / `-reload` | Nginx 服务管理 |
| | `make nginx-status` / `make nginx-test` | 状态查看 / 配置语法校验 |
| MQTT | `make mqtt-start` / `make mqtt-stop` | 启停 MQTT Broker |
| | `make mqtt-status` / `make mqtt-logs` | 状态查看 / 日志 |

> `make check-deps` 需要已激活的 conda 环境，或显式指定 `GREEN_PY=/path/to/python`。

---

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 架构设计、数据模型与 API 路由清单 |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | 本地开发、环境变量速查、测试与调试 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 分支、提交与评审规范 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本变更记录 |
| [`docs/README.md`](docs/README.md) | 文档总索引（architecture / features / ops / setup） |
| [`docs/setup/env-config.md`](docs/setup/env-config.md) | 环境变量详解 |
| [`docs/setup/https-setup.md`](docs/setup/https-setup.md) | HTTPS 证书与 Nginx 部署 |
| [`docs/architecture/database_redesign_v2.md`](docs/architecture/database_redesign_v2.md) | 数据库 v2 设计（现行架构） |
| [`docs/architecture/minio_documentation.md`](docs/architecture/minio_documentation.md) | MinIO 对象存储 |
| [`docs/features/algorithm_development_guide.md`](docs/features/algorithm_development_guide.md) | 算法接入开发指南 |
| [`docs/features/thumbnail_feature_guide.md`](docs/features/thumbnail_feature_guide.md) | 图像缩略图链路 |
| [`docs/ops/screen_guide.md`](docs/ops/screen_guide.md) | screen 会话运维操作 |
| [`nginx/README.md`](nginx/README.md) | Nginx 配置与 dev/prod 模式 |
| [`frontend/README.md`](frontend/README.md) | 前端目录约定 |

---

## 📄 许可证

本项目按 **MIT** 条款授权（`backend/pyproject.toml` 中声明为 `License :: OSI Approved :: MIT License`）。

⚠️ 仓库根目录**尚未附 `LICENSE` 文件**，正式对外使用前需补上 MIT 许可证全文。
