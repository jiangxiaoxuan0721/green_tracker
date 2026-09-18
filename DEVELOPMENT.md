# 🧑‍💻 Green Tracker 开发指南

面向**日常开发**：如何跑起来、环境变量怎么配、质量门禁怎么过。
架构设计见 [`ARCHITECTURE.md`](ARCHITECTURE.md)，贡献流程见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

---

## 1. 环境准备

| 依赖 | 要求 | 说明 |
|------|------|------|
| Python | ≥ 3.8（`backend/pyproject.toml`） | 后端运行时 |
| Node.js | 18+（Vite 5 的运行时要求，仓库未锁定 `engines`） | 前端运行时 |
| PostgreSQL | 需 PostGIS 扩展 | 元数据库与用户数据库 |
| Docker | 算法镜像构建必需 | `bash scripts/docker-install.sh` 可安装 |
| MinIO | S3 兼容对象存储 | `bash scripts/minio.sh start` |
| Nginx | HTTPS 反向代理 | `make nginx-install` |

一键安装系统依赖：`bash scripts/postgres-install.sh`、`bash scripts/docker-install.sh`。

---

## 2. 本地跑起来

在**仓库根目录**执行：

```bash
cp .env.example .env        # 生成配置后按需填写
make install                # 安装前后端依赖
make start                  # PostgreSQL（含元库初始化）+ MinIO + Nginx
make dev                    # 前后端热加载
```

只跑一端：

```bash
make dev-frontend           # 仅前端 Vite
make dev-backend            # 仅后端 uvicorn --reload
```

默认端口：

| 服务 | 端口 | 环境变量 |
|------|------|----------|
| 前端 Vite | 3010 | `PORT` |
| 后端 FastAPI | 6130 | `API_PORT` |
| PostgreSQL | 5432 | `DB_PORT` |
| MinIO | 9100 | `MINIO_PORT` |
| MQTT Broker | 1883 | `MQTT_BROKER_PORT` |
| MQTT WebSocket | 9001 | `MQTT_WS_PORT` |

前端 Vite 已内置 `/api` 代理，开发时无需直连后端端口。

---

## 3. ⚠️ 环境变量的两个坑

1. **只有仓库根目录的 `.env` 生效**。`frontend/vite.config.js` 设置了 `envDir: projectRoot`，
   Vite 不会读取 `frontend/.env`；改了也没用。
2. **`VITE_API_BASE_URL` 不要填 `/api`**。代码中请求路径**已自带** `/api` 前缀，
   填了会拼成 `/api/api/...` 导致 404。留空走同源相对路径即可。

改动前端默认值（如 `frontend/src/config/env.ts`）也会被根目录 `.env` 的值覆盖，
调上传大小之类的参数请改根目录 `.env`。

---

## 4. 环境变量速查

下表覆盖 `.env.example` 中的全部参数。示例值已**脱敏**，请替换为实际值。

### 应用基础

| 变量 | 示例 | 说明 |
|------|------|------|
| `NODE_ENV` | `development` | 应用环境：`development` / `production` |

### 站点域名与 HTTPS

| 变量 | 示例 | 说明 |
|------|------|------|
| `DOMAIN` | `your-domain.com` | 部署域名，`make setup-https` 用于申请证书 |
| `SSL_EMAIL` | `admin@your-domain.com` | Let's Encrypt 注册邮箱，接收续期提醒 |

### 前端服务器

| 变量 | 示例 | 说明 |
|------|------|------|
| `PORT` | `3010` | 前端端口，仅本地监听，由 Nginx 对外提供 HTTPS |
| `VITE_API_BASE_URL` | （留空） | API origin 前缀，**不含 `/api`**；留空走同源相对路径 |

### 前端（Vite）

