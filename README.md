# 绿色追踪系统 (Green Tracker)

一个现代化的农业IoT环境监测仪表板，提供实时数据可视化、多主题切换和智能设备管理功能。

项目地址：https://github.com/jiangxiaoxuan0721/green_tracker

## 🌟 项目特色

- **全栈架构**: React + FastAPI + PostgreSQL + PostGIS + MinIO
- **实时数据监测**: 温度、湿度、空气质量等环境参数实时展示
- **多主题系统**: 6种精美主题，包括默认、明亮、深色、薄荷绿、日落橙、天空蓝
- **响应式设计**: 完美适配桌面和移动设备
- **可折叠面板**: 优化的用户界面，支持面板收起和展开
- **地理信息支持**: 基于 PostGIS 的空间数据管理
- **对象存储**: MinIO 文件存储集成
- **JWT认证**: 完整的用户认证和授权系统
- **设备管理**: 集中化设备监控和管理
- **数据分析**: 多维度数据分析和可视化
- **地块管理**: 基于地理位置的地块管理功能

## 🚀 技术栈

### 前端
- **React 18.2.0** - 用户界面构建
- **Vite 5.0.8** - 现代化构建工具
- **React Router 6.8.0** - 路由管理
- **Axios 1.6.0** - HTTP请求处理
- **CSS3** - 自定义CSS变量实现主题系统
- **@radix-ui/react-accordion** - 手风琴组件
- **react-apexcharts** - 数据可视化图表
- **react-icons** - UI图标库

### 后端
- **FastAPI 0.124.4** - 高性能异步Web框架
- **Python 3.8+** - 编程语言
- **SQLAlchemy 2.0.45** - ORM框架
- **GeoAlchemy2 0.18.1** - 空间数据支持
- **Uvicorn 0.38.0** - ASGI服务器
- **psycopg2-binary 2.9.10** - PostgreSQL数据库连接器
- **alembic 1.14.0** - 数据库迁移管理
- **pydantic 2.9.2** - 数据验证和序列化
- **python-jose 3.3.0** - JWT处理
- **passlib 1.7.4** - 密码处理
- **python-multipart 0.0.12** - 表单数据处理
- **PostgreSQL** - 关系型数据库
- **PostGIS** - 地理空间扩展
- **MinIO** - 对象存储服务
- **JWT认证** - 用户认证授权

## 📁 项目结构

