# 🏛️ Green Tracker 架构设计

本文描述 Green Tracker 的运行时拓扑、分层结构、数据模型与 API 路由清单。
面向**首次接手代码的开发者**：想直接跑起来请先看 [`README.md`](README.md) 与 [`DEVELOPMENT.md`](DEVELOPMENT.md)。

---

## 1. 运行时拓扑

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

**同一份源码，两种前端模式**：后端只监听 `127.0.0.1`，Nginx 是唯一入口。
前端片段由 `scripts/render_nginx.sh` 在 `dev`（反代 Vite）与 `prod`（服务 `dist/`）之间切换，
两种模式共用相同的相对路径 API（`/api`），因此不存在跨域与 HTTPS 混合内容问题。

---

## 2. 分层结构

| 层 | 位置 | 职责 |
|----|------|------|
| 前端 SPA | `frontend/src` | React 18 + Vite 5。页面在 `pages/Dashboard/`，接口封装在 `services/`，状态用 zustand |
| API 路由 | `backend/api/routes` | FastAPI 路由，仅做参数校验与响应组装 |
| 数据模型 | `backend/api/schemas` | Pydantic 请求 / 响应模型 |
| 业务服务 | `backend/database/db_services` | 数据库读写与业务规则 |
| ORM 模型 | `backend/database/db_models` | SQLAlchemy 2.0 模型（`meta_model.py` 元库、`user_models.py` 用户库） |
| 存储 | `backend/storage` | MinIO 客户端、Dockerfile 生成、容器与镜像构建 |
| 设备通信 | `backend/mqtt` | MQTT 客户端、设备状态管理与路由 |

依赖方向：**路由 → 服务 → 模型**，路由层不直接写 SQL。

---

## 3. 数据架构

采用**元数据库 + 每用户独立数据库**的多租户隔离方案（详见 [`docs/architecture/database_redesign_v2.md`](docs/architecture/database_redesign_v2.md)）：

| 数据库 | 环境变量 | 内容 |
|--------|----------|------|
| 元数据库 | `META_DB_NAME` | 用户账号、数据库映射、全局元数据 |
| 模板数据库 | `TEMPLATE_DB_NAME` | 新建用户库的结构模板 |
| 用户数据库 | `USER_DB_PREFIX` + 用户标识 | 该用户的设备、地块、会话、原始数据 |

- 建库与初始化由 `backend/database/database_initializer.py` 完成，`make start` 会自动执行 `scripts/init_all.sh`。
- 地块几何数据依赖 PostGIS（`geoalchemy2`）。
- 连接获取走 `backend/database/user_db_manager.py`，按当前用户切换到对应库。

> ⚠️ 用户库为**动态创建**，新增表结构时需同步更新模板库，否则新用户与老用户结构会漂移。

---

## 4. API 路由清单

所有路由统一挂载在 `/api` 前缀下（`backend/main.py` 注册）。下表为**全量路由**。

### 认证 `/api/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/send-code` | 发送邮箱验证码 |
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录 |
| POST | `/login-by-code` | 验证码登录 |
| GET | `/verify` | 校验 Token |
| POST | `/forgot-password` | 发起找回密码 |
| POST | `/reset-password` | 重置密码 |

### 设备 `/api/devices`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建设备 |
| GET | `/` | 设备列表 |
| GET | `/{device_id}` | 设备详情 |
| PUT | `/{device_id}` | 更新设备（含启用 / 停用状态） |
| DELETE | `/{device_id}` | 删除设备 |

### 地块 `/api/fields`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建地块 |
| GET | `/` | 地块列表 |
| GET | `/light` | 轻量列表（下拉选择用） |
| GET | `/geometry` | 地理几何数据 |
| GET | `/{field_id}` | 地块详情 |
| PUT | `/{field_id}` | 更新地块 |
| DELETE | `/{field_id}` | 删除地块 |

### 采集会话 `/api/collection-sessions`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建会话 |
| GET | `/` | 会话列表 |
| GET | `/{session_id}` | 会话详情 |
| PUT | `/{session_id}` | 更新会话 |
| DELETE | `/{session_id}` | 删除会话 |
| GET | `/field/{field_id}` | 按地块查询会话 |
| GET | `/status/{status}` | 按状态查询会话 |
| POST | `/active_sessions` | 批量查询活跃会话 |

### 原始数据 `/api/raw-data`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建数据记录 |
| POST | `/upload-data` | 上传采集数据 |
| POST | `/upload-file` | 上传文件（流式，支持大文件） |
| GET | `/list` | 数据列表 |
| GET | `/{raw_data_id}` | 数据详情 |
| GET | `/overview` | 概览统计 |
| GET | `/statistics` | 统计分析 |
| GET | `/timeseries` | 时间序列 |
| GET | `/export` | 导出 |
| GET | `/session/{session_id}/data-types` | 会话下的数据类型 |
| PUT | `/{raw_data_id}/processing-status` | 更新处理状态 |
| PUT | `/{raw_data_id}/ai-status` | 更新 AI 状态 |
| GET/POST | `/{raw_data_id}/tags` | 标签读写 |
| GET | `/{raw_data_id}/thumbnail` | 缩略图 |

### API 密钥 `/api/api-keys`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建密钥 |
| GET | `/` | 密钥列表 |
| GET | `/{key_id}` | 密钥详情 |
| PUT | `/{key_id}` | 更新密钥 |
| DELETE | `/{key_id}` | 删除密钥 |
| POST | `/validate` | 校验密钥 |

