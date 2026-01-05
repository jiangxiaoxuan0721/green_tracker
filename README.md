# 绿色追踪系统 (Green Tracker)

一个现代化的IoT环境监测仪表板，提供实时数据可视化、多主题切换和智能设备管理功能。
项目地址：https://github.com/jiangxiaoxuan0721/green_tracker

## 🌟 项目特色

- **全栈架构**: React + FastAPI + PostgreSQL + PostGIS + MinIO
- **实时数据监测**: 温度、湿度、空气质量等环境参数实时展示
- **多主题系统**: 6种精美主题，包括默认、明亮、深色、薄荷绿、日落橙、天空蓝
- **响应式设计**: 完美适配桌面和移动设备
- **可折叠面板**: 优化的用户界面，支持面板收起和展开
- **地理信息支持**: 基于 PostGIS 的空间数据管理
- **对象存储**: MinIO 文件存储集成

## 🚀 技术栈

### 前端
- **React 18.2.0** - 用户界面构建
- **Vite 5.0.8** - 现代化构建工具
- **React Router 6.8.0** - 路由管理
- **Axios 1.6.0** - HTTP请求处理
- **CSS3** - 自定义CSS变量实现主题系统

### 后端
- **FastAPI 0.124.4** - 高性能异步Web框架
- **Python 3.8+** - 编程语言
- **SQLAlchemy 2.0.45** - ORM框架
- **GeoAlchemy2 0.18.1** - 空间数据支持
- **Uvicorn 0.38.0** - ASGI服务器
- **PostgreSQL** - 关系型数据库
- **PostGIS** - 地理空间扩展
- **MinIO** - 对象存储服务
- **JWT认证** - 用户认证授权

## 📁 项目结构

```
green_tracker/
├── frontend/                 # React前端项目
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── Dashboard/   # 仪表板页面
│   │   │   │   ├── Overview/      # 概览
│   │   │   │   ├── DataAnalyze/   # 数据分析
│   │   │   │   ├── DataView/      # 数据视图
│   │   │   │   ├── Devices/       # 设备管理
│   │   │   │   ├── Fields/        # 地块管理
│   │   │   │   └── Logs/          # 日志查看
│   │   │   ├── Home/        # 首页
│   │   │   └── Login/       # 登录页面
│   │   ├── components/      # 共用组件
│   │   └── services/        # API服务
│   └── package.json
├── backend/                 # FastAPI后端项目
│   ├── api/                 # API路由
│   │   └── routes/          # 路由模块
│   │       ├── auth.py              # 认证路由
│   │       ├── field.py             # 地块路由
│   │       ├── device.py            # 设备路由
│   │       ├── collection_session.py # 采集会话路由
│   │       ├── raw_data.py          # 原始数据路由
│   │       └── feedback.py          # 反馈路由
│   ├── database/            # 数据库模块
│   │   ├── db_models/       # 数据库模型
│   │   ├── db_services/     # 数据库服务
│   │   ├── db_builder/      # 数据库构建脚本
│   │   └── main_db.py       # 数据库连接配置
│   ├── services/            # 业务逻辑服务
│   ├── utils/               # 工具函数
│   ├── main.py              # FastAPI应用入口
│   ├── init_db.py           # 数据库初始化脚本
│   └── pyproject.toml       # 项目配置
├── scripts/                 # 管理脚本
│   ├── start-services.sh    # 启动服务
│   ├── stop-services.sh     # 停止服务
│   ├── manage-postgres.sh   # PostgreSQL管理
│   └── start-minio.sh       # MinIO启动脚本
├── documents/               # 文档
│   ├── database_migration_guide.md
│   ├── minio_documentation.md
│   └── *.sql                # 数据库表结构
├── tests/                   # 测试文件
├── Makefile                 # 项目管理命令
├── CHANGELOG.md             # 变更日志
├── ENV_CONFIG.md            # 环境配置说明
├── .env                     # 环境配置（不提交）
├── .env.example             # 环境配置示例
└── README.md
```

## 🎨 主题系统

系统提供6种精心设计的主题：

