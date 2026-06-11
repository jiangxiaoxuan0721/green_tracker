# 🌱 绿色追踪系统 (Green Tracker)

一个现代化的农业IoT环境监测仪表板，提供实时数据可视化、算法部署管理、多主题切换和智能设备管理功能。

[![FastAPI](https://img.shields.io/badge/FastAPI-0.124.4-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

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

详细配置请参考 [ENV_CONFIG.md](ENV_CONFIG.md)

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
├── scripts/                   # 运维脚本
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
make start         # 启动基础服务
make dev           # 开发模式（热加载）
make dev-frontend  # 仅前端
make dev-backend   # 仅后端
make stop          # 停止所有服务
make restart       # 重启服务
make clean         # 清理
```

---

## 🔧 开发指南

### 前端开发

```bash
cd frontend
npm run dev        # 开发模式
npm run build      # 生产构建
npm run lint       # 代码检查
```

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
| [ENV_CONFIG.md](ENV_CONFIG.md) | 环境变量配置详解 |
| [docs/](docs/) | 详细技术文档 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新历史 |
| [screen_guide.md](screen_guide.md) | 界面截图指南 |

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

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

**Green Tracker** - 让农业监测更智能、更美观 🌱
