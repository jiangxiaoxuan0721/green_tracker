# 🌱 绿色追踪系统 (Green Tracker)

一个现代化的农业IoT环境监测仪表板，提供实时数据可视化、多主题切换和智能设备管理功能。

[![FastAPI](https://img.shields.io/badge/FastAPI-0.124.4-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[项目地址](https://github.com/jiangxiaoxuan0721/green_tracker) · [文档](docs/) · [反馈](https://github.com/jiangxiaoxuan0721/green_tracker/issues)

---

## ✨ 项目特色

### 🏗️ 全栈架构
| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + Vite + TypeScript | 现代化响应式SPA |
| 后端 | FastAPI + SQLAlchemy 2.0 | 高性能异步API |
| 数据库 | PostgreSQL + PostGIS | 关系型 + 地理空间 |
| 存储 | MinIO | S3兼容对象存储 |

### 📊 核心功能
| 模块 | 说明 |
|------|------|
| 设备管理 | IoT设备状态监控与控制 |
| 地块管理 | 基于PostGIS的地理空间管理 |
| 数据采集 | 采集会话与原始数据管理 |
| 数据分析 | 多维度数据可视化与分析 |
| API密钥 | 支持设备无界面数据上传 |
| 多租户 | 每个用户独立数据库 |

### 🎨 用户体验
- **6种精美主题**: 默认黑蓝、明亮模式、深色模式、薄荷绿、日落橙、天空蓝
- **响应式设计**: 桌面、平板、移动设备完美适配
- **可折叠面板**: 优化的用户界面交互
- **JWT认证**: 安全的用户认证授权系统

---

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- Python >= 3.8
- PostgreSQL >= 12 (需PostGIS扩展)
- Docker (用于MinIO)

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
make dev-backend    # 后端: http://localhost:6130
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
│   │   │   ├── raw_data.py    # 原始数据
│   │   │   └── ...
│   │   └── schemas/           # Pydantic模型
│   └── database/              # 数据库
│       ├── db_models/         # SQLAlchemy模型
│       ├── db_services/        # 业务服务
│       └── main_db.py         # 连接配置
│
├── frontend/                   # React前端
│   ├── src/
│   │   ├── App.jsx            # 路由配置
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard/     # 仪表板
│   │   │   │   ├── Overview.jsx      # 概览
│   │   │   │   ├── Devices.jsx       # 设备
│   │   │   │   ├── Fields.jsx        # 地块
│   │   │   │   ├── DataView.jsx       # 数据视图
│   │   │   │   └── DataAnalyze.jsx    # 数据分析
│   │   │   └── ...
│   │   ├── services/          # API服务
│   │   ├── hooks/             # React钩子
│   │   └── styles/            # 主题样式
│   └── package.json
│
├── scripts/                   # 运维脚本
│   ├── start-services.sh     # 启动基础服务
│   └── stop-services.sh       # 停止服务
│
├── docs/                      # 项目文档
├── .env.example              # 环境变量模板
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

### 地块 `/api/fields`
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /fields | 获取地块列表 |
| POST | /fields | 创建地块 |
| GET | /fields/{id} | 获取地块详情 |
| PUT | /fields/{id} | 更新地块 |
| DELETE | /fields/{id} | 删除地块 |

### 其他模块
- `/api/collection-sessions` - 采集会话管理
- `/api/raw-data` - 原始数据管理
- `/api/feedback` - 用户反馈
- `/api/api-keys` - API密钥管理

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

### 添加新主题
1. 在 `frontend/src/styles/` 创建主题CSS文件
2. 在 `ThemeSelector.jsx` 添加选项
3. 定义完整的CSS变量覆盖

### 添加新页面
1. 在 `frontend/src/pages/` 创建页面组件
2. 在 `App.jsx` 添加路由
3. 如需认证保护，使用 `useAuth()` 检查登录状态

---

## 🔒 安全措施

- **JWT认证**: Token 30分钟过期，自动刷新
- **密码加密**: bcrypt哈希存储
- **输入验证**: Pydantic模型严格验证
- **CORS配置**: 跨域资源共享控制
- **多租户隔离**: 每个用户独立数据库

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [ENV_CONFIG.md](ENV_CONFIG.md) | 环境变量配置详解 |
| [docs/](docs/) | 详细技术文档 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新历史 |

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

**Green Tracker** - 让环境监测更智能、更美观 🌱
