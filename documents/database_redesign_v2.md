# Green Tracker 数据库架构重构设计文档 v2.0

**文档版本**：v2.0  
**创建日期**：2026-01-26  
**设计目标**：每个用户独立数据库 + 统一数据隔离方案

---

## 📋 目录

1. [设计目标](#设计目标)
2. [架构总览](#架构总览)
3. [元数据库设计](#元数据库设计)
4. [用户数据库设计](#用户数据库设计)
5. [表结构详细说明](#表结构详细说明)
6. [索引设计](#索引设计)
7. [数据库连接管理](#数据库连接管理)
8. [数据迁移方案](#数据迁移方案)
9. [代码改造清单](#代码改造清单)
10. [性能优化建议](#性能优化建议)
11. [运维指南](#运维指南)

---

## 设计目标

### 当前架构的问题

1. **表数量爆炸**：每个用户动态创建 `user_{userid}_raw_data` 和 `user_{userid}_raw_data_tags` 表
2. **外键约束失效**：动态表无法使用 FK 约束，数据完整性难以保证
3. **冗余字段**：`device_display_name`、`field_display_name` 反范式设计
4. **Schema 同步困难**：修改表结构需要应用到所有动态表
5. **扩展性差**：单数据库承载所有用户数据，性能瓶颈明显
6. **管理复杂**：大量用户表难以维护和监控

### 新架构设计目标

1. ✅ **完全隔离**：每个用户独立数据库，数据彻底隔离
2. ✅ **统一Schema**：所有用户数据库表结构完全一致
3. ✅ **外键约束**：保留完整的关系约束，保证数据完整性
4. ✅ **水平扩展**：支持用户数据分片到不同数据库实例
5. ✅ **简化管理**：统一的 Schema 管理，版本控制
6. ✅ **性能优化**：每个数据库规模小，查询效率高
7. ✅ **灵活迁移**：可轻松将用户数据库迁移到不同服务器

---

## 架构总览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL 集群                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  green_tracker_meta (元数据库)                             │  │
│  │  - users (用户账户信息)                                    │  │
│  │  - user_databases (用户数据库映射)                          │  │
│  │  - schema_versions (Schema版本管理)                        │  │
│  │  - feedback (系统反馈)                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  green_tracker_template (模板数据库)                       │  │
│  │  - fields (表结构模板)                                     │  │
│  │  - devices (表结构模板)                                    │  │
│  │  - collection_sessions (表结构模板)                         │  │
│  │  - raw_data (表结构模板)                                   │  │
│  │  - raw_data_tags (表结构模板)                              │  │
│  │  - crop_objects (表结构模板)                               │  │
│  │  - 所有索引和约束                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  green_tracker_user_{uuid1} (用户001数据库)               │  │
│  │  - fields                                                 │  │
│  │  - devices                                                │  │
│  │  - collection_sessions                                     │  │
│  │  - raw_data                                               │  │
│ │  - raw_data_tags                                          │  │
│  │  - crop_objects                                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  green_tracker_user_{uuid2} (用户002数据库)               │  │
│  │  - (相同表结构)                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ... (更多用户数据库)                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    MinIO 对象存储                              │
├─────────────────────────────────────────────────────────────────┤
│  - user_{uuid1}/ (用户001文件空间)                             │
│  - user_{uuid2}/ (用户002文件空间)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 数据库命名规范

| 数据库类型 | 命名格式 | 说明 | 示例 |
|-----------|---------|------|------|
| 元数据库 | `green_tracker_meta` | 存储全局配置和用户账户 | `green_tracker_meta` |
| 模板数据库 | `green_tracker_template` | Schema 模板，用于创建用户数据库 | `green_tracker_template` |
| 用户数据库 | `green_tracker_user_{uuid}` | 每个用户独立数据库 | `green_tracker_user_a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

### 表命名规范

| 表类型 | 命名格式 | 说明 |
|-------|---------|------|
| 元数据表 | `{table_name}` | 小写 + 下划线 |
| 用户表 | `{table_name}` | 所有用户数据库表名统一 |
| 索引 | `idx_{table}_{column}` | 统一前缀 |
| 约束 | `uniq_{table}_{column}` | 唯一约束 |

---

## 元数据库设计

### 1. 数据库清单

```
green_tracker_meta
├── users                          # 用户账户信息
├── user_databases                 # 用户数据库映射关系
├── schema_versions                # Schema版本管理
└── feedback                      # 系统反馈
```

---

### 2. users 表（用户账户信息）

**用途**：存储用户账户和认证信息，不存储业务数据

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| userid | UUID | PRIMARY KEY | 用户ID（主键） |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NULLABLE | 邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希（bcrypt） |
| status | VARCHAR(20) | DEFAULT 'active' | 用户状态：active/suspended/deleted |
| subscription_plan | VARCHAR(20) | DEFAULT 'basic' | 订阅计划：basic/pro/enterprise |
| storage_quota_gb | INTEGER | DEFAULT 10 | 存储配额（GB） |
| storage_used_gb | FLOAT | DEFAULT 0.0 | 已用存储（GB） |
| max_databases | INTEGER | DEFAULT 1 | 最大数据库数 |
| settings | JSONB | DEFAULT '{}' | 用户偏好设置 |
| last_login_at | TIMESTAMPTZ | NULLABLE | 最后登录时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE users (
    userid                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username              VARCHAR(50) NOT NULL,
    email                 VARCHAR(100),
    password_hash         VARCHAR(255) NOT NULL,
    status                VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    subscription_plan     VARCHAR(20) DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'pro', 'enterprise')),
    storage_quota_gb      INTEGER DEFAULT 10,
    storage_used_gb       FLOAT DEFAULT 0.0,
    max_databases        INTEGER DEFAULT 1,
    settings             JSONB DEFAULT '{}',
    last_login_at        TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_subscription ON users(subscription_plan);
```

---

### 3. user_databases 表（用户数据库映射）

**用途**：记录每个用户对应的数据库信息，支持多数据库方案

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 记录ID |
| user_id | UUID | NOT NULL, FK(users.userid) | 用户ID |
| database_name | VARCHAR(100) | UNIQUE, NOT NULL | 数据库名称 |
| database_host | VARCHAR(100) | DEFAULT 'localhost' | 数据库主机 |
| database_port | INTEGER | DEFAULT 5432 | 数据库端口 |
| is_active | BOOLEAN | DEFAULT TRUE | 是否激活 |
| storage_used_mb | FLOAT | DEFAULT 0.0 | 已用存储（MB） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE user_databases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    database_name       VARCHAR(100) NOT NULL UNIQUE,
    database_host       VARCHAR(100) DEFAULT 'localhost',
    database_port       INTEGER DEFAULT 5432,
    is_active           BOOLEAN DEFAULT TRUE,
    storage_used_mb     FLOAT DEFAULT 0.0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_databases_user_id ON user_databases(user_id);
CREATE UNIQUE INDEX idx_user_databases_name ON user_databases(database_name);
CREATE INDEX idx_user_databases_active ON user_databases(is_active);
```

---

### 4. schema_versions 表（Schema版本管理）

**用途**：跟踪数据库 Schema 版本，支持版本控制和迁移

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 版本ID |
| version | VARCHAR(20) | UNIQUE, NOT NULL | 版本号（如 v2.0.0） |
| schema_sql | TEXT | NOT NULL | Schema定义SQL |
| migration_sql | TEXT | NULLABLE | 迁移SQL |
| description | TEXT | NULLABLE | 版本说明 |
| applied_at | TIMESTAMPTZ | NULLABLE | 应用时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

#### SQL定义

```sql
CREATE TABLE schema_versions (
    id                  SERIAL PRIMARY KEY,
    version             VARCHAR(20) NOT NULL UNIQUE,
    schema_sql          TEXT NOT NULL,
    migration_sql       TEXT,
    description         TEXT,
    applied_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_schema_versions_version ON schema_versions(version);
CREATE INDEX idx_schema_versions_applied ON schema_versions(applied_at);
```

---

### 5. feedback 表（系统反馈）

**用途**：存储用户反馈信息

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 反馈ID |
| user_id | UUID | FK(users.userid) | 用户ID |
| name | VARCHAR(100) | NULLABLE | 用户名 |
| email | VARCHAR(100) | NULLABLE | 邮箱 |
| subject | VARCHAR(200) | NOT NULL | 反馈主题 |
| content | TEXT | NOT NULL | 反馈内容 |
| status | VARCHAR(20) | DEFAULT 'pending' | pending/reviewed/resolved |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

#### SQL定义

```sql
CREATE TABLE feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(userid) ON DELETE SET NULL,
    name                VARCHAR(100),
    email               VARCHAR(100),
    subject             VARCHAR(200) NOT NULL,
    content             TEXT NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
```

---

## 用户数据库设计

### 1. 数据库清单

```
green_tracker_user_{uuid}
├── fields                        # 地块表
├── devices                       # 设备表
├── collection_sessions            # 采集任务表
├── raw_data                     # 原始数据表
├── raw_data_tags                # 原始数据标签表
└── crop_objects                 # 作物对象表
```

**注意**：
- 所有用户数据库使用完全相同的表结构
- 表结构由模板数据库 `green_tracker_template` 定义
- 用户ID不需要在表中存储，因为数据库已经隔离

---

### 2. fields 表（地块管理）

**用途**：存储用户的地块信息

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 地块ID |
| name | TEXT | NOT NULL | 地块名称 |
| description | TEXT | NULLABLE | 地块说明 |
| location_geom | GEOMETRY(POLYGON, 4326) | NOT NULL | 农田边界 |
| area_m2 | FLOAT | NULLABLE | 农田面积（平方米） |
| crop_type | TEXT | NULLABLE | 当前作物类型 |
| soil_type | TEXT | NULLABLE | 土壤类型 |
| irrigation_type | TEXT | NULLABLE | 灌溉方式 |
| is_active | BOOLEAN | DEFAULT TRUE | 是否活跃 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE fields (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    description         TEXT,
    location_geom       GEOMETRY(POLYGON, 4326) NOT NULL,
    area_m2             FLOAT,
    crop_type           TEXT,
    soil_type           TEXT,
    irrigation_type     TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fields_name ON fields(name);
CREATE INDEX idx_fields_crop_type ON fields(crop_type);
CREATE INDEX idx_fields_soil_type ON fields(soil_type);
CREATE INDEX idx_fields_active ON fields(is_active);
CREATE INDEX idx_fields_created ON fields(created_at DESC);
CREATE INDEX idx_fields_location_geom ON fields USING GIST (location_geom);
```

---

### 3. devices 表（设备管理）

**用途**：存储用户的设备信息

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 设备ID |
| name | TEXT | NOT NULL | 设备名称 |
| device_type | VARCHAR(50) | NOT NULL | satellite/uav/ugv/robot/sensor |
| platform_level | VARCHAR(50) | NOT NULL | 天/空/地/具身 |
| model | VARCHAR(100) | NULLABLE | 设备型号 |
| manufacturer | VARCHAR(100) | NULLABLE | 厂商 |
| sensors | JSONB | NULLABLE | 传感器配置 |
| actuators | JSONB | NULLABLE | 执行机构配置 |
| description | TEXT | NULLABLE | 设备说明 |
| is_active | BOOLEAN | DEFAULT TRUE | 是否在用 |
| last_seen_at | TIMESTAMPTZ | NULLABLE | 最后在线时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    device_type         VARCHAR(50) NOT NULL,
    platform_level      VARCHAR(50) NOT NULL,
    model               VARCHAR(100),
    manufacturer        VARCHAR(100),
    sensors             JSONB,
    actuators          JSONB,
    description         TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_name ON devices(name);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_platform ON devices(platform_level);
CREATE INDEX idx_devices_active ON devices(is_active);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at DESC);
```

---

### 4. collection_sessions 表（采集任务）

**用途**：管理采集任务/观测会话

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 任务ID |
| field_id | UUID | NOT NULL, FK(fields.id) | 所属地块 |
| device_id | UUID | FK(devices.id) | 使用设备 |
| start_time | TIMESTAMPTZ | NOT NULL | 任务开始时间 |
| end_time | TIMESTAMPTZ | NULLABLE | 任务结束时间 |
| mission_type | TEXT | NOT NULL | 巡检/定点/路径/应急 |
| mission_name | TEXT | NULLABLE | 任务名称 |
| description | TEXT | NULLABLE | 任务说明 |
| weather_snapshot | JSONB | NULLABLE | 环境快照 |
| status | TEXT | DEFAULT 'planned' | planned/running/completed/failed |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE collection_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id            UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    device_id           UUID REFERENCES devices(id) ON DELETE SET NULL,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ,
    mission_type        TEXT NOT NULL,
    mission_name        TEXT,
    description         TEXT,
    weather_snapshot    JSONB,
    status              TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_field_id ON collection_sessions(field_id);
CREATE INDEX idx_sessions_device_id ON collection_sessions(device_id);
CREATE INDEX idx_sessions_time_range ON collection_sessions(start_time, end_time);
CREATE INDEX idx_sessions_mission_type ON collection_sessions(mission_type);
CREATE INDEX idx_sessions_status ON collection_sessions(status);
CREATE INDEX idx_sessions_created ON collection_sessions(created_at DESC);
CREATE INDEX idx_sessions_field_status ON collection_sessions(field_id, status);
CREATE INDEX idx_sessions_field_time ON collection_sessions(field_id, start_time DESC);
CREATE INDEX idx_sessions_type_status ON collection_sessions(mission_type, status);
```

---

### 5. raw_data 表（原始数据）

**用途**：索引原始感知数据，PostgreSQL ↔ MinIO 桥梁

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 数据ID |
| session_id | UUID | NOT NULL, FK(collection_sessions.id) | 所属任务 |
| device_id | UUID | FK(devices.id) | 设备ID |
| field_id | UUID | FK(fields.id) | 地块ID |
| data_type | TEXT | NOT NULL | image/video/environmental/soil/multi_spectral |
| data_subtype | TEXT | NULLABLE | temperature/humidity/ph/light/ndvi/rgb |
| data_unit | TEXT | NULLABLE | 数据单位（°C/%/ppm/lux） |
| data_value | TEXT | NOT NULL | 数据值 |
| data_format | TEXT | NULLABLE | 数据格式 |
| bucket_name | TEXT | NULLABLE | MinIO bucket |
| object_key | TEXT | NULLABLE | MinIO 对象路径 |
| capture_time | TIMESTAMPTZ | NOT NULL | 采集时间 |
| location_geom | GEOMETRY(POINT, 4326) | NULLABLE | 采集点位置 |
| altitude_m | FLOAT | NULLABLE | 采集高度（米） |
| heading | FLOAT | NULLABLE | 朝向（度） |
| sensor_meta | JSONB | NULLABLE | 传感器元数据 |
| file_meta | JSONB | NULLABLE | 文件元数据 |
| acquisition_meta | JSONB | NULLABLE | 采集参数 |
| quality_score | FLOAT | NULLABLE | 质量评分（0-1） |
| quality_flags | JSONB | NULLABLE | 质量标记 |
| checksum | TEXT | NULLABLE | 文件校验值 |
| is_valid | BOOLEAN | DEFAULT TRUE | 是否有效 |
| validation_notes | TEXT | NULLABLE | 验证备注 |
| processing_status | TEXT | DEFAULT 'pending' | pending/processing/completed/failed |
| processed_at | TIMESTAMPTZ | NULLABLE | 处理完成时间 |
| ai_status | TEXT | DEFAULT 'pending' | pending/analyzing/completed/failed |
| ai_analyzed_at | TIMESTAMPTZ | NULLABLE | AI分析完成时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE raw_data (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES collection_sessions(id) ON DELETE CASCADE,
    device_id           UUID REFERENCES devices(id) ON DELETE SET NULL,
    field_id            UUID REFERENCES fields(id) ON DELETE SET NULL,
    
    -- 数据类型与值
    data_type           TEXT NOT NULL,
    data_subtype        TEXT,
    data_unit           TEXT,
    data_value          TEXT NOT NULL,
    data_format         TEXT,
    
    -- 对象存储索引
    bucket_name         TEXT,
    object_key          TEXT,
    
    -- 采集时空信息
    capture_time        TIMESTAMPTZ NOT NULL,
    location_geom       GEOMETRY(POINT, 4326),
    altitude_m          FLOAT,
    heading            FLOAT,
    
    -- 元数据
    sensor_meta        JSONB,
    file_meta          JSONB,
    acquisition_meta   JSONB,
    
    -- 质量信息
    quality_score      FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),
    quality_flags      JSONB,
    checksum           TEXT,
    is_valid           BOOLEAN DEFAULT TRUE,
    validation_notes   TEXT,
    
    -- 处理状态
    processing_status   TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processed_at       TIMESTAMPTZ,
    ai_status          TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'analyzing', 'completed', 'failed')),
    ai_analyzed_at     TIMESTAMPTZ,
    
    -- 时间戳
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_raw_data_session_id ON raw_data(session_id);
CREATE INDEX idx_raw_data_device_id ON raw_data(device_id);
CREATE INDEX idx_raw_data_field_id ON raw_data(field_id);
CREATE INDEX idx_raw_data_data_type ON raw_data(data_type);
CREATE INDEX idx_raw_data_data_subtype ON raw_data(data_subtype);
CREATE INDEX idx_raw_data_capture_time ON raw_data(capture_time DESC);
CREATE INDEX idx_raw_data_processing_status ON raw_data(processing_status);
CREATE INDEX idx_raw_data_ai_status ON raw_data(ai_status);
CREATE INDEX idx_raw_data_location_geom ON raw_data USING GIST (location_geom);
CREATE UNIQUE INDEX uniq_raw_data_object 
ON raw_data (session_id, bucket_name, object_key) 
WHERE data_type IN ('image', 'video');
CREATE INDEX idx_raw_data_session_type ON raw_data(session_id, data_type);
CREATE INDEX idx_raw_data_device_field_time ON raw_data(device_id, field_id, capture_time DESC);
CREATE INDEX idx_raw_data_type_time ON raw_data(data_type, capture_time DESC);
```

---

### 6. raw_data_tags 表（原始数据标签）

**用途**：存储原始数据的标签信息

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 标签ID |
| raw_data_id | UUID | NOT NULL, FK(raw_data.id) | 关联原始数据 |
| tag_category | TEXT | NOT NULL | 标签类别（病虫害/营养/生长阶段等） |
| tag_value | TEXT | NOT NULL | 标签值（蚜虫/缺氮/开花期等） |
| confidence | FLOAT | NULLABLE | 置信度（0-1） |
| source | TEXT | DEFAULT 'manual' | 标注来源（manual/ai/reviewed） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

#### SQL定义

```sql
CREATE TABLE raw_data_tags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_data_id         UUID NOT NULL REFERENCES raw_data(id) ON DELETE CASCADE,
    tag_category        TEXT NOT NULL,
    tag_value           TEXT NOT NULL,
    confidence          FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    source              TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'reviewed')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raw_data_tags_raw_data_id ON raw_data_tags(raw_data_id);
CREATE INDEX idx_raw_data_tags_category ON raw_data_tags(tag_category);
CREATE INDEX idx_raw_data_tags_value ON raw_data_tags(tag_value);
CREATE INDEX idx_raw_data_tags_category_value ON raw_data_tags(tag_category, tag_value);
```

---

### 7. crop_objects 表（作物对象）

**用途**：从原始感知数据中抽象出的具身作物实体

#### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 作物对象ID |
| field_id | UUID | NOT NULL, FK(fields.id) | 所属农田 |
| crop_type | TEXT | NOT NULL | 作物种类（wheat/corn/rice） |
| object_level | TEXT | NOT NULL | plant/row/patch |
| object_code | TEXT | NULLABLE | 业务可读编号 |
| geometry | GEOMETRY(GEOMETRY, 4326) | NULLABLE | 对象空间形态 |
| growth_stage | TEXT | NULLABLE | 出苗/拔节/抽穗/成熟 |
| health_status | TEXT | NULLABLE | healthy/stress/disease/unknown |
| source_raw_data_id | UUID | FK(raw_data.id) | 首次识别来源 |
| first_seen_at | TIMESTAMPTZ | NOT NULL | 首次观测时间 |
| last_seen_at | TIMESTAMPTZ | NOT NULL | 最近观测时间 |
| attributes | JSONB | NULLABLE | 高度/叶面积指数/颜色指数 |
| is_active | BOOLEAN | DEFAULT TRUE | 是否仍存在 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | ON UPDATE NOW() | 更新时间 |

#### SQL定义

```sql
CREATE TABLE crop_objects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id            UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    crop_type           TEXT NOT NULL,
    object_level        TEXT NOT NULL,
    object_code         TEXT,
    geometry            GEOMETRY(GEOMETRY, 4326),
    growth_stage        TEXT,
    health_status       TEXT,
    source_raw_data_id  UUID REFERENCES raw_data(id) ON DELETE SET NULL,
    first_seen_at       TIMESTAMPTZ NOT NULL,
    last_seen_at        TIMESTAMPTZ NOT NULL,
    attributes         JSONB,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX uniq_crop_object_code 
ON crop_objects (field_id, object_code) 
WHERE object_code IS NOT NULL;

CREATE INDEX idx_crop_objects_field_id ON crop_objects(field_id);
CREATE INDEX idx_crop_objects_crop_type ON crop_objects(crop_type);
CREATE INDEX idx_crop_objects_growth_stage ON crop_objects(growth_stage);
CREATE INDEX idx_crop_objects_health_status ON crop_objects(health_status);
CREATE INDEX idx_crop_objects_first_seen ON crop_objects(first_seen_at DESC);
CREATE INDEX idx_crop_objects_last_seen ON crop_objects(last_seen_at DESC);
CREATE INDEX idx_crop_objects_active ON crop_objects(is_active);
CREATE INDEX idx_crop_objects_geometry ON crop_objects USING GIST (geometry);
```

---

## 索引设计

### 索引设计原则

1. **主键索引**：所有表自动创建
2. **外键索引**：所有外键字段自动创建索引
3. **查询索引**：根据高频查询模式创建
4. **复合索引**：针对多字段联合查询优化
5. **空间索引**：几何字段使用 GIST 索引
6. **唯一约束**：业务唯一性要求

### 索引分类汇总

| 表名 | 索引数量 | 索引类型 |
|------|---------|---------|
| users | 4 | 单字段索引 |
| user_databases | 3 | 单字段索引 |
| schema_versions | 2 | 单字段索引 |
| feedback | 2 | 单字段索引 |
| fields | 6 | 单字段 + 空间索引 |
| devices | 5 | 单字段索引 |
| collection_sessions | 8 | 单字段 + 复合索引 |
| raw_data | 13 | 单字段 + 复合 + 唯一 + 空间 |
| raw_data_tags | 4 | 单字段 + 复合索引 |
| crop_objects | 8 | 单字段 + 复合 + 唯一 + 空间 |

---

## 数据库连接管理

### 连接管理器设计

```python
# backend/database/user_db_manager.py

import threading
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class UserDatabaseManager:
    """管理每个用户的独立数据库连接"""
    
    def __init__(self):
        self._engines: Dict[str, Any] = {}  # 存储每个用户的 engine
        self._session_factories: Dict[str, Any] = {}
        self._lock = threading.Lock()
        self._base_config = {
            'pool_size': 5,
            'max_overflow': 10,
            'pool_pre_ping': True,
            'pool_recycle': 3600,  # 1小时回收连接
        }
    
    def get_engine(self, user_id: str):
        """获取用户的数据库引擎"""
        if user_id not in self._engines:
            with self._lock:
                if user_id not in self._engines:
                    db_name = f"green_tracker_user_{user_id}"
                    db_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{db_name}"
                    self._engines[user_id] = create_engine(db_url, **self._base_config)
                    logger.info(f"Created database engine for user {user_id}")
        return self._engines[user_id]
    
    def get_session_factory(self, user_id: str):
        """获取用户的会话工厂"""
        if user_id not in self._session_factories:
            with self._lock:
                if user_id not in self._session_factories:
                    engine = self.get_engine(user_id)
                    self._session_factories[user_id] = scoped_session(
                        sessionmaker(autocommit=False, autoflush=False, bind=engine)
                    )
        return self._session_factories[user_id]
    
    def get_db(self, user_id: str):
        """获取用户的数据库会话（依赖注入）"""
        return self.get_session_factory(user_id)()
    
    def remove_user_db(self, user_id: str):
        """移除用户数据库连接（用户删除时调用）"""
        with self._lock:
            if user_id in self._session_factories:
                self._session_factories[user_id].remove()
                del self._session_factories[user_id]
            if user_id in self._engines:
                self._engines[user_id].dispose()
                del self._engines[user_id]
            logger.info(f"Removed database connections for user {user_id}")

# 全局单例
db_manager = UserDatabaseManager()
```

---

## 数据迁移方案

### 迁移策略

1. **阶段一**：创建元数据库和模板数据库
2. **阶段二**：逐个用户迁移到独立数据库
3. **阶段三**：验证数据完整性
4. **阶段四**：切换到新架构
5. **阶段五**：清理旧数据

### 迁移脚本示例

```python
# backend/scripts/migrate_to_v2.py

import psycopg2
from datetime import datetime

def migrate_user(user_id: str, old_db_conn, new_db_conn):
    """
    迁移单个用户的数据
    
    Args:
        user_id: 用户ID
        old_db_conn: 旧数据库连接
        new_db_conn: 新数据库连接
    """
    print(f"[{datetime.now()}] 开始迁移用户 {user_id}")
    
    # 1. 迁移 fields 表
    migrate_fields(user_id, old_db_conn, new_db_conn)
    
    # 2. 迁移 devices 表
    migrate_devices(user_id, old_db_conn, new_db_conn)
    
    # 3. 迁移 collection_sessions 表
    migrate_sessions(user_id, old_db_conn, new_db_conn)
    
    # 4. 迁移 raw_data 表
    migrate_raw_data(user_id, old_db_conn, new_db_conn)
    
    # 5. 迁移 raw_data_tags 表
    migrate_raw_data_tags(user_id, old_db_conn, new_db_conn)
    
    print(f"[{datetime.now()}] 用户 {user_id} 迁移完成")

def main():
    # 连接数据库
    old_conn = psycopg2.connect("...")
    new_meta_conn = psycopg2.connect("...")
    
    # 获取所有用户
    users = get_all_users(old_conn)
    
    # 逐个迁移
    for user in users:
        user_id = user['userid']
        
        # 创建用户数据库
        create_user_database(user_id)
        
        # 连接到新用户数据库
        new_user_conn = psycopg2.connect(f"...")
        
        # 迁移数据
        migrate_user(user_id, old_conn, new_user_conn)
        
        # 关闭连接
        new_user_conn.close()
    
    # 关闭所有连接
    old_conn.close()
    new_meta_conn.close()

if __name__ == "__main__":
    main()
```

---

## 代码改造清单

### 后端代码改造

| 模块 | 改造内容 | 优先级 |
|------|---------|-------|
| main_db.py | 添加元数据库连接配置 | 高 |
| user_db_manager.py | 创建新的连接管理器 | 高 |
| db_models/ | 移除 user_id 字段，统一表结构 | 高 |
| db_services/ | 修改所有 Service 使用新连接管理器 | 高 |
| api/routes/ | 修改依赖注入，使用新连接管理器 | 高 |
| auth.py | 修改认证逻辑，添加用户数据库创建 | 高 |
| tests/ | 更新所有测试用例 | 中 |

### 前端代码改造

| 模块 | 改造内容 | 优先级 |
|------|---------|-------|
| API 调用 | 无需修改（API 接口不变） | - |
| 数据展示 | 无需修改 | - |

**注意**：前端代码基本无需修改，因为 API 接口保持不变。

---

## 性能优化建议

### 1. 连接池配置

```python
# 推荐配置
pool_size = 5              # 每个用户5个连接
max_overflow = 10          # 最大额外10个连接
pool_recycle = 3600       # 1小时回收连接
pool_pre_ping = True       # 连接前检查有效性
```

### 2. 索引优化

- 定期分析索引使用情况
- 删除未使用的索引
- 监控慢查询日志

### 3. 查询优化

- 使用 EXPLAIN ANALYZE 分析查询计划
- 避免 N+1 查询问题
- 使用批量插入代替单条插入

### 4. 分区表

对于大型 `raw_data` 表，考虑按时间分区：

```sql
-- 按月分区示例
CREATE TABLE raw_data_2025_01 PARTITION OF raw_data
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## 运维指南

### 1. 数据库创建

```bash
# 创建元数据库
createdb green_tracker_meta

# 创建模板数据库
createdb green_tracker_template
psql -d green_tracker_template -f schema_v2.0.sql
```

### 2. 用户数据库创建

```sql
-- 从模板创建用户数据库
CREATE DATABASE green_tracker_user_{uuid} TEMPLATE green_tracker_template;
```

### 3. 备份策略

```bash
# 备份元数据库
pg_dump green_tracker_meta > meta_backup_$(date +%Y%m%d).sql

# 备份用户数据库（批量）
for db in $(psql -At -c "SELECT datname FROM pg_database WHERE datname LIKE 'green_tracker_user_%'"); do
    pg_dump $db > ${db}_backup_$(date +%Y%m%d).sql
done
```

### 4. 监控指标

- 每个数据库的连接数
- 每个数据库的存储使用量
- 查询响应时间
- 慢查询日志

---

## 总结

### 新架构优势

1. ✅ **完全隔离**：每个用户独立数据库
2. ✅ **统一管理**：Schema 版本控制和同步
3. ✅ **数据完整性**：保留外键约束
4. ✅ **水平扩展**：支持用户数据分片
5. ✅ **性能优化**：每个数据库规模小
6. ✅ **灵活迁移**：易于迁移到不同服务器

### 实施路径

1. **第1周**：创建元数据库和模板数据库
2. **第2周**：实现连接管理器
3. **第3周**：改造后端代码
4. **第4周**：数据迁移和测试
5. **第5周**：灰度发布
6. **第6周**：全量上线

---

**文档结束**
