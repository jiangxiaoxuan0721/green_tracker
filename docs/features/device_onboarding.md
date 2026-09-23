# 设备端接入说明

> 适用对象：田间传感器、无人机、边缘网关等**无浏览器**的采集/受控终端。
> 配套文档：[`api_key_permissions.md`](api_key_permissions.md)（权限体系）、
> [`../architecture/database_redesign_v2.md`](../architecture/database_redesign_v2.md)（数据隔离）。

设备侧只需要三样东西：**一个设备 ID、一把 API 密钥、若干 HTTP 接口**。
不需要理解权限含义——云端会在签到响应里把权限翻译成能力开关，设备按开关行事即可。

---

## 1. 接入前提

| 步骤 | 谁做 | 产物 |
|---|---|---|
| 1. 创建设备 | 控制台 → 设备管理 | `device_id`（后续所有请求都要带） |
| 2. 创建密钥 | 控制台 → 密钥管理 | `green-xxxxxxxxxxxx`（**只在创建时完整返回一次**） |
| 3. 勾选权限 | 创建密钥时勾选 | `data_upload` / `data_read` / `device_control` |
| 4. 密钥交给设备 | 人工/烧录 | 设备持有密钥密文 |

权限含义速查（唯一定义源：`backend/utils/permissions.py`）：

| 权限值 | 设备获得的能力 |
|---|---|
| `data_upload` | 上传采集数据（数值型 / 文件型） |
| `data_read` | 从云端读取、导出该账号名下已存储的数据 |
| `device_control` | 接收云端下发的控制指令并回执 |

> 密钥**不预先绑定设备**。设备用哪把密钥，由设备在签到时自己上报（见第 3 节），
> 云端据此建立「设备 → 密钥」软关联，再决定这台设备能否被远程控制。

---

## 2. 认证方式

所有受保护接口都接受两种凭据，优先级 **JWT > API 密钥**：

```http
Authorization: Bearer <jwt_token>      # Web 控制台（账号全权）
X-API-Key: green-xxxxxxxxxxxx          # 设备 / 第三方系统（逐项校验权限）
X-Device-Id: <device_id>               # 设备侧接口：声明自己的身份
```

- 两者都未提供 → `401`
- 密钥无效 / 已禁用 / 已过期 → `401`
- 密钥有效但权限不足 → `403`

`X-Device-Id` 与查询参数 `device_id` 等价，二者其一即可。

---

## 3. 签到与能力协商（必做第一步）

设备用自己持有的密钥上报一次，云端记录「这台设备现在用的是哪把密钥」，
并把权限翻译成能力开关回给设备。

```http
POST /api/device-commands/heartbeat
X-API-Key: green-xxxxxxxxxxxx
X-Device-Id: 3f1c0b8e-0d3a-4a2b-9c1f-7d2e5a4b6c88
```

响应（`data` 部分）：

```json
{
  "device_id": "3f1c0b8e-0d3a-4a2b-9c1f-7d2e5a4b6c88",
  "registered": true,
  "capabilities": {
    "upload_data": true,
    "read_data": false,
    "pull_tasks": true,
    "receive_commands": true
  },
  "command_channel": "mqtt",
  "poll_interval_seconds": null,
  "server_time": "2026-09-23T08:00:00Z"
}
```

| 字段 | 含义 |
|---|---|
| `registered` | 关联是否写入成功。**为 `false` 时远程控制不可用**，响应 `message` 会给出原因 |
| `capabilities.upload_data` | 是否可上传数据（`data_upload`） |
| `capabilities.read_data` | 是否可读取云端数据（`data_read`） |
| `capabilities.pull_tasks` | 是否可拉取采集任务（设备作业通道默认能力，不受权限约束） |
| `capabilities.receive_commands` | 是否会收到控制指令（`device_control`） |
| `command_channel` | `mqtt`（在线实时）/ `http`（离线轮询）；不可受控时为 `null` |
| `poll_interval_seconds` | `http` 通道的建议轮询间隔，默认 5 秒 |
| `server_time` | 云端当前 UTC 时间，供设备校时 |

**关键结论**：`receive_commands` 为 `false` 时设备无需轮询指令；
只有当它为 `true` 且 `command_channel == "http"` 时才需要走第 5 节的轮询通道。

> 该接口**不要求** `device_control` 权限——否则从未授权过的设备永远无法完成上报。

---

## 4. 指令清单

```http
GET /api/device-commands/catalog
```

返回云端支持的指令（定义唯一源：`backend/mqtt/command_defs.py`）：

