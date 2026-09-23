# API 密钥权限体系

> 适用范围：远程设备 / 第三方系统通过 `X-API-Key` 调用云端接口时的身份与权限控制。
> 唯一定义源：后端 `backend/utils/permissions.py`，前端与第三方应通过 `GET /api/api-keys/permissions` 获取，避免各端硬编码产生歧义。

## 1. 三种权限

| 权限值 | 名称 | 语义 | 典型载体 | 是否要求绑定设备 |
|---|---|---|---|---|
| `data_upload` | 数据上传 | 把自身采集的数据写入云端数据库与对象存储 | 田间传感器、无人机、边缘网关 | 否 |
| `data_read` | 数据读取 | 从云端数据库读取该账号名下已存储的数据（只读） | 边缘侧本地分析、第三方平台/大屏 | 否 |
| `device_control` | 设备控制 | 云端通过该密钥下发控制指令并回收结果 | 运维平台、自动化系统 | 否 |

> 三种权限都**不要求预先绑定设备**，即密钥不与设备绑定，具体授权方式见下节。

规则：

- **JWT（Web 控制台登录用户）** = 账号所有者，不做权限项校验，可调用全部接口；
- **API 密钥** 必须显式持有对应权限，缺少权限返回 `403`；
- 请求体中的 `device_ids` 是**历史遗留字段，不参与鉴权**，传与不传都不影响权限判定。

### 1.1 设备控制采用「设备上报制」

密钥不与设备绑定，一台设备能不能被控制，取决于**这台设备自己上报用的是哪把密钥**：

1. 设备用密钥调用 `POST /api/device-commands/heartbeat`，云端在用户库的
   `device_key_bindings` 表写下「设备 → 密钥」软关联；
2. 云端下发指令时读取该关联：关联到的密钥若缺 `device_control`、已禁用或已过期，
   返回 `403`，JWT 控制台调用同样受此约束；
3. 未上报过密钥的设备，`control_granted = false`，控制台显示「设备尚未上报所使用的API密钥」。

这样既不需要在创建密钥时预先枚举设备，也保证一把密钥只能控制**主动选用了它**的设备。
详见 [`device_onboarding.md`](device_onboarding.md)。

## 2. 认证方式（与数据上传接口完全一致）

所有受保护接口都接受两种凭据，优先级：JWT > API 密钥。

```http
Authorization: Bearer <jwt_token>      # Web 应用
X-API-Key: green-xxxxxxxxxxxx          # 设备 / 第三方系统
```

两者都未提供 → `401`；密钥无效/已禁用/已过期 → `401`；密钥有效但权限不足 → `403`。

## 3. 接口清单

### 3.1 数据上传（`data_upload`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/raw-data/upload-data` | 上传数值型数据（环境/土壤） |
| POST | `/api/raw-data/upload-file` | 上传文件型数据（图像/视频 → MinIO） |

### 3.2 数据读取（`data_read`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/raw-data/list` | 数据列表 |
| GET | `/api/raw-data/{raw_data_id}` | 数据详情 |
| GET | `/api/raw-data/{raw_data_id}/tags` | 数据标签 |
| GET | `/api/raw-data/{raw_data_id}/thumbnail` | 图像缩略图 |
| GET | `/api/raw-data/timeseries` | 时序数据 |
| GET | `/api/raw-data/statistics` | 聚合统计 |
| GET | `/api/raw-data/overview` | 概览统计 |
| GET | `/api/raw-data/export` | 导出（csv/json/zip） |
| GET | `/api/raw-data/session/{session_id}/data-types` | 会话可用数据类型 |

读取范围固定为「密钥所属用户」的数据，不再接受 `user_id` 查询参数越权指定。

### 3.3 设备控制（`device_control`）

| 方法 | 路径 | 调用方 | 说明 |
|---|---|---|---|
| GET | `/api/device-commands/catalog` | 云端/设备 | 支持的指令清单 |
| POST | `/api/device-commands/heartbeat` | **设备** | 上报所用密钥（签到·能力协商），不要求 `device_control` |
| GET | `/api/device-commands/devices/{device_id}/grant` | 云端 | 该设备的远程控制授权状态 |
| POST | `/api/device-commands` | 云端 | 下发指令 |
| GET | `/api/device-commands` | 云端 | 指令列表（可按 device_id/status 过滤） |
| GET | `/api/device-commands/{command_id}` | 云端 | 指令详情 |
| POST | `/api/device-commands/{command_id}/cancel` | 云端 | 取消未完成的指令 |
| GET | `/api/device-commands/pending` | **设备** | 拉取待执行指令（HTTP 轮询，需 `X-Device-Id`） |
| POST | `/api/device-commands/{command_id}/result` | **设备** | 上报执行结果（`acked` / `failed`） |