| 主题名称 | 特点 | 适用场景 |
|---------|------|----------|
| 默认黑蓝 | 经典深色专业风格 | 企业环境、夜间使用 |
| 明亮模式 | 清爽浅色设计 | 日间办公、明亮环境 |
| 深色模式 | 纯黑极简风格 | 护眼模式、专注工作 |
| 薄荷绿 | 小清新绿色调 | 自然环保主题 |
| 日落橙 | 温暖橙色调 | 温馨舒适的视觉体验 |
| 天空蓝 | 清新蓝色调 | 科技感与清新并存 |

**主题特点：**
- 仅影响Dashboard页面，其他页面保持默认样式
- 使用CSS自定义属性实现流畅切换
- 支持localStorage持久化存储
- 完整的色彩变量覆盖

## 🛠️ 环境要求

### 前端
- **Node.js**: v16.0.0+
- **npm**: v7.0.0+

### 后端
- **Python**: v3.8+
- **PostgreSQL**: v12+ (需安装 PostGIS 扩展)
- **Docker**: 用于 MinIO 服务

## 📦 安装与运行

### 1. 克隆项目
```bash
git clone <repository-url>
cd green_tracker
```

### 2. 环境变量配置
```bash
# 复制环境变量文件
cp .env.example .env

# 编辑环境变量（根据实际环境修改）
nano .env
```

关键配置项：
```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=green_tracker
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# MinIO配置
MINIO_ENDPOINT=localhost
MINIO_PORT=3001
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# 前端配置
PORT=3010
VITE_API_BASE_URL=http://localhost:6130

# 后端配置
API_HOST=0.0.0.0
API_PORT=6130
```

### 3. 安装依赖
```bash
# 使用 Makefile 一键安装
make install

# 或手动安装
cd backend && pip install -e .
cd ../frontend && npm install
```

### 4. 启动服务

#### 方式一：使用 Makefile（推荐）
```bash
# 启动所有服务（包括数据库和MinIO）
make start

# 开发模式（同时启动前后端，支持热加载）
make dev

# 仅启动前端
make dev-frontend

# 仅启动后端
make dev-backend

# 停止所有服务
make stop
```

#### 方式二：手动启动
```bash
# 启动基础服务（PostgreSQL和MinIO）
./scripts/start-services.sh

# 启动后端（热加载）
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 6130

# 启动前端（热加载）
cd frontend
npm run dev
```

### 5. 初始化数据库
```bash
# 创建数据库和用户
sudo -u postgres psql -c "CREATE USER your_db_username WITH PASSWORD 'your_db_password';"
sudo -u postgres psql -c "CREATE DATABASE green_tracker;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE green_tracker TO your_db_username;"

# 启用PostGIS扩展
sudo -u postgres psql -d green_tracker -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 创建数据表
cd backend
python init_db.py
```

### 6. 构建生产版本
```bash
# 构建前端
cd frontend
npm run build

# 后端生产环境运行（使用uvicorn）
cd ../backend
uvicorn main:app --host 0.0.0.0 --port 6130 --workers 4
```

## 🎯 核心功能

### Dashboard仪表板
- **实时数据展示**: 环境监测数据可视化
- **控制面板**: 可收起的侧边控制栏
- **快速操作**: 右侧快捷操作面板
- **主题切换**: 系统设置中的主题选择器

### 数据管理模块

#### 概览（Overview）
- 系统整体状态概览
- 关键指标统计
- 快速访问入口

#### 数据分析（DataAnalyze）
- 数据图表可视化
- 趋势分析
- 多维度数据对比

#### 数据视图（DataView）
- 原始数据列表展示
- 数据详情查看
- 数据筛选和搜索

#### 设备管理（Devices）
- 设备列表管理
- 设备信息查看
- 设备状态监控
- 设备创建/编辑/删除

#### 地块管理（Fields）
- 地块列表管理
- 地块地理信息（PostGIS）
- 地块信息编辑
- 地块状态管理

#### 日志查看（Logs）
- 系统日志展示
- 操作记录追踪
- 错误日志查看

### 用户系统
- 用户登录/注册
- JWT认证授权
- 登录状态持久化
- 受保护的路由