```
green_tracker/
├── .env                     # 环境配置（不提交）
├── .env.example             # 环境配置示例
├── .gitignore               # Git忽略文件
├── CHANGELOG.md             # 变更日志
├── ENV_CONFIG.md            # 环境配置说明
├── Makefile                 # 项目管理命令
├── README.md                # 项目说明文档
├── REPORTS.md               # 完整项目文档
├── backend/                 # FastAPI后端项目
│   ├── api/                 # API接口目录
│   │   ├── Preview.json     # API预览文档
│   │   ├── routes/          # 路由目录
│   │   │   ├── auth.py              # 认证路由
│   │   │   ├── collection_session.py # 采集会话路由
│   │   │   ├── device.py            # 设备路由
│   │   │   ├── feedback.py          # 反馈路由
│   │   │   ├── field.py             # 地块路由
│   │   │   └── raw_data.py          # 原始数据路由
│   │   └── schemas/          # 模式定义目录
│   │       ├── auth.py              # 认证模式
│   │       ├── collection_session.py # 采集会话模式
│   │       ├── device.py            # 设备模式
│   │       ├── feedback.py          # 反馈模式
│   │       ├── field.py             # 地块模式
│   │       └── raw_data.py          # 原始数据模式
│   ├── database/            # 数据库目录
│   │   ├── main_db.py       # 数据库连接配置
│   │   ├── db_builder/      # 数据库构建器目录
│   │   │   ├── build_all.py          # 数据库构建总脚本
│   │   │   ├── collection_session_table.py # 采集会话表构建
│   │   │   ├── device_table.py      # 设备表构建
│   │   │   ├── feedback_table.py    # 反馈表构建
│   │   │   ├── field_table.py       # 地块表构建
│   │   │   ├── manage_user_tables.py # 用户表管理
│   │   │   ├── raw_data_table.py    # 原始数据表构建
│   │   │   ├── user_raw_data_table.py # 用户原始数据表构建
│   │   │   └── user_table.py        # 用户表构建
│   │   ├── db_models/       # 数据模型目录
│   │   │   ├── collection_session_model.py # 采集会话模型
│   │   │   ├── device_model.py      # 设备模型
│   │   │   ├── feedback_model.py    # 反馈模型
│   │   │   ├── field_model.py       # 地块模型
│   │   │   ├── raw_data_model.py    # 原始数据模型
│   │   │   └── user_model.py        # 用户模型
│   │   └── db_services/     # 数据库服务目录
│   │       ├── collection_session_service.py # 采集会话服务
│   │       ├── device_service.py    # 设备服务
│   │       ├── feedback_service.py  # 反馈服务
│   │       ├── field_service.py     # 地块服务
│   │       ├── raw_data_service.py  # 原始数据服务
│   │       ├── user_raw_data_service.py # 用户原始数据服务
│   │       └── user_service.py      # 用户服务
│   ├── init_db.py             # 数据库初始化脚本
│   ├── main.py               # FastAPI应用入口
│   ├── pyproject.toml        # 项目配置
│   └── requirements.txt      # Python依赖
├── documents/               # 文档目录
│   ├── collection_session.sql # 采集会话表结构
│   ├── create_optimized_tables.sql # 优化表结构
│   ├── create_user_raw_data_tables.sql # 用户原始数据表结构
│   ├── crop_object.sql       # 作物对象结构
│   ├── database_migration_guide.md # 数据库迁移指南
│   ├── device.sql            # 设备表结构
│   ├── feedback_table.sql    # 反馈表结构
│   ├── field.sql             # 地块表结构
│   ├── minio_documentation.md # MinIO文档
│   ├── optimized_database_design.md # 优化数据库设计
│   ├── raw_data.sql          # 原始数据表结构
│   ├── updated_raw_data_design.md # 更新的原始数据设计
│   └── user_raw_data_guide.md # 用户原始数据指南
├── frontend/                # React前端项目
│   ├── index.html           # HTML入口
│   ├── package.json         # 项目配置和依赖
│   ├── package-lock.json    # 依赖锁定文件
│   ├── tsconfig.json        # TypeScript配置
│   ├── vite.config.js       # Vite构建配置
│   ├── public/              # 公共资源目录
│   │   └── vite.svg         # Vite图标
│   └── src/                 # 源代码目录
│       ├── App.css           # 应用样式
│       ├── App.jsx           # 应用组件
│       ├── index.css         # 全局样式
│       ├── main.jsx          # 应用入口
│       ├── vite-env.d.ts     # Vite环境类型定义
│       ├── components/       # 组件目录
│       │   ├── Navbar.css    # 导航栏样式
│       │   ├── Navbar.jsx    # 导航栏组件
│       │   └── common/       # 通用组件
│       │       ├── DetailModal.css # 详情模态框样式
│       │       ├── DetailModal.jsx # 详情模态框组件
│       │       ├── ItemCard.css    # 卡片样式
│       │       └── ItemCard.jsx    # 卡片组件
│       ├── hooks/            # 钩子目录
│       │   └── auth/         # 认证钩子
│       │       ├── index.ts      # 认证钩子导出
│       │       ├── useAuth.tsx   # 认证钩子
│       │       ├── useLoginForm.ts # 登录表单钩子
│       │       └── useRegisterForm.ts # 注册表单钩子
│       ├── pages/            # 页面目录
│       │   ├── About/        # 关于页面
│       │   │   ├── About.css
│       │   │   └── About.jsx
│       │   ├── Contact/      # 联系页面
│       │   │   ├── Contact.css
│       │   │   └── Contact.jsx
│       │   ├── Dashboard/    # 仪表板页面
│       │   │   ├── AdditionalStyles.css # 附加样式
│       │   │   ├── Dashboard.css        # 仪表板样式
│       │   │   ├── Dashboard.jsx        # 仪表板组件
│       │   │   ├── components/          # 仪表板组件
│       │   │   │   ├── Modal.jsx        # 模态框组件
│       │   │   │   ├── SettingItem.jsx  # 设置项组件
│       │   │   │   ├── SettingsTab.jsx  # 设置标签页
│       │   │   │   └── ThemeSelector.jsx # 主题选择器
│       │   │   ├── DataAnalyze/         # 数据分析
│       │   │   │   ├── DataAnalyze.css
│       │   │   │   └── DataAnalyze.jsx
│       │   │   ├── DataView/            # 数据视图
│       │   │   │   ├── DataDetailModal.css # 数据详情模态框样式
│       │   │   │   ├── DataDetailModal.jsx # 数据详情模态框
│       │   │   │   ├── DataView.css
│       │   │   │   ├── DataView.jsx
│       │   │   │   └── README.md
│       │   │   ├── Devices/             # 设备管理
│       │   │   │   ├── Devices.css
│       │   │   │   ├── Devices.jsx
│       │   │   │   └── components/      # 设备组件
│       │   │   │       ├── DeviceDetail.css
│       │   │   │       └── DeviceDetail.jsx
│       │   │   ├── Fields/              # 字段管理
│       │   │   │   ├── Fields.css
│       │   │   │   └── Fields.jsx
│       │   │   ├── Logs/                # 日志页面
│       │   │   │   └── Logs.jsx
│       │   │   ├── Overview/            # 概览页面
│       │   │   │   └── Overview.jsx
│       │   │   ├── Sessions/            # 会话管理
│       │   │   │   ├── Sessions.css
│       │   │   │   └── Sessions.jsx
│       │   │   └── System/              # 系统页面
│       │   │       └── System.jsx
│       │   ├── Feedback/     # 反馈页面
│       │   │   ├── Feedback.css
│       │   │   └── Feedback.jsx
│       │   ├── Home/          # 首页
│       │   │   ├── Home.css
│       │   │   └── Home.jsx
│       │   ├── Login/         # 登录页面
│       │   │   ├── Login.css
│       │   │   └── Login.jsx
│       │   ├── NotFound/       # 404页面
│       │   │   ├── NotFound.css
│       │   │   └── NotFound.jsx
│       │   └── Register/      # 注册页面
│       │       ├── Register.css
│       │       └── Register.jsx
│       ├── services/         # 服务目录
│       │   ├── api.ts               # API基础配置
│       │   ├── authService.ts       # 认证服务
│       │   ├── collectionSessionService.ts # 采集会话服务
│       │   ├── deviceService.ts     # 设备服务
│       │   ├── feedbackService.ts   # 反馈服务
│       │   ├── fieldService.ts      # 地块服务
│       │   └── rawDataService.ts    # 原始数据服务
│       ├── styles/           # 样式目录
│       │   ├── dark-theme.css       # 深色主题
│       │   ├── light-theme.css      # 明亮主题
│       │   ├── mint-green-theme.css # 薄荷绿主题
│       │   ├── README.md            # 样式说明
│       │   ├── sky-blue-theme.css   # 天空蓝主题
│       │   ├── sunset-theme.css     # 日落主题
│       │   └── variables.css        # CSS变量
│       └── utils/            # 工具目录
│           ├── env.ts               # 环境工具
│           └── vite-env.d.ts        # Vite环境类型定义
├── scripts/                 # 脚本目录
│   ├── postgres-install.sh # PostgreSQL安装脚本
│   ├── start-minio.sh      # MinIO启动脚本
│   ├── start-services.sh   # 启动服务脚本
│   └── stop-services.sh    # 停止服务脚本
└── tests/                   # 测试目录
    └── api_test.py         # API测试文件
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

系统提供以下API接口，共29个端点：

#### 认证 API (`/api/auth`)
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/password` - 修改密码
- `GET /api/auth/validate` - Token验证

