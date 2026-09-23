# 原始数据 ↔ 对象存储一致性巡检

原始数据记录里存着 MinIO 的 `object_key`。当记录存在、对象却已被删除或从未落地时，
前端表现为「图片打不开」。本文说明如何体检这类悬空记录，以及如何安全地清理。

> 服务实现：`backend/database/db_services/raw_data_integrity_service.py`
> 路由实现：`backend/api/routes/raw_data.py`（`/api/raw-data/integrity/*`）
> 鉴权：`get_current_user`（JWT），数据范围严格限定在当前用户库

---

## 1. 背景：两代上传路径

| 时期 | 对象路径 |
|------|----------|
| 早期 | `user_{user_id}/raw/images/...` |
| 现行 | `user_{user_id}/data/session_{session_id}/...` |

路径统一后，旧路径的文件被清理或从未落地，库里留下的记录就成了悬空记录：
列表和统计里仍算这一条，打开时却取不到文件。

---

## 2. 两类问题

| 类别 | 判定 | 处置 |
|------|------|------|
| `orphan_rows` | 所属采集会话已不存在（`session_id` 关联不到会话） | 界面上看不到，文件也无引用，可直接清理 |
| `missing_objects` | 会话仍在，但 `object_key` 在桶里找不到 | 需要人工确认，默认不动 |

两类**可以重叠**：一条记录可能既是孤儿、对象也已缺失。清理前会按 ID 去重。

---

## 3. 接口

### 3.1 体检

```
GET /api/raw-data/integrity/object-keys
```

| 参数 | 默认 | 范围 | 说明 |
|------|------|------|------|
| `sample_limit` | 20 | 1~200 | 报告中返回的问题样例条数 |
| `scan_limit` | 5000 | 1~50000 | 最多扫描多少条记录 |

返回字段：

| 字段 | 说明 |
|------|------|
| `checked` | 已扫描的记录数 |
| `truncated` | `true` 表示被 `scan_limit` 截断，各项计数只是已扫描部分的统计，不是全量结论 |
| `orphan_rows` | 孤儿记录数 |
| `missing` | 对象缺失记录数 |
| `missing_with_orphan_session` | 会话已删 + 文件也没了，可直接清 |
| `missing_in_session` | 会话还在但文件没了，需人工确认 |
| `samples` | 问题样例（最多 `sample_limit` 条） |
| `bucket` / `objects_in_bucket` | 桶名与该用户前缀下的对象总数 |

### 3.2 清理

```
POST /api/raw-data/integrity/object-keys/cleanup
```

| 字段 | 默认 | 范围 | 说明 |
|------|------|------|------|
| `include_missing_in_session` | `false` | — | 是否一并清理「会话仍在、对象缺失」的记录 |
| `dry_run` | `true` | — | 只返回将要删除的内容，不实际删除 |
| `limit` | 200 | 1~5000 | 本次最多处理的记录数 |

> **扫描顺序**：取记录时按 `capture_time` 倒序，即两个 limit 都作用于**最新**的记录。
> 要覆盖更早的数据，需要调大 `scan_limit` / `limit`。

---

## 4. 清理语义

1. 默认只删**孤儿记录**，且默认 `dry_run=true`：先看后删，需要显式关闭才落库。
2. 被删记录里**仍存在于桶中的对象**会一并删除——会话都没了，这些文件已无人引用。
3. `include_missing_in_session=true` 才会动「会话仍在但文件缺失」的记录。
4. 删除顺序：先删库记录（含 `data_processing`、`raw_data_tags` 子表，子表缺表时跳过）
   并提交，再删对象；整批操作写入一条 `data.integrity_cleanup` 审计日志。

> **失败影响**：库记录删除成功但对象删除失败时，桶里会残留孤立文件。
> 不会造成数据不可见，重跑清理即可补齐。

---

## 5. 排错

| 现象 | 原因与处理 |
|------|-----------|
| 503 无法访问对象存储 | MinIO 不可用，体检与清理都会直接失败 |
| `truncated` 为 `true` | `scan_limit` 偏小，调大后重跑才有全量结论 |
| 清理后图片仍打不开 | 命中的是 `missing_in_session`，默认不清理；确认无误后显式传 `include_missing_in_session=true` |
| 体检很慢 | 每次都会全量列举该用户前缀下的对象，记录量大时调小 `scan_limit` 先抽样 |
