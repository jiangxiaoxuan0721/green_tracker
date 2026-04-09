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
- **流畅动画**: 使用Framer Motion实现的平滑过渡效果
- **增强加载状态**: 优雅的加载动画、骨架屏和进度条
- **统一状态管理**: 标准化的加载、错误、空状态处理
- **算法广场**: 现代化的算法管理界面，支持一键部署

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

## ✨ UI/UX 优化更新 (2026-04-09)

### 🎯 全局改进
- **引入Framer Motion**: 为所有页面添加流畅的交互动画
- **增强组件库**: 新增强版加载组件、状态管理组件
- **统一设计语言**: 所有页面保持一致的交互模式和视觉反馈
- **性能优化**: 减少动画对性能敏感用户的资源消耗

### 🔥 主要页面优化

#### **首页 (Home Page)**
- 📱 响应式背景纹理和粒子动画
- 🎯 互动式功能卡片，带悬浮和点击反馈
- 📊 动态统计展示区，带脉动效果
- 🌈 渐变标题和增强按钮视觉效果
- 💫 视差滚动元素展示核心功能

#### **登录页面 (Login Page)**
- 🔮 粒子背景动画增强视觉吸引力
- ✨ 动态图标和表单元素
- 💡 智能错误提示，带平滑动画
- 🎭 增强的认证加载状态
- 📱 完全响应式设计，移动端体验优化

#### **算法广场 (Algorithm Square)**
- 🧩 现代化卡片式布局，带操作菜单
- 🚀 快捷操作：构建、启动、停止、重启等
- 💾 "本地部署"功能优化，支持公开下载
- 📊 状态指示器和健康检查展示
- 🔄 重新构建功能，支持算法更新

#### **通用组件增强**
- **EnhancedLoading**: 现代化的加载动画、骨架屏、进度条
- **StateManager**: 统一的状态（加载/错误/空状态）管理
- **动画工具集**: 预定义的动画变体和缓动函数
- **统一反馈**: 所有操作提供视觉和动效反馈

### 🚀 技术升级
- **新增依赖**: 
  - `framer-motion`: 专业的React动画库
  - `clsx`: 条件类名管理工具
- **组件标准化**: 所有核心组件支持动画属性
- **性能考虑**: 实现`prefers-reduced-motion`支持
- **可访问性**: 改进键盘导航和屏幕阅读器支持

### 🎯 设计原则
1. **一致性**: 所有页面保持相同的设计模式和交互逻辑
2. **反馈性**: 每个用户操作都有明确的视觉反馈
3. **流畅性**: 平滑的动画过渡提升用户体验
4. **可访问性**: 确保所有用户都能无障碍使用
5. **性能**: 在不影响性能的前提下提供最佳体验

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

### UI界面开发指南
#### 使用新动画系统
```javascript
import { motion, AnimatePresence } from 'framer-motion'
import { fadeInUp, scaleIn } from '@/utils/animations'

// 在组件中使用
export const MyComponent = () => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={fadeInUp}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {/* Content */}
  </motion.div>
)
```

#### 使用状态管理组件
```javascript
import { StateManager, DataGridState, EnhancedLoading } from '@/components/ui'

// 统一状态管理
<StateManager
  state={loading ? 'loading' : error ? 'error' : empty ? 'empty' : 'success'}
  loadingText="正在加载数据..."
  errorTitle="加载失败"
  errorMessage={error?.message}
  emptyTitle="暂无数据"
>
  <YourContent />
</StateManager>

// 数据表格状态
<DataGridState
  loading={loading}
  error={error}
  isEmpty={data.length === 0}
  totalItems={data.length}
  onRefresh={fetchData}
>
  <DataTable data={data} />
</DataGridState>
```

#### 自定义动画效果
```javascript
// 在 src/utils/animations.js 中添加
export const customAnimation = {
  hidden: { opacity: 0, scale: 0 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.5,
      ease: "easeOut"
    }
  }
}
```

---

## 🔒 安全措施

- **JWT认证**: Token 30分钟过期，自动刷新
- **密码加密**: bcrypt哈希存储
- **输入验证**: Pydantic模型严格验证
- **CORS配置**: 跨域资源共享控制
- **多租户隔离**: 每个用户独立数据库

### 🐛 近期修复与优化

#### **算法部署功能修复**
- ✅ **端口映射问题**: 修复算法容器内部端口硬编码为8000
- ✅ **镜像构建**: Dockerfile统一使用固定端口配置
- ✅ **重启逻辑**: 修复容器重启时的镜像检查问题
- ✅ **下载API**: 修复算法包下载时的认证问题，支持公开下载

#### **前端体验优化**
- ✅ **算法广场UI**: 重构按钮布局，采用"主操作+菜单"设计
- ✅ **状态管理**: 统一加载、错误、空状态显示
- ✅ **下载功能**: 改进大文件下载体验，提供备用方案
- ✅ **动画系统**: 引入Framer Motion实现流畅过渡

#### **后端稳定性**
- ✅ **流式响应**: 下载API改为流式传输，避免内存问题
- ✅ **错误处理**: 统一异常处理和日志记录
- ✅ **认证优化**: 敏感操作保持认证，公开操作移除认证
- ✅ **容器管理**: 改进Docker容器生命周期管理

---

## 🎯 功能路线图

### 近期计划
- 🔄 **实时数据推送** - WebSocket支持实时设备数据更新
- 📡 **MQTT集成** - 物联网协议直接集成
- 🗺️ **地图增强** - 更丰富的地理空间功能
- 📊 **报表系统** - 数据分析报告自动生成
- 🔐 **权限系统** - 精细化的角色权限控制

### 用户反馈集成
- 💬 **用户满意度** - 收集用户界面体验反馈
- ⚡ **性能监控** - 前后端性能指标收集
- 🐞 **错误上报** - 自动化的错误跟踪和修复

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