| 变量 | 示例 | 说明 |
|------|------|------|
| `VITE_AMAP_KEY` | `your_amap_web_js_key` | 高德地图 Web JS Key |
| `VITE_AMAP_SERVICE_KEY` | `your_amap_service_key` | 高德地图服务端 Key |
| `VITE_MINIO_ENDPOINT` | `your-domain.com` | MinIO 端点 |
| `VITE_MINIO_PORT` | `9100` | MinIO 端口 |
| `VITE_MINIO_BUCKET` | `your-bucket-name` | MinIO 桶名 |
| `VITE_MINIO_SECURE` | `false` | 是否启用 HTTPS |
| `VITE_MINIO_PUBLIC_URL` | `/minio/your-bucket-name` | 推荐相对路径，由 Nginx 反代 |
| `VITE_API_TIMEOUT` | `30000` | 请求超时（毫秒） |
| `VITE_THUMBNAIL_SIZE` | `150` | 缩略图边长（像素） |
| `VITE_IMAGE_LAZY_LOADING` | `true` | 图片懒加载 |
| `VITE_MAX_FILE_SIZE` | `1073741824` | 算法包上限（字节，默认 1 GB） |
| `VITE_ALLOWED_IMAGE_FORMATS` | `jpg,jpeg,png,gif,webp,bmp` | 允许的图片格式 |
| `VITE_THUMBNAIL_CACHE_TTL` | `3600` | 缩略图缓存 TTL（秒） |
| `VITE_IMAGE_CACHE_LIMIT` | `100` | 图片缓存条数上限 |
| `VITE_ENABLE_VIRTUAL_SCROLL` | `false` | 虚拟滚动 |
| `VITE_PAGE_SIZE` | `20` | 列表分页大小 |
| `VITE_MAX_CONCURRENT_REQUESTS` | `5` | 最大并发请求数 |
| `VITE_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Vite 允许访问的主机（逗号分隔） |

### 后端 API

| 变量 | 示例 | 说明 |
|------|------|------|
| `API_HOST` | `127.0.0.1` | `0.0.0.0` 监听全部；`127.0.0.1` 仅本地（生产建议） |
| `API_PORT` | `6130` | 后端端口 |
| `BACKEND_USE_HTTPS` | `false` | 后端是否自启 HTTPS（Nginx 已终结时无需开启） |
| `BACKEND_SSL_CERTFILE` | （注释可选） | 后端证书路径 |
| `BACKEND_SSL_KEYFILE` | （注释可选） | 后端私钥路径 |

### 认证

| 变量 | 示例 | 说明 |
|------|------|------|
| `SECRET_KEY` | `your-secret-key-change-in-production` | JWT 签名密钥，生产请用 ≥32 位强随机值 |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_EXPIRE_MINUTES` | `30` | Token 有效期（分钟） |

### 数据库

| 变量 | 示例 | 说明 |
|------|------|------|
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PORT` | `5432` | 数据库端口 |
| `DB_USER` | `your_db_user` | 应用数据库用户 |
| `DB_PASSWORD` | `your_db_password` | 应用数据库密码 |
| `META_DB_NAME` | `green_tracker_meta` | 元数据库名（固定） |
| `TEMPLATE_DB_NAME` | `green_tracker_template` | 模板数据库名 |
| `USER_DB_PREFIX` | `green_tracker_user_` | 用户数据库名前缀 |
| `DB_SUPERUSER` | `postgres` | 建库用的超级用户 |
| `DB_SUPERPASSWORD` | `your_superuser_password` | 超级用户密码 |
| `DB_POOL_SIZE` | `10` | 连接池大小 |
| `DB_MAX_OVERFLOW` | `20` | 连接池最大溢出 |

### 对象存储（MinIO）

| 变量 | 示例 | 说明 |
|------|------|------|
| `MINIO_BUCKET_NAME` | `your-bucket-name` | 桶名 |
| `MINIO_ENDPOINT` | `your-domain.com` | 端点 |
| `MINIO_PORT` | `9100` | 端口 |
| `MINIO_ACCESS_KEY` | `your_minio_access_key` | Access Key |
| `MINIO_SECRET_KEY` | `your_minio_secret_key` | Secret Key |
| `MINIO_SECURE` | `false` | 是否启用 HTTPS（生产建议 `true`） |

### 日志

| 变量 | 示例 | 说明 |
|------|------|------|
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL` |
| `LOG_FILE_PATH` | `logs` | 日志目录，留空则输出到控制台 |

### CORS

| 变量 | 示例 | 说明 |
|------|------|------|
| `CORS_ORIGINS` | `http://localhost:3010,http://127.0.0.1:3010` | 允许的源（逗号分隔） |
| `CORS_METHODS` | `GET,POST,PUT,DELETE,OPTIONS` | 允许的方法 |
| `CORS_HEADERS` | `Content-Type,Authorization` | 允许的请求头 |

### 文件上传

| 变量 | 示例 | 说明 |
|------|------|------|
| `MAX_UPLOAD_SIZE` | `1073741824` | 上传上限（字节）。当前后端未消费，仅占位 |
| `ALLOWED_FILE_TYPES` | `jpg,jpeg,png,gif,pdf,doc,docx,txt,zip,xls,xlsx` | 允许的文件类型 |