### 算法 `/api/algorithms`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 算法列表 |
| GET | `/categories` | 算法分类 |
| POST | `/upload` | 上传算法包（触发镜像构建） |
| GET/PUT/DELETE | `/{algorithm_id}` | 算法详情 / 更新 / 删除 |
| POST | `/{algorithm_id}/build` | 触发构建 |
| GET | `/{algorithm_id}/build` | 构建状态 |
| GET | `/{algorithm_id}/build/stream` | 构建日志（NDJSON 流式） |
| POST | `/{algorithm_id}/predict` | 在线推理 |
| POST | `/{algorithm_id}/stop` / `/restart` | 停止 / 重启容器 |
| GET | `/{algorithm_id}/status` | 容器状态 |
| GET | `/{algorithm_id}/download` | 下载算法包 |
| GET/POST | `/{algorithm_id}/reviews` | 评价读写 |

### 系统日志 `/api/logs`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 分页查询（支持级别 / 来源 / 日期筛选） |
| GET | `/sources` | 日志来源列表 |
| GET | `/export` | 导出 CSV |
| DELETE | `/{log_id}` | 删除单条日志 |

### 用户反馈 `/api/feedback`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 提交反馈 |
| GET | `/` | 反馈列表 |

### 数据库管理 `/api/admin/database`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/list` | 用户库列表 |
| GET | `/info/{user_id}` | 用户库信息 |
| POST | `/create` | 创建用户库 |
| DELETE | `/{user_id}` | 删除用户库 |
| POST | `/recreate/{user_id}` | 重建用户库 |
| GET | `/stats` | 统计信息 |
| POST | `/sync-connections` | 同步连接 |
| GET/POST | `/schema-versions/{user_id}`、`/schema-version/{user_id}` | Schema 版本读写 |

### MQTT `/api/mqtt`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康状态 |
| GET | `/stats` | 连接统计 |
| GET | `/devices` | 在线设备列表 |
| GET | `/devices/{device_id}` | 设备详情 |
| POST | `/devices/{device_id}/commands` | 下发指令 |
| GET | `/devices/{device_id}/commands` | 指令列表 |
| GET | `/commands/{command_id}` | 指令详情 |
| POST | `/devices/{device_id}/provision` | 设备开通 |
| GET | `/devices/{device_id}/credentials` | 设备凭据 |

---

## 5. 存储与算法容器

- **MinIO**：对象存储，客户端为 `backend/storage/minio_client.py`，采用惰性代理，后端启动不因 MinIO 不可达而失败。
  详见 [`docs/architecture/minio_documentation.md`](docs/architecture/minio_documentation.md)。
- **算法容器**：`backend/storage/dockerfile_generator.py` 生成 Dockerfile，
  `container_manager.py` 管理容器生命周期，`image_build_service.py` 负责构建。
- **构建日志**：后端以 `asyncio` 任务 + NDJSON `StreamingResponse` 输出，前端订阅 `stream_url` 实时展示。
- **端口**：容器端口从 `ALGORITHM_PORT_START` ~ `ALGORITHM_PORT_END` 范围内分配，由后端自管端口池避免冲突。
- **大文件上传**：算法包上限由 `VITE_MAX_FILE_SIZE` 控制（默认 1 GB）；Nginx 侧 `client_max_body_size 0`、
  `proxy_request_buffering off`，后端流式落盘，避免整包驻留内存。

---

## 6. 认证与隔离

| 机制 | 实现 |
|------|------|
| 用户认证 | JWT（`SECRET_KEY` / `JWT_ALGORITHM` / `JWT_EXPIRE_MINUTES`），密码 bcrypt 哈希 |
| 设备 / 第三方接入 | API Key（`/api/api-keys`、`/api-keys/validate`） |
| 租户隔离 | 每用户独立数据库（见第 3 节） |
| 传输安全 | Nginx 终止 HTTPS，后端仅监听本地 |
| 跨域 | `CORS_ORIGINS` / `CORS_METHODS` / `CORS_HEADERS` |

---

## 7. 前端结构

| 目录 | 内容 |
|------|------|
| `frontend/src/pages/Dashboard/` | 11 个业务模块页面（见 [`README.md`](README.md) 特性表） |
| `frontend/src/components/ui/` | 统一组件库（`Toast`、`StateManager` 等） |
| `frontend/src/services/` | Axios 封装，统一 `/api` 前缀 |
| `frontend/src/styles/` | 主题与样式规范，见 `frontend/src/styles/README.md` |
| `frontend/src/hooks/`、`contexts/` | 复用逻辑与全局状态（zustand） |

约定细节见 [`frontend/README.md`](frontend/README.md)。

---

## 8. 相关文档

- [`docs/architecture/database_redesign_v2.md`](docs/architecture/database_redesign_v2.md) — 数据库 v2 设计（现行架构）
- [`docs/architecture/minio_documentation.md`](docs/architecture/minio_documentation.md) — MinIO 存储
- [`docs/features/algorithm_development_guide.md`](docs/features/algorithm_development_guide.md) — 算法接入规范
- [`docs/features/thumbnail_feature_guide.md`](docs/features/thumbnail_feature_guide.md) — 缩略图链路
- [`docs/setup/https-setup.md`](docs/setup/https-setup.md) — Nginx 与 HTTPS 部署
- [`docs/README.md`](docs/README.md) — 文档总索引