### API路由

- **认证**: `/api/auth` - 用户认证
- **地块**: `/api/fields` - 地块CRUD操作
- **设备**: `/api/devices` - 设备CRUD操作
- **采集会话**: `/api/collection-sessions` - 数据采集会话管理
- **原始数据**: `/api/raw-data` - 原始数据管理
- **反馈**: `/api/feedback` - 用户反馈收集

### 数据库模型

- **User** - 用户表
- **Field** - 地块表（包含地理位置几何字段）
- **Device** - 设备表
- **CollectionSession** - 采集会话表
- **RawData** - 原始数据表
- **RawDataTag** - 原始数据标签表
- **Feedback** - 反馈表

### 页面导航
- 首页介绍
- 登录页面
- 仪表板主页面

## 🔧 开发指南

### 前端开发
- 使用ESLint进行代码检查
- 遵循React Hooks最佳实践
- CSS模块化管理
- 组件化开发，代码复用

### 后端开发
- 遵循FastAPI最佳实践
- 使用SQLAlchemy ORM操作数据库
- RESTful API设计规范
- 异步编程提高性能
- JWT认证保护API端点

### 主题开发
如需添加新主题：
1. 在`src/pages/Dashboard/`目录的主题相关文件中添加新主题CSS变量
2. 在`ThemeSelector.jsx`中添加主题选项
3. 定义完整的CSS变量集合

### 数据库操作
- 使用 `init_db.py` 初始化数据库
- 通过 `db_services` 模块进行数据操作
- 使用 `db_models` 定义数据模型
- 参考 `documents/` 目录下的SQL文件了解表结构

### API集成
- 前端使用Axios进行HTTP请求
- 支持环境变量配置API地址
- 错误处理和加载状态管理
- JWT Token自动注入

### Makefile命令
```bash
make help          # 查看所有可用命令
make install       # 安装所有依赖
make check-env     # 检查环境配置
make start         # 启动所有服务
make dev           # 开发模式
make dev-frontend  # 仅启动前端
make dev-backend   # 仅启动后端
make stop          # 停止所有服务
make restart       # 重启所有服务
make clean         # 清理临时文件和容器
```

### 测试
```bash
# 运行测试
cd tests
python api_test.py
```

## 📱 响应式设计

- **桌面端**: 完整功能的仪表板界面
- **平板端**: 适配的中等尺寸布局
- **移动端**: 简化的移动友好界面

## 🌐 浏览器支持

- Chrome/Edge (推荐)
- Firefox
- Safari
- 现代移动浏览器

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 项目Issues: [GitHub Issues](link-to-issues)
- 邮箱: 3335447591@qq.com

## 📚 相关文档

- [变更日志](CHANGELOG.md) - 查看详细的版本更新历史
- [环境配置说明](ENV_CONFIG.md) - 详细的环境变量配置指南
- [数据库迁移指南](documents/database_migration_guide.md) - 数据库迁移和结构说明
- [MinIO文档](documents/minio_documentation.md) - MinIO对象存储使用说明
- [用户原始数据指南](documents/user_raw_data_guide.md) - 用户数据管理说明

## 🔒 安全注意事项

- 生产环境请使用强随机密钥替换 `SECRET_KEY`
- 请勿将 `.env` 文件提交到版本控制系统
- 生产环境请配置适当的 `CORS_ORIGINS`
- 数据库密码请使用复杂密码
- 定期更新依赖包以修复安全漏洞

## 🐛 常见问题

### 1. 数据库连接失败
检查PostgreSQL服务是否启动，以及 `.env` 文件中的数据库配置是否正确。

### 2. PostGIS扩展无法创建
确保已安装PostGIS扩展：
```bash
sudo apt-get install postgis postgresql-12-postgis-3
```

### 3. MinIO连接失败
检查Docker服务是否运行，使用 `make start` 启动MinIO服务。

### 4. 前端无法连接后端
检查 `.env` 文件中的 `VITE_API_BASE_URL` 是否正确指向后端地址。

---

**Green Tracker** - 让环境监测更智能、更美观 🌱