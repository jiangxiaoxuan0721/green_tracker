# 环境配置说明

## 概述

本项目使用环境变量进行配置管理，所有配置都集中在根目录的 `.env` 文件中。`.env.example` 文件提供了配置模板，请勿将包含敏感信息的 `.env` 文件提交到版本控制系统。

## 配置文件

- `.env.example` - 配置模板文件
- `.env` - 实际环境配置文件（不提交到版本控制）

## 主要配置项

### 前端配置

- `PORT` - 前端服务器端口，默认为 3010
- `VITE_API_BASE_URL` - 前端API请求的基础URL，默认为 http://localhost:6130
- `VITE_API_TIMEOUT` - API请求超时时间（毫秒），默认为 30000
- `VITE_ALLOWED_HOSTS` - 允许的主机列表（逗号分隔）

#### 文件处理配置

- `VITE_MAX_FILE_SIZE` - 最大文件大小（字节），默认为 10485760 (10MB)
- `VITE_ALLOWED_IMAGE_FORMATS` - 允许的图片格式，默认为 jpg,jpeg,png,gif,webp,bmp
- `VITE_THUMBNAIL_SIZE` - 缩略图尺寸，默认为 150
- `VITE_IMAGE_LAZY_LOADING` - 是否启用图片懒加载，默认为 true
- `VITE_THUMBNAIL_CACHE_TTL` - 缩略图缓存时间（秒），默认为 3600
- `VITE_IMAGE_CACHE_LIMIT` - 图片缓存数量限制，默认为 100

#### 性能配置

- `VITE_ENABLE_VIRTUAL_SCROLL` - 是否启用虚拟滚动，默认为 false
- `VITE_PAGE_SIZE` - 默认分页大小，默认为 20
- `VITE_MAX_CONCURRENT_REQUESTS` - 最大并发请求数，默认为 5

### 高德地图配置

- `VITE_AMAP_KEY` - 高德地图 Web JS API Key（地块地图功能必需）
- `VITE_AMAP_SERVICE_KEY` - 高德地图 Web服务 API Key（搜索功能必需）

> 申请地址: https://console.amap.com/dev/key/app

### 后端API配置

- `API_HOST` - API服务器主机，默认为 0.0.0.0
- `API_PORT` - API服务器端口，默认为 6130
- `SECRET_KEY` - JWT密钥（生产环境请使用强随机密钥）
- `JWT_ALGORITHM` - JWT算法，默认为 HS256
- `JWT_EXPIRE_MINUTES` - JWT过期时间（分钟），默认为 30

### 数据库配置

系统采用多数据库架构（元数据库 + 用户模板库 + 用户独立数据库）：

- `DB_HOST` - 数据库主机，默认为 localhost
- `DB_PORT` - 数据库端口，默认为 5432
- `META_DB_NAME` - 元数据库名称（存储用户、数据库等元数据），默认为 `green_tracker_meta`
- `TEMPLATE_DB_NAME` - 用户数据库模板名称，默认为 `green_tracker_template`
- `USER_DB_PREFIX` - 用户数据库前缀，默认为 `green_tracker_user_`
- `DB_USER` - 数据库用户名
- `DB_PASSWORD` - 数据库密码
- `DB_SUPERUSER` - 超级用户（用于创建数据库），默认为 postgres
- `DB_SUPERPASSWORD` - 超级用户密码
- `DB_POOL_SIZE` - 数据库连接池大小，默认为 10
- `DB_MAX_OVERFLOW` - 数据库连接池最大溢出，默认为 20

### 对象存储配置

- `MINIO_ENDPOINT` - MinIO服务端点
- `MINIO_PORT` - MinIO服务端口
- `MINIO_ACCESS_KEY` - MinIO访问密钥
- `MINIO_SECRET_KEY` - MinIO秘密密钥
- `MINIO_BUCKET_NAME` - MinIO存储桶名称
- `MINIO_SECURE` - 是否使用HTTPS连接MinIO，默认为 false

### 日志配置

- `LOG_LEVEL` - 日志级别，可选值：DEBUG, INFO, WARNING, ERROR, CRITICAL
- `LOG_FILE_PATH` - 日志文件路径（可选，默认为控制台输出）

### CORS配置

- `CORS_ORIGINS` - 允许的源（逗号分隔）
- `CORS_METHODS` - 允许的HTTP方法（逗号分隔）
- `CORS_HEADERS` - 允许的HTTP头部（逗号分隔）

### 文件上传配置

- `MAX_UPLOAD_SIZE` - 最大文件上传大小（字节）
- `ALLOWED_FILE_TYPES` - 允许的文件类型（逗号分隔）