#### 设备 API (`/api/devices`)
- `GET /api/devices` - 获取设备列表
- `POST /api/devices` - 创建设备
- `GET /api/devices/{id}` - 获取设备详情
- `PUT /api/devices/{id}` - 更新设备
- `DELETE /api/devices/{id}` - 删除设备
- `POST /api/devices/{id}/activate` - 激活设备
- `POST /api/devices/{id}/deactivate` - 停用设备

#### 采集任务 API (`/api/collection-sessions`)
- `GET /api/collection-sessions` - 获取采集任务列表
- `POST /api/collection-sessions` - 创建采集任务
- `GET /api/collection-sessions/{id}` - 获取采集任务详情
- `PUT /api/collection-sessions/{id}` - 更新采集任务
- `DELETE /api/collection-sessions/{id}` - 删除采集任务

#### 原始数据管理 API (`/api/raw-data`)
- `GET /api/raw-data` - 获取原始数据列表
- `POST /api/raw-data` - 创建原始数据
- `GET /api/raw-data/{id}` - 获取原始数据详情
- `PUT /api/raw-data/{id}` - 更新原始数据
- `DELETE /api/raw-data/{id}` - 删除原始数据

#### 地块管理 API (`/api/fields`)
- `GET /api/fields` - 获取地块列表
- `POST /api/fields` - 创建地块
- `GET /api/fields/{id}` - 获取地块详情
- `PUT /api/fields/{id}` - 更新地块
- `DELETE /api/fields/{id}` - 删除地块

