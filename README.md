# 🌱 绿色追踪系统 (Green Tracker)

一个现代化的农业IoT环境监测仪表板，提供实时数据可视化、算法部署管理、多主题切换和智能设备管理功能。

[![FastAPI](https://img.shields.io/badge/FastAPI-0.124.4-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](https://opensource.org/licenses/MIT)

---

## ✨ 项目特色

### 🏗️ 全栈架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + Vite + TypeScript | 现代化响应式SPA |
| 后端 | FastAPI + SQLAlchemy 2.0 | 高性能异步API |
| 数据库 | PostgreSQL + PostGIS | 关系型 + 地理空间 |
| 存储 | MinIO (S3兼容) | 对象存储 |
| 消息 | MQTT (Mosquitto) | IoT设备实时通信 |
| 容器 | Docker | 算法容器化部署 |

### 📊 核心功能模块

| 模块 | 说明 |
|------|------|
| **首页** | 动态背景、交互式功能卡片、统计展示 |
| **设备管理** | IoT设备状态监控、激活/停用控制 |
| **地块管理** | 基于PostGIS的地理空间管理 |
| **采集会话** | 会话创建、监控与管理 |
| **数据上传** | 现代化步骤式上传界面，支持图像/视频/环境/土壤数据 |
| **数据视图** | 多维度数据可视化 |
| **数据分析** | 深度数据分析和报表 |
| **密钥管理** | API密钥的创建、使用与禁用 |
| **算法广场** | 算法浏览、构建、部署、在线推理 |
| **算法使用** | 已部署算法的在线使用界面 |
| **系统日志** | 操作日志与审计 |

### 🎨 用户体验

- **6种精美主题**: 默认黑蓝、明亮模式、深色模式、薄荷绿、日落橙、天空蓝
- **Framer Motion动画**: 流畅的页面过渡和交互动效
- **响应式设计**: 桌面、平板、移动设备完美适配
- **JWT认证**: 安全的用户认证授权系统
- **现代化界面**: 步骤条导航、卡片布局、状态管理组件
- **统一组件库**: EnhancedLoading、StateManager等增强组件

---

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- Python >= 3.8
- PostgreSQL >= 12 (需PostGIS扩展)
- Docker & Docker Compose
- MinIO (本地S3存储)

### 1. 克隆项目

```bash
git clone https://github.com/jiangxiaoxuan0721/green_tracker.git
cd green_tracker
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env 配置数据库和MinIO连接
```

详细配置请参考 [ENV_CONFIG.md](docs/setup/ENV_CONFIG.md)

### 3. 安装依赖

```bash
make install
```

### 4. 启动服务

```bash
# 开发模式（前后端热加载）
make dev

# 或分别启动
make dev-frontend  # 前端: http://localhost:3010
make dev-backend   # 后端: http://localhost:6130
```

### 5. 初始化数据库

```bash
# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE green_tracker_meta;"
sudo -u postgres psql -d green_tracker_meta -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 启动后端时会自动初始化表结构
```

---

## 🌐 开发环境 vs 生产部署

项目采用「同一份前端源码，两种运行模式」，无需分支或改代码即可切换：

| 模式 | 前端由谁提供 | 热加载 | 性能 | 入口命令 |
|------|--------------|:------:|------|----------|
| **开发** | Nginx 反代 **Vite dev server** (`:3010`) | ✅ 支持 | 一般 | `make dev` / `make serve-dev` |
| **生产** | Nginx 直接服务**静态成品** `frontend/dist` | ❌ 不支持 | ⭐ 最优 | `make deploy` / `make serve-prod` |

### 架构对比

```
开发模式   浏览器 → Nginx(:443) ─┬─ /      → Vite dev server (3010)   [HMR]
                                └─ /api/  → FastAPI (127.0.0.1:6130)

生产模式   浏览器 → Nginx(:443) ─┬─ /      → 静态文件 frontend/dist  [构建产物]
                                └─ /api/  → FastAPI (127.0.0.1:6130)
```

两种模式共用**完全相同的源码**与**相同的相对路径 API**（`/api`），
只有 Nginx 的「前端片段」不同，由 `scripts/render_nginx.sh` 渲染切换。

### 切换方式

```bash
# —— 开发：改源码即时生效（HMR）——
make dev            # 启动前后端（Vite + FastAPI）
make serve-dev      # 让 Nginx 指向 Vite（若当前是生产模式）

# —— 生产：构建静态成品并切换到静态服务（发版流程）——
make deploy         # 等价于 make build + make serve-prod
make build          # 只构建 frontend/dist
make serve-prod     # 只切换 Nginx 到静态成品模式

# 查看当前处于哪个模式
make mode
```

> ⚠️ 生产模式下改动源码不会生效，必须重新执行 `make build && make serve-prod`（或 `make deploy`）。

### 工作原理

- `scripts/render_nginx.sh <dev|prod>` 渲染主站配置，并把对应的前端片段安装为
  `/etc/nginx/snippets/green-tracker-frontend.conf`：
  - `dev` → `nginx/snippets/frontend-dev.conf`（`proxy_pass` 到 Vite）
  - `prod` → `nginx/snippets/frontend-static.conf`（`root frontend/dist` + SPA 回退）
- 生产片段内置 SPA 路由回退（`try_files $uri $uri/ /index.html`），
  保证刷新 `/dashboard/api-keys` 等子路由不 404；带哈希的静态资源强缓存 7 天，`index.html` 不缓存。

---

## 📁 项目结构

```
green_tracker/
├── backend/                    # FastAPI后端
│   ├── main.py                # 应用入口
│   ├── api/                   # API路由
│   │   ├── routes/            # 路由模块
│   │   │   ├── auth.py        # 认证
│   │   │   ├── device.py      # 设备
│   │   │   ├── field.py       # 地块
│   │   │   ├── algorithm.py   # 算法管理
│   │   │   ├── collection_session.py  # 采集会话
│   │   │   ├── raw_data.py    # 原始数据
│   │   │   ├── log.py         # 系统日志
│   │   │   ├── api_key.py     # API密钥
│   │   │   └── feedback.py    # 用户反馈
│   │   └── schemas/           # Pydantic模型
│   ├── database/              # 数据库
│   │   ├── db_models/         # SQLAlchemy模型
│   │   └── db_services/       # 业务服务
│   ├── storage/               # 存储服务
│   │   ├── container_manager.py   # Docker容器管理
│   │   └── dockerfile_generator.py # Dockerfile生成
│   ├── mqtt/                  # MQTT模块
│   │   ├── mqtt_client.py     # MQTT客户端
│   │   ├── device_manager.py  # 设备状态管理
│   │   ├── routes.py          # MQTT API路由
│   │   └── schemas.py         # MQTT数据模型
│   └── utils/                 # 工具函数
│
├── frontend/                   # React前端
│   ├── src/
│   │   ├── App.jsx            # 路由配置
│   │   ├── pages/             # 页面组件
│   │   │   ├── Home.jsx        # 首页
│   │   │   ├── Login.jsx       # 登录
│   │   │   ├── Dashboard/      # 仪表板
│   │   │   │   ├── Overview.jsx      # 概览
│   │   │   │   ├── Devices.jsx       # 设备管理
│   │   │   │   ├── Fields.jsx        # 地块管理
│   │   │   │   ├── Sessions.jsx      # 采集会话
│   │   │   │   ├── DataUpload.jsx    # 数据上传
│   │   │   │   ├── DataView.jsx      # 数据视图
│   │   │   │   ├── DataAnalyze.jsx   # 数据分析
│   │   │   │   ├── KeyManagement.jsx # 密钥管理
│   │   │   │   ├── AlgorithmSquare.jsx # 算法广场
│   │   │   │   ├── AlgorithmUse.jsx  # 算法使用
│   │   │   │   ├── Logs.jsx          # 系统日志
│   │   │   │   └── System.jsx        # 系统设置
│   │   ├── components/ui/     # UI组件库
│   │   ├── services/          # API服务
│   │   ├── hooks/             # React钩子
│   │   └── styles/            # 主题样式
│   └── package.json
│
├── nginx/                     # Nginx 配置
│   ├── green-tracker.conf.template   # 主站配置模板（占位符渲染）
│   ├── snippets/
│   │   ├── frontend-dev.conf         # 开发模式片段：反代 Vite dev server
│   │   └── frontend-static.conf      # 生产模式片段：服务 frontend/dist
│   └── ssl-params.conf               # TLS / 安全响应头通用参数
│
├── scripts/                   # 运维脚本
│   ├── render_nginx.sh        # Nginx 配置渲染 + dev/prod 模式切换
│   ├── setup_https.sh         # HTTPS 证书申请与一键部署
│   └── nginx.sh               # Nginx 服务管理与模式切换
├── docs/                      # 项目文档
├── .env.example               # 环境变量模板
├── Makefile                   # 项目命令
└── README.md
```

---

## 🎨 主题系统

| 主题 | 特点 | 预览 |
|------|------|------|
| 默认黑蓝 | 经典深色专业风格 | 🌙 |
| 明亮模式 | 清爽浅色设计 | ☀️ |
| 深色模式 | 纯黑极简风格 | 🌑 |
| 薄荷绿 | 小清新绿色调 | 🌿 |
| 日落橙 | 温暖橙色调 | 🌅 |
| 天空蓝 | 清新蓝色调 | 🌤️ |

主题仅影响Dashboard页面，其他页面保持默认样式。

---

## 🚀 算法部署功能

### 功能概述

算法广场提供完整的算法管理生命周期：

1. **浏览算法** - 查看所有可用算法及其描述
2. **本地部署** - 下载算法源码包进行本地部署
3. **云端部署** - 一键构建并部署算法容器
4. **在线推理** - 通过Web界面直接使用已部署算法
5. **容器管理** - 启动、停止、重启已部署算法

### 架构说明

```
前端 → 后端API (green-tracker.cn:6130) → 算法容器 (Docker)
                                      ↑
                              MinIO (存储镜像/数据)
```

### Docker容器管理

- **端口映射**: 容器内部固定8001端口，外部动态映射
- **健康检查**: 定时检查容器健康状态
- **重启策略**: 故障自动重启
- **资源隔离**: 每个算法独立容器运行

---

## 🔌 API 接口

### 认证 `/api/auth`

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /auth/register | 用户注册 |
| POST | /auth/login | 用户登录 |
| GET | /auth/verify | 验证Token |
| GET | /auth/me | 获取当前用户 |

### 设备 `/api/devices`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /devices | 获取设备列表 |
| POST | /devices | 创建设备 |
| GET | /devices/{id} | 获取设备详情 |
| PUT | /devices/{id} | 更新设备 |
| DELETE | /devices/{id} | 删除设备 |
| POST | /devices/{id}/activate | 激活设备 |
| POST | /devices/{id}/deactivate | 停用设备 |

### 算法 `/api/algorithms`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /algorithms | 获取算法列表 |
| POST | /algorithms/{id}/deploy | 部署算法 |
| POST | /algorithms/{id}/start | 启动算法容器 |
| POST | /algorithms/{id}/stop | 停止算法容器 |
| POST | /algorithms/{id}/restart | 重启算法容器 |
| DELETE | /algorithms/{id}/undeploy | 取消部署 |
| GET | /algorithms/{id}/health | 健康检查 |
| POST | /algorithms/{id}/infer | 在线推理 |

### 系统日志 `/api/logs`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /logs | 分页查询日志（支持按级别/来源/日期筛选） |
| GET | /logs/sources | 获取日志来源列表 |
| GET | /logs/export | 导出日志为 CSV |
| DELETE | /logs/{id} | 删除单条日志 |

日志记录覆盖认证、设备、地块、采集会话、数据、API密钥、算法等所有关键操作路径，支持 `error` / `warning` / `info` / `success` 四级分类。

### 其他模块

- `/api/fields` - 地块管理
- `/api/collection-sessions` - 采集会话管理
- `/api/raw-data` - 原始数据管理
- `/api/api-keys` - API密钥管理
- `/api/feedback` - 用户反馈
- `/api/logs` - 系统日志

---

## 🛠️ Makefile 命令

```bash
make help          # 查看所有可用命令
make install       # 安装所有依赖
make check-env     # 检查环境配置
make start         # 启动基础服务 (数据库 / MinIO / Nginx)
make dev           # 开发模式（前后端热加载）
make dev-frontend  # 仅前端
make dev-backend   # 仅后端
make stop          # 停止所有服务
make restart       # 重启服务
make clean         # 清理

# 构建 / 部署模式（开发热加载 vs 生产静态成品）
make build         # 构建前端生产产物到 frontend/dist
make deploy        # 一键: build + 切换到生产静态模式
make serve-prod    # 切换 Nginx 到生产模式（服务 dist/ 静态成品）
make serve-dev     # 切换 Nginx 到开发模式（反代 Vite，热加载）
make mode          # 查看当前前端模式（dev / prod）

# HTTPS / Nginx 管理
make setup-https   # 一键申请 HTTPS 证书并配置反向代理
make nginx-install # 安装 Nginx（首次部署）
make nginx-start   # 启动 Nginx
make nginx-stop    # 停止 Nginx
make nginx-reload  # 热加载 Nginx 配置
make nginx-status  # Nginx 状态
```

---

## 🔧 开发指南

### 前端开发

```bash
cd frontend
npm run dev        # 开发模式（Vite，HMR 热加载）
npm run build      # 生产构建（产物输出到 dist/）
npm run preview    # 本地预览构建产物
npm run lint       # 代码检查
```

构建完成后，用 `make serve-prod` 让 Nginx 切换到静态成品模式；
开发调试时用 `make serve-dev` 切回 Vite 热加载模式。

### 后端开发

```bash
cd backend
python -m uvicorn main:app --reload --port 6130
```

### 添加新页面

1. 在 `frontend/src/pages/Dashboard/` 创建页面组件
2. 在 `Dashboard.jsx` 添加路由
3. 如需认证保护，使用 `useAuth()` 检查登录状态

### 使用动画系统

```javascript
import { motion } from 'framer-motion'
import { fadeInUp } from '@/utils/animations'

// 在组件中使用
export const MyComponent = () => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={fadeInUp}
  >
    {/* Content */}
  </motion.div>
)
```

### 使用状态管理组件

```javascript
import { StateManager } from '@/components/ui'

// 统一状态管理
<StateManager
  state={loading ? 'loading' : error ? 'error' : empty ? 'empty' : 'success'}
  loadingText="正在加载..."
  emptyTitle="暂无数据"
>
  <YourContent />
</StateManager>
```

---

## 🔒 安全措施

- **JWT认证**: Token 30分钟过期，自动刷新
- **密码加密**: bcrypt哈希存储
- **输入验证**: Pydantic模型严格验证
- **CORS配置**: 跨域资源共享控制
- **多租户隔离**: 每个用户独立数据空间

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [ENV_CONFIG.md](docs/setup/ENV_CONFIG.md) | 环境变量配置详解 |
| [HTTPS_SETUP.md](docs/setup/HTTPS_SETUP.md) | **HTTPS 一键部署指南** |
| [docs/](docs/) | 详细技术文档 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新历史 |
| [screen_guide.md](docs/ops/screen_guide.md) | 界面截图指南 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - （仓库暂未附 LICENSE 文件，采用 MIT 条款）

---

**Green Tracker** - 让农业监测更智能、更美观 🌱