### Docker（算法镜像构建）

| 变量 | 示例 | 说明 |
|------|------|------|
| `DOCKER_REGISTRY` | `localhost:5000` | 镜像仓库地址，生产建议私有仓库 |
| `ALGORITHM_PORT_START` | `8000` | 算法容器端口范围起 |
| `ALGORITHM_PORT_END` | `9000` | 算法容器端口范围止 |
| `DOCKER_BUILD_TIMEOUT` | `600` | 镜像构建超时（秒） |
| `CONTAINER_MEMORY_LIMIT` | `4g` | 容器内存限制 |
| `DOCKER_CLEANUP_DAYS` | `30`（注释可选） | 自动清理超过 N 天的旧镜像 |

### MQTT

| 变量 | 示例 | 说明 |
|------|------|------|
| `MQTT_BROKER_HOST` | `localhost` | Broker 主机 |
| `MQTT_BROKER_PORT` | `1883` | Broker 端口 |
| `MQTT_USERNAME` | `admin` | Broker 管理员账号 |
| `MQTT_PASSWORD` | `your_mqtt_password` | Broker 管理员密码 |
| `MQTT_WS_PORT` | `9001` | WebSocket 端口（前端直连 Monitor） |
| `MQTT_LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `MQTT_PORT` | `1883` | docker-compose 服务端口 |
| `SERVER_PORT` | `8080` | 辅助服务端口 |

### 邮件（SMTP）

| 变量 | 示例 | 说明 |
|------|------|------|
| `SMTP_HOST` | `smtp.qq.com` | SMTP 服务器 |
| `SMTP_PORT` | `465` | SMTP 端口 |
| `SMTP_USER` | `your_email@example.com` | SMTP 账号 |
| `SMTP_PASSWORD` | `your_smtp_auth_code` | SMTP 授权码（非登录密码） |
| `SMTP_FROM_NAME` | `Green Tracker` | 发件人显示名 |

完整说明见 [`docs/setup/env-config.md`](docs/setup/env-config.md)。

---

## 5. 质量门禁

```bash
# 前端
cd frontend
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run test          # vitest run
npm run build         # 生产构建

# 后端
cd backend
pytest                # backend/tests 下的用例

# 依赖声明 vs 运行环境一致性
make check-deps       # 需先 conda activate，或 GREEN_PY=/path/to/python

# 部署冒烟
bash scripts/smoke_test.sh
```

- 前端测试位于 `frontend/src/**/*.test.{ts,tsx}`，由 Vitest + Testing Library 运行（jsdom 环境）。
- 后端测试位于 `backend/tests/`，覆盖地块 LOD、算法构建流、容器管理与部署服务。
- 结构性改动请以 `typecheck` + `lint` + 冒烟三道门禁验证。

---

## 6. 常见操作

```bash
make mode             # 查看当前前端模式（dev / prod）
make serve-dev        # Nginx 反代 Vite（热加载）
make build            # 构建 frontend/dist
make deploy           # build + 切到生产静态模式
make setup-https      # 申请证书并配置 Nginx
make mqtt-start       # 启动 MQTT Broker
make mqtt-logs        # 查看 MQTT 日志
```

> 生产模式下改动源码不会生效，必须重新 `make build` 并切回生产模式。

`screen` 会话的日常操作见 [`docs/ops/screen_guide.md`](docs/ops/screen_guide.md)。

---

## 7. 排错

| 现象 | 排查方向 |
|------|----------|
| 登录报 404 | `VITE_API_BASE_URL` 是否误填为 `/api`，详见第 3 节 |
| 改了 `frontend/.env` 不生效 | Vite 只读仓库根目录 `.env`，详见第 3 节 |
| 上传大包失败 | 检查根目录 `.env` 的 `VITE_MAX_FILE_SIZE` 与 Nginx `client_max_body_size` |
| 后端启动报 MinIO 不可达 | `minio_client` 为惰性代理，启动不连接；若运行时报错请确认 `scripts/minio.sh start` |
| 端口冲突 | 检查 `PORT` / `API_PORT` / `MINIO_PORT` 与 `ALGORITHM_PORT_START`~`END` 范围 |
| 依赖疑似缺失 | `make check-deps` 扫描声明与运行环境的一致性 |