### UI/UX 相关配置

#### 动画和交互设置
项目的UI系统已经进行了全面优化，以下配置和行为由前端代码自动管理：

- **动画系统**: 使用`framer-motion`实现的流畅动画，支持减少动画模式 (`prefers-reduced-motion`)
- **主题系统**: 6种预定义主题（黑蓝、明亮、深色、薄荷绿、日落橙、天空蓝）
- **响应式设计**: 自动适配移动端（<768px）、平板端（768px-1024px）、桌面端（>1024px）
- **增强组件**: 加载动画、骨架屏、进度条、状态管理等组件已标准化
- **步骤式界面**: 数据上传页面采用步骤条导航设计

#### 前端性能优化
- **代码分割**: 页面按需加载，提升首次加载速度
- **图片优化**: 支持懒加载和WebP格式（如果浏览器支持）
- **缓存策略**: API响应和静态资源使用适当的缓存策略
- **动画优化**: 动画使用`will-change`和`translate3d`触发GPU加速
- **可访问性**: 遵循WCAG 2.1标准，支持键盘导航和屏幕阅读器

#### 浏览器兼容性
- **核心支持**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **降级策略**: 在不支持现代特性的浏览器中提供降级体验
- **功能检测**: 动态检测浏览器支持的功能并相应调整

### 算法容器配置

#### Docker 配置
算法部署功能使用 Docker 容器化运行：

- `DOCKER_REGISTRY` - Docker 镜像仓库地址，开发环境默认为 `localhost:5000`
- `ALGORITHM_PORT_START` - 容器端口范围起始，默认为 8000
- `ALGORITHM_PORT_END` - 容器端口范围结束，默认为 9000
- `DOCKER_BUILD_TIMEOUT` - 镜像构建超时时间（秒），默认为 600
- `CONTAINER_MEMORY_LIMIT` - 容器内存限制，默认为 4g

#### 端口配置
- **容器内部端口**: 固定 8001
- **容器外部端口**: 动态分配（避免端口冲突）
- **健康检查间隔**: 30秒
- **健康检查超时**: 60秒

### MQTT 设备通信配置

- `MQTT_BROKER_HOST` - MQTT Broker 主机地址，默认为 localhost
- `MQTT_BROKER_PORT` - MQTT Broker TCP 端口，默认为 1883
- `MQTT_WS_PORT` - MQTT WebSocket 端口（前端直连用），默认为 9001
- `MQTT_USERNAME` - MQTT Broker 管理员账号
- `MQTT_PASSWORD` - MQTT Broker 管理员密码
- `MQTT_LOG_LEVEL` - MQTT 日志级别 (DEBUG/INFO/WARNING/ERROR)，默认为 INFO
- `MQTT_PORT` - MQTT 服务端口（docker-compose 用），默认为 1883
- `SERVER_PORT` - 服务端口（docker-compose 用），默认为 8080

### 邮件服务配置 (SMTP)

用于发送邮箱验证码、密码重置等邮件：

- `SMTP_HOST` - SMTP 服务器地址（QQ邮箱: smtp.qq.com, Gmail: smtp.gmail.com）
- `SMTP_PORT` - SMTP 端口，默认为 465（SSL）
- `SMTP_USER` - SMTP 账号（QQ邮箱需使用授权码）
- `SMTP_PASSWORD` - SMTP 密码/授权码
- `SMTP_FROM_NAME` - 发件人显示名称，默认为 "Green Tracker"

### MinIO 前端配置

- `VITE_MINIO_ENDPOINT` - MinIO 服务端点
- `VITE_MINIO_PORT` - MinIO 服务端口，默认为 9100
- `VITE_MINIO_BUCKET` - MinIO 存储桶名称
- `VITE_MINIO_SECURE` - 是否使用 HTTPS，默认为 false
- `VITE_MINIO_PUBLIC_URL` - MinIO 公开访问 URL

## 使用说明

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 根据实际环境修改 `.env` 文件中的配置值

3. 确保 `.env` 文件已添加到 `.gitignore` 中（已默认配置）

## 开发环境注意事项

1. 开发环境中的默认凭据（`VITE_DEFAULT_USERNAME` 和 `VITE_DEFAULT_PASSWORD`）仅用于测试
2. 生产环境请使用强随机密钥替换 `SECRET_KEY`
3. 生产环境请根据实际网络安全需求配置 `CORS_ORIGINS`

## 生产环境部署

1. 使用环境变量管理工具（如 Docker 环境变量或 Kubernetes ConfigMap）
2. 确保敏感信息不会泄露
3. 配置适当的日志级别和日志文件路径
4. 配置 HTTPS 和安全相关的选项