| 指令 ID | 名称 | 参数 | 需二次确认 |
|---|---|---|---|
| `ping` | 心跳检测 | — | 否 |
| `get_info` | 获取设备信息 | — | 否 |
| `get_metrics` | 运行指标（CPU / 内存 / 温度） | — | 否 |
| `reboot` | 重启设备 | `delay`（秒） | 是 |
| `set_config` | 写配置项 | `key`、`value` | 否 |
| `revoke_control` | 撤销远程控制授权（云端内部下发） | `reason` | 否 |

未知指令仍可下发，由设备端自行判断是否支持；指令名入库字段长度为 50，超长会被拒绝。

---

## 5. 接收指令（两条通道）

### 5.1 MQTT 实时通道（`command_channel == "mqtt"`）

设备保持 MQTT 长连接即可，云端直接推送，无需轮询。

### 5.2 HTTP 轮询通道（`command_channel == "http"`）

```http
GET /api/device-commands/pending?limit=20
X-API-Key: green-xxxxxxxxxxxx
X-Device-Id: <device_id>
```

- 返回 `pending` / `sent` 状态且未过期的指令
- `pending` 指令被拉取后标记为 `delivered`，不会重复下发
- 该接口要求密钥持有 `device_control`

---

## 6. 回执

```http
POST /api/device-commands/{command_id}/result
Content-Type: application/json
X-API-Key: green-xxxxxxxxxxxx
X-Device-Id: 3f1c0b8e-0d3a-4a2b-9c1f-7d2e5a4b6c88

{
  "status": "acked",
  "result": { "uptime_seconds": 12830 },
  "error_message": null
}
```

- `status` 仅支持 `acked`（成功）/ `failed`（失败），其它值返回 `400`
- 指令不存在返回 `404`
- **设备侧必须带 `X-Device-Id`**，且要满足两点，否则返回 `403`：
  1. 与指令的目标设备一致——不能替别的设备回执；
  2. 该设备当前上报的密钥就是本次调用的密钥——换过密钥要先重新签到

指令状态机：

```
pending ──投递──> sent/delivered ──回执──> acked | failed
   └──────────── 超过 timeout_seconds ──────────> expired
   └──────────── 云端主动取消 ──────────────────> cancelled
```

`timeout_seconds` 默认 300 秒，取值范围 10 ~ 86400。已处于终态的指令不会被改写。

---

## 7. 上传数据

`capabilities.upload_data` 为 `true` 时可调用（需 `data_upload` 权限）：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/raw-data/upload-data` | 上传数值型数据（环境 / 土壤） |
| POST | `/api/raw-data/upload-file` | 上传文件型数据（图像 / 视频 → MinIO） |

---

## 8. 权限被撤销时

云端删除 / 禁用密钥或去掉 `device_control` 时，会向**已上报过该密钥的设备**下发
`revoke_control` 指令（MQTT 在线实时推送，离线则落为 `pending` 等轮询取走）。

设备收到后应：

1. 停止接受并执行新的控制指令
2. 重新走第 3 节签到，获取最新 `capabilities`

---

## 9. 排错

| 现象 | 原因 / 处理 |
|---|---|
| 控制台提示「设备尚未上报所使用的API密钥」 | 设备未调用 `heartbeat`，或用户库缺 `device_key_bindings` 表（启动期迁移会自动补建） |
| 下发指令返回 `403` | 该设备上报的密钥没有 `device_control`，或密钥已禁用 / 已过期 |
| `heartbeat` 返回 `registered: false` | 关联写入失败，检查用户库表结构；响应 `message` 会给出具体提示 |
| 轮询一直拿不到指令 | 密钥缺 `device_control`，或指令已过 `timeout_seconds` 被标记 `expired` |
| 回执返回 `400` | `status` 只能是 `acked` 或 `failed`；或设备侧未带 `X-Device-Id` |
| 回执返回 `403` | `X-Device-Id` 与指令目标设备不一致，或该设备当前上报的密钥不是本次调用的密钥 |
| 返回 `401` | 密钥无效 / 已禁用 / 已过期，换一把有效密钥 |

---

## 10. 涉及的用户库表

| 表 | 作用 |
|---|---|
| `device_commands` | 指令记录（状态、参数、回执、有效期、下发通道） |
| `device_key_bindings` | 设备 → 密钥软关联（由 `heartbeat` / 轮询 / 回执写入） |

两张表均由模板库创建，存量用户库由启动期 `DatabaseInitializer.migrate_user_databases()`
自动补建；如需在线修库可执行
`backend/database/migrations/20260923_add_device_key_bindings.py`。
