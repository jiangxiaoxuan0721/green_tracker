# 环境配置说明

## 概述

本项目使用环境变量进行配置管理，所有配置都集中在根目录的 `.env` 文件中。`.env.example` 文件提供了配置模板，请勿将包含敏感信息的 `.env` 文件提交到版本控制系统。

## 配置文件

- `.env.example` - 配置模板文件
- `.env` - 实际环境配置文件（不提交到版本控制）

## 主要配置项

### 前端配置

- `PORT` - 前端服务器端口，默认为 3000
- `VITE_API_BASE_URL` - 前端API请求的基础URL，默认为 http://localhost:3001
- `VITE_DEFAULT_USERNAME` - 开发环境默认用户名（仅用于开发测试）
- `VITE_DEFAULT_PASSWORD` - 开发环境默认密码（仅用于开发测试）

### 后端API配置

- `API_HOST` - API服务器主机，默认为 0.0.0.0
- `API_PORT` - API服务器端口，默认为 3001
- `SECRET_KEY` - JWT密钥（生产环境请使用强随机密钥）
- `JWT_ALGORITHM` - JWT算法，默认为 HS256
- `JWT_EXPIRE_MINUTES` - JWT过期时间（分钟），默认为 30

### 数据库配置

- `DB_HOST` - 数据库主机，默认为 localhost
- `DB_PORT` - 数据库端口，默认为 5432
- `DB_NAME` - 数据库名称，默认为 green_tracker
- `DB_USER` - 数据库用户名
- `DB_PASSWORD` - 数据库密码
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