指令状态机：

```
pending ──投递(MQTT)──> sent ──回执──> acked / failed
   │                      │
   └──设备轮询(HTTP)──> delivered ──┘
任意未完成状态 ──> cancelled（云端取消）/ expired（超过 timeout_seconds）
```

## 4. 调用示例

创建一把「可上传 + 可被远程控制」的密钥（JWT 登录态）：

```bash
curl -X POST http://localhost:8000/api/api-keys/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
        "key_name": "1号温室网关",
        "permissions": ["data_upload", "device_control"]
      }'
```

> 不需要在创建时指定设备：设备用这把密钥调用 `heartbeat` 后即可被控制。

远程设备上传数据：

```bash
curl -X POST http://localhost:8000/api/raw-data/upload-data \
  -H "X-API-Key: green-xxxxxxxxxxxx" -H "Content-Type: application/json" \
  -d '{"session_id":"...","data_type":"environmental","data_subtype":"temperature","data_value":"26.5"}'
```

云端下发重启指令：

```bash
curl -X POST http://localhost:8000/api/device-commands \
  -H "X-API-Key: green-xxxxxxxxxxxx" -H "Content-Type: application/json" \
  -d '{"device_id":"3f1c0b8e-...","command":"reboot","params":{"delay":5},"timeout_seconds":300}'
```

设备拉取并回执：

```bash
curl http://localhost:8000/api/device-commands/pending \
  -H "X-API-Key: green-xxxxxxxxxxxx" -H "X-Device-Id: 3f1c0b8e-..."

curl -X POST http://localhost:8000/api/device-commands/cmd_1737.../result \
  -H "X-API-Key: green-xxxxxxxxxxxx" -H "X-Device-Id: 3f1c0b8e-..." -H "Content-Type: application/json" \
  -d '{"status":"acked","result":{"uptime_seconds":12830}}'
```

查询权限字典（无需鉴权）：`GET /api/api-keys/permissions`。

## 5. 数据库变更

元数据库 `green_tracker_meta`：

- `api_keys.device_ids`（`TEXT`，JSON 数组字符串，默认 `[]`）——历史字段，**不参与鉴权**。

用户库 `green_tracker_user_*`：

- 新表 `device_commands`（设备指令），字段含 `command_id / device_id / command / params / status / transport / source / api_key_id / result / error_message / created_at / sent_at / delivered_at / executed_at / expires_at`；
- 新表 `device_key_bindings`（设备 → 密钥软关联），由 `heartbeat` / 轮询 / 回执写入，
  是 `device_control` 授权判定的唯一依据。

迁移方式（无 Alembic，沿用项目既有启动期迁移）：

1. 元数据库：`database/database_initializer.py` → `init_meta_database()` 检测 `api_keys` 缺列时 `ALTER TABLE ... ADD COLUMN device_ids TEXT DEFAULT '[]'`；
2. 模板库：建表清单含 `device_commands` 与 `device_key_bindings`，新用户库自动带上；
3. 存量用户库：`migrate_user_databases()` 检测缺表时按模型建表（两张表都会补）；
4. 新建用户库：`create_user_database.py` 按 `table_models` 映射校验并补建缺失表。

启动后端即自动完成迁移，无需手工执行 SQL。若需在线修库（不重启服务），可执行
`backend/database/migrations/20260923_add_device_key_bindings.py`。

## 6. 兼容性说明

- 历史 `permissions` 字段以 Python 字面量（`['data_upload']`）存储，新数据统一为 JSON（`["data_upload"]`）；解析层同时兼容两种格式，且已移除 `eval()`，改用 JSON / `ast.literal_eval`，避免代码注入风险。
- 既有密钥默认权限为 `["data_upload"]`，行为不变；新增权限需显式授予。
- 读取接口原先依赖 `user_id` 查询参数（部分接口还硬编码了默认用户 ID），现改为从认证主体推导，安全性提升；未携带任何凭据的调用将返回 `401`。