#### 反馈 API (`/api/feedback`)
- `GET /api/feedback` - 获取反馈列表
- `POST /api/feedback` - 提交反馈

### 数据库模型

- **User** - 用户表（用户ID、用户名、邮箱、密码哈希、创建时间）
- **Field** - 地块表（地块ID、名称、描述、地理信息、面积、创建时间）
- **Device** - 设备表（设备ID、名称、型号、状态、所属地块、创建时间）
- **CollectionSession** - 采集会话表（会话ID、名称、描述、状态、创建时间）
- **RawData** - 原始数据表（数据ID、采集时间、数值、类型、设备ID、会话ID、创建时间）
- **RawDataTag** - 原始数据标签表（标签ID、名称、描述）
- **Feedback** - 反馈表（反馈ID、标题、内容、用户ID、创建时间）

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
- [完整项目文档](REPORTS.md) - 包含API文档、前端设计、环境配置、部署与运维、安全等完整文档

## 🏗️ 系统架构

绿色追踪系统采用前后端分离架构，整体由以下部分组成：

1. **前端层** - React构建的单页应用，提供用户交互界面
2. **后端服务层** - FastAPI构建的RESTful API服务，处理业务逻辑
3. **数据存储层** - PostgreSQL+PostGIS存储结构化和空间数据，MinIO存储文件
4. **外部服务** - MinIO对象存储服务，用于文件管理
5. **网络层** - 基于HTTP/HTTPS的前后端通信

系统整体设计遵循高内聚、低耦合的原则，各层之间通过明确的接口进行通信，便于独立开发、测试和部署。

## 🔒 安全措施

系统采用多层级安全措施保护数据和系统安全：

1. **认证与授权** - JWT令牌认证机制，API路由保护
2. **数据加密** - 密码哈希存储，敏感数据传输加密
3. **输入验证** - Pydantic模型验证，防止注入攻击
4. **CORS配置** - 跨域资源共享限制
5. **环境变量** - 敏感配置外部化管理

## 🌐 部署架构

系统支持多种部署方式，满足不同场景需求：

1. **开发环境** - 本地开发热加载，前后端分离运行
2. **测试环境** - 容器化部署，自动化测试
3. **生产环境** - 高可用集群部署，负载均衡
4. **云原生部署** - Kubernetes容器编排，微服务架构

详细的部署指南请参考[完整项目文档](REPORTS.md)中的第5章"部署与运维"。

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