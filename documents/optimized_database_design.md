# Green Tracker 数据库优化设计方案

## 概述

本文档提供了Green Tracker空-天-地一体化农情监测系统的数据库优化设计方案。方案基于PostgreSQL，结合PostGIS空间扩展，并与MinIO对象存储协同工作，实现对农情数据的高效存储、查询和分析。

## 设计原则

1. **空间优先**: 所有数据围绕地理位置（农田）展开，空间信息是核心
2. **时序组织**: 按时间组织采集会话，支持历史回溯和趋势分析
3. **对象抽象**: 从原始数据中抽象出可操作的智能对象（作物对象）
4. **扩展性**: 支持多源数据接入和未来功能扩展
5. **性能优化**: 通过索引、分区等优化手段保障查询性能

## 数据库架构

### 核心表关系图
```
field (农田表)
  ├── collection_session (采集会话表)
  │     ├── raw_data (原始数据表)
  │     └── processed_data (处理数据表)
  │
  ├── crop_object (作物对象表)
  │     ├── crop_observation (作物观测表)
  │     └── crop_intervention (农事干预表)
  │
  ├── analytics_result (分析结果表)
  └── alert (告警表)

device (设备表)
  ├── device_status (设备状态表)
  └── maintenance_log (维护日志表)

user (用户表)
  ├── feedback (反馈表)
  └── operation_log (操作日志表)
```

## 表结构优化设计

### 1. 农田基础表 (field) - 优化版

```sql
-- =========================================================
-- 【DDL-01】农田基础表优化版：field
-- 角色：空-天-地一体化农情监测系统的"空间原点"
-- =========================================================

-- 前置条件：启用 PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 表结构定义
CREATE TABLE field (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name              TEXT NOT NULL,           -- 地块名称
  description       TEXT,                    -- 备注说明
  code              TEXT UNIQUE,             -- 地块编码，业务可读
  
  -- 空间信息（核心字段）
  location_geom     GEOMETRY(POLYGON, 4326) NOT NULL,  -- 农田边界
  center_point      GEOMETRY(POINT, 4326),    -- 农田中心点（便于快速查询）
  area_m2           DOUBLE PRECISION,        -- 农田面积（平方米）
  perimeter_m       DOUBLE PRECISION,        -- 农田周长（米）
  
  -- 农业属性
  crop_type         TEXT,                    -- 当前作物类型
  crop_variety      TEXT,                    -- 作物品种
  planting_date     DATE,                    -- 种植日期
  expected_harvest  DATE,                    -- 预计收获日期
  soil_type         TEXT,                    -- 土壤类型
  irrigation_type   TEXT,                    -- 灌溉方式
  field_level       TEXT DEFAULT 'field',    -- 地块级别：field/zone/subzone
  
  -- 管理属性
  owner_id          UUID,                    -- 地块负责人
  organization_id   UUID,                    -- 所属组织
  tags              TEXT[],                  -- 标签数组，便于分类和搜索
  
  -- 状态字段
  is_active         BOOLEAN DEFAULT TRUE,    -- 是否有效
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 触发器：自动更新中心点、面积和周长
CREATE OR REPLACE FUNCTION update_field_geometry_attributes()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新中心点
  NEW.center_point := ST_Centroid(NEW.location_geom);
  
  -- 更新面积（平方米）
  NEW.area_m2 := ST_Area(NEW.location_geom::geography);
  
  -- 更新周长（米）
  NEW.perimeter_m := ST_Perimeter(NEW.location_geom::geography);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_field_geometry_attributes
BEFORE INSERT OR UPDATE ON field
FOR EACH ROW EXECUTE FUNCTION update_field_geometry_attributes();

-- 索引设计
CREATE INDEX idx_field_location_geom ON field USING GIST (location_geom);
CREATE INDEX idx_field_center_point ON field USING GIST (center_point);
CREATE INDEX idx_field_crop_type ON field (crop_type);
CREATE INDEX idx_field_tags ON field USING GIN (tags);
CREATE INDEX idx_field_is_active ON field (is_active);
CREATE UNIQUE INDEX uniq_field_code ON field (code) WHERE code IS NOT NULL;
```

### 2. 设备表 (device) - 优化版

```sql
-- =========================================================
-- 【DDL-02】设备表优化版：device
-- 角色：空-天-地一体化农情监测系统的"感知与行动主体"
-- =========================================================

-- 设备表
CREATE TABLE device (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name              TEXT NOT NULL,           -- 设备名称
  code              TEXT UNIQUE,             -- 设备编码，业务可读
  
  -- 平台抽象
  device_type       TEXT NOT NULL,           -- satellite / uav / ugv / robot / sensor
  platform_level    TEXT NOT NULL,           -- 天 / 空 / 地 / 具身
  model             TEXT,                    -- 设备型号
  manufacturer      TEXT,                    -- 厂商
  serial_number     TEXT,                    -- 序列号
  
  -- 能力描述
  sensors           JSONB,                   -- 传感器配置
  actuators         JSONB,                   -- 执行机构配置
  capabilities      TEXT[],                  -- 能力标签数组
  
  -- 运行状态
  is_active         BOOLEAN DEFAULT TRUE,    -- 是否启用
  status            TEXT DEFAULT 'idle',     -- idle / active / maintenance / offline
  last_status_at    TIMESTAMPTZ,             -- 最后状态更新时间
  
  -- 位置信息（如果设备是移动的）
  current_location  GEOMETRY(POINT, 4326),   -- 当前位置
  home_location     GEOMETRY(POINT, 4326),   -- 基站位置
  
  -- 配置参数
  config            JSONB,                   -- 设备配置参数
  description       TEXT,
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 设备状态历史表
CREATE TABLE device_status (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  status            TEXT NOT NULL,           -- idle / active / maintenance / offline
  location          GEOMETRY(POINT, 4326),   -- 状态位置
  battery_level     INTEGER,                 -- 电池电量百分比
  signal_strength   INTEGER,                 -- 信号强度
  error_codes       TEXT[],                  -- 错误代码数组
  metadata          JSONB,                   -- 其他状态元数据
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 设备维护日志表
CREATE TABLE maintenance_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  maintenance_type  TEXT NOT NULL,           -- routine / repair / calibration / upgrade
  description       TEXT,                    -- 维护描述
  performed_by      UUID,                    -- 维护人员ID
  performed_at      TIMESTAMPTZ NOT NULL,
  next_maintenance  TIMESTAMPTZ,             -- 下次计划维护时间
  parts_replaced    TEXT[],                  -- 更换部件列表
  cost              DECIMAL(10, 2),          -- 维护成本
  notes             TEXT                     -- 备注信息
);

-- 索引设计
CREATE INDEX idx_device_type ON device (device_type);
CREATE INDEX idx_device_platform_level ON device (platform_level);
CREATE INDEX idx_device_is_active ON device (is_active);
CREATE INDEX idx_device_status ON device (status);
CREATE INDEX idx_device_current_location ON device USING GIST (current_location);
CREATE UNIQUE INDEX uniq_device_code ON device (code) WHERE code IS NOT NULL;

CREATE INDEX idx_device_status_device_id ON device_status (device_id);
CREATE INDEX idx_device_status_recorded_at ON device_status (recorded_at);

CREATE INDEX idx_maintenance_log_device_id ON maintenance_log (device_id);
CREATE INDEX idx_maintenance_log_performed_at ON maintenance_log (performed_at);
```

### 3. 采集会话表 (collection_session) - 优化版

```sql
-- =========================================================
-- 【DDL-03】采集会话表优化版：collection_session
-- 角色：空-天-地-具身多源数据的"时间 + 行为 + 组织枢纽"
-- =========================================================

-- 采集会话表
CREATE TABLE collection_session (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联实体
  field_id          UUID NOT NULL REFERENCES field(id) ON DELETE CASCADE,
  device_id         UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  
  -- 时间信息（核心）
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  duration_minutes  INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
      ELSE NULL 
    END
  ) STORED,  -- 计算得出的持续时间（分钟）
  
  -- 任务语义
  mission_type      TEXT NOT NULL,           -- 巡检 / 定点 / 路径 / 应急 / 采样
  mission_name      TEXT,                    -- 任务名称（可读）
  description       TEXT,
  
  -- 任务参数（JSON格式，灵活存储不同类型任务的参数）
  mission_params    JSONB,                   -- 任务参数，如飞行高度、路径规划等
  
  -- 任务环境快照
  weather_snapshot  JSONB,                   -- 温度/湿度/风速/天气
  illumination      JSONB,                   -- 光照条件
  
  -- 执行状态
  status            TEXT DEFAULT 'planned',  -- planned / running / completed / failed / cancelled
  progress          INTEGER DEFAULT 0,       -- 进度百分比
  error_message     TEXT,                    -- 错误信息
  
  -- 数据统计
  data_count        JSONB,                   -- 各类数据采集数量统计
  storage_usage_mb  DECIMAL(10, 2),          -- 存储使用量（MB）
  
  -- 质量评估
  quality_score     DECIMAL(3, 2),           -- 数据质量评分（0-5）
  quality_notes     TEXT,                    -- 质量备注
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 任务执行日志表
CREATE TABLE mission_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES collection_session(id) ON DELETE CASCADE,
  log_level         TEXT NOT NULL,           -- DEBUG / INFO / WARNING / ERROR
  message           TEXT NOT NULL,
  details           JSONB,                   -- 日志详细信息
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引设计
CREATE INDEX idx_session_field_id ON collection_session (field_id);
CREATE INDEX idx_session_device_id ON collection_session (device_id);
CREATE INDEX idx_session_time_range ON collection_session (start_time, end_time);
CREATE INDEX idx_session_mission_type ON collection_session (mission_type);
CREATE INDEX idx_session_status ON collection_session (status);

CREATE INDEX idx_mission_log_session_id ON mission_log (session_id);
CREATE INDEX idx_mission_log_recorded_at ON mission_log (recorded_at);
```

### 4. 原始数据表 (raw_data) - 优化版

```sql
-- =========================================================
-- 【DDL-04】原始数据表优化版：raw_data
-- 角色：PostgreSQL ↔ MinIO 的"桥梁表"
-- =========================================================

-- 原始数据表
CREATE TABLE raw_data (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 逻辑归属
  session_id        UUID NOT NULL REFERENCES collection_session(id) ON DELETE CASCADE,
  
  -- 数据类型与来源
  data_type         TEXT NOT NULL,           -- image / video / audio / lidar / hyperspectral / environmental
  data_subtype      TEXT,                    -- 数据子类型，如RGB/多光谱/热成像
  device_id         UUID REFERENCES device(id) ON DELETE SET NULL,
  
  -- 对象存储索引（核心）
  bucket_name       TEXT NOT NULL,           -- MinIO bucket
  object_key        TEXT NOT NULL,           -- MinIO 对象路径
  
  -- 采集时空信息
  capture_time      TIMESTAMPTZ NOT NULL,
  location_geom     GEOMETRY(POINT, 4326),
  altitude_m        REAL,                    -- 采集高度（米）
  heading           REAL,                    -- 朝向（度）
  
  -- 传感器与数据元信息
  sensor_meta       JSONB,                   -- 相机参数 / 光谱段 / 高度 / 姿态
  file_meta         JSONB,                   -- 文件大小 / 分辨率 / 编码
  acquisition_meta  JSONB,                   -- 采集参数
  
  -- 数据质量
  quality_score     DECIMAL(3, 2),           -- 数据质量评分（0-5）
  quality_flags     TEXT[],                  -- 质量标记，如[blurry, overexposed]
  
  -- 校验与状态
  checksum          TEXT,                    -- 文件校验（MD5/SHA256）
  is_valid          BOOLEAN DEFAULT TRUE,
  validation_notes  TEXT,                    -- 验证备注
  
  -- 处理状态
  processing_status TEXT DEFAULT 'pending',  -- pending / processing / completed / failed
  processed_at      TIMESTAMPTZ,             -- 处理完成时间
  
  -- AI分析状态
  ai_status         TEXT DEFAULT 'pending',  -- pending / analyzing / completed / failed
  ai_analyzed_at    TIMESTAMPTZ,             -- AI分析完成时间
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 数据标签表（支持多维度标记数据）
CREATE TABLE raw_data_tags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data_id       UUID NOT NULL REFERENCES raw_data(id) ON DELETE CASCADE,
  tag_category      TEXT NOT NULL,           -- 标签类别：content/quality/weather/crop_stage
  tag_value         TEXT NOT NULL,           -- 标签值
  confidence        DECIMAL(3, 2),           -- 标注置信度（0-1）
  source            TEXT,                    -- 标注来源：manual/ai/predefined
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 索引设计
CREATE INDEX idx_raw_data_session ON raw_data (session_id);
CREATE INDEX idx_raw_data_type ON raw_data (data_type);
CREATE INDEX idx_raw_data_subtype ON raw_data (data_subtype);
CREATE INDEX idx_raw_data_device_id ON raw_data (device_id);
CREATE INDEX idx_raw_data_capture_time ON raw_data (capture_time);
CREATE INDEX idx_raw_data_location_geom ON raw_data USING GIST (location_geom);
CREATE INDEX idx_raw_data_processing_status ON raw_data (processing_status);
CREATE INDEX idx_raw_data_ai_status ON raw_data (ai_status);

-- 复合索引：支持常见查询组合
CREATE INDEX idx_raw_data_session_type ON raw_data (session_id, data_type);
CREATE INDEX idx_raw_data_time_type ON raw_data (capture_time, data_type);
CREATE INDEX idx_raw_data_location_type ON raw_data USING GIST (location_geom) WHERE data_type = 'image';

-- 防止同一 session 下重复索引同一对象
CREATE UNIQUE INDEX uniq_raw_data_object ON raw_data (session_id, bucket_name, object_key);

CREATE INDEX idx_raw_data_tags_data_id ON raw_data_tags (raw_data_id);
CREATE INDEX idx_raw_data_tags_category ON raw_data_tags (tag_category);
CREATE INDEX idx_raw_data_tags_value ON raw_data_tags (tag_value);
```

### 5. 作物对象表 (crop_object) - 优化版

```sql
-- =========================================================
-- 【DDL-05】作物对象表优化版：crop_object
-- 角色：从"原始感知数据"中抽象出的【具身作物实体】
-- =========================================================

-- 作物对象表
CREATE TABLE crop_object (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 空间归属
  field_id          UUID NOT NULL REFERENCES field(id) ON DELETE CASCADE,
  
  -- 作物基础语义
  crop_type         TEXT NOT NULL,           -- 作物种类：wheat / corn / rice
  crop_variety      TEXT,                    -- 作物品种
  object_level      TEXT NOT NULL,           -- plant / row / patch / zone
  object_code       TEXT,                    -- 业务可读编号（如 P-001-023）
  
  -- 空间形态（核心）
  geometry          GEOMETRY(GEOMETRY, 4326),
  area_m2           DOUBLE PRECISION,        -- 对象面积（平方米）
  
  -- 生长状态
  growth_stage      TEXT,                    -- 出苗/拔节/抽穗/成熟
  health_status     TEXT,                    -- healthy / stress / disease / unknown
  stress_type      TEXT,                    -- water / nutrient / pest / disease / unknown
  stress_level      INTEGER,                 -- 胁迫等级（1-5）
  
  -- 来源数据
  source_raw_data_id UUID REFERENCES raw_data(id) ON DELETE SET NULL,
  
  -- 生命周期
  first_seen_at     TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ NOT NULL,
  
  -- 智能属性扩展
  attributes        JSONB,                  -- 高度/叶面积指数/颜色指数等
  measurements      JSONB,                  -- 测量值历史记录
  
  -- 预测信息
  predicted_harvest DATE,                   -- 预测收获日期
  predicted_yield   DECIMAL(10, 2),         -- 预测产量
  
  -- 管理字段
  is_active         BOOLEAN DEFAULT TRUE,
  needs_attention   BOOLEAN DEFAULT FALSE,  -- 是否需要关注
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 作物观测记录表（历史状态追踪）
CREATE TABLE crop_observation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_object_id    UUID NOT NULL REFERENCES crop_object(id) ON DELETE CASCADE,
  
  -- 观测信息
  observation_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geometry          GEOMETRY(GEOMETRY, 4326), -- 观测时的空间形态（可能变化）
  
  -- 状态信息
  growth_stage      TEXT,
  health_status     TEXT,
  stress_type       TEXT,
  stress_level      INTEGER,
  
  -- 测量值
  height_cm         REAL,
  lai               REAL,                   -- 叶面积指数
  ndvi              REAL,                   -- 归一化植被指数
  chlorophyll       REAL,                   -- 叶绿素含量
  
  -- 属性扩展
  attributes        JSONB,                  -- 其他观测属性
  
  -- 来源数据
  source_raw_data_id UUID REFERENCES raw_data(id) ON DELETE SET NULL,
  ai_confidence     DECIMAL(3, 2)           -- AI识别置信度
);

-- 农事干预记录表
CREATE TABLE crop_intervention (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_object_id    UUID REFERENCES crop_object(id) ON DELETE CASCADE,
  field_id          UUID NOT NULL REFERENCES field(id) ON DELETE CASCADE,
  
  -- 干预信息
  intervention_type  TEXT NOT NULL,          -- irrigation / fertilization / pesticide / pruning
  intervention_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 干预内容
  material          TEXT,                   -- 物料，如肥料种类、农药名称
  amount            REAL,                   -- 用量
  unit              TEXT,                   -- 单位
  
  -- 执行信息
  performed_by      UUID,                   -- 执行人员ID
  equipment         TEXT,                   -- 使用的设备
  
  -- 预期与实际效果
  expected_effect   TEXT,                   -- 预期效果
  actual_effect     TEXT,                   -- 实际效果
  
  -- 备注
  notes             TEXT,
  
  -- 关联原始数据（干预前后的对比）
  before_data_id    UUID REFERENCES raw_data(id) ON DELETE SET NULL,
  after_data_id     UUID REFERENCES raw_data(id) ON DELETE SET NULL
);

-- 索引设计
CREATE INDEX idx_crop_object_field ON crop_object (field_id);
CREATE INDEX idx_crop_object_type ON crop_object (crop_type);
CREATE INDEX idx_crop_object_stage ON crop_object (growth_stage);
CREATE INDEX idx_crop_object_health ON crop_object (health_status);
CREATE INDEX idx_crop_object_geometry ON crop_object USING GIST (geometry);
CREATE INDEX idx_crop_object_lifecycle ON crop_object (first_seen_at, last_seen_at);
CREATE INDEX idx_crop_object_active ON crop_object (is_active);
CREATE INDEX idx_crop_object_attention ON crop_object (needs_attention);
CREATE UNIQUE INDEX uniq_crop_object_code ON crop_object (field_id, object_code) WHERE object_code IS NOT NULL;

CREATE INDEX idx_crop_observation_object_id ON crop_observation (crop_object_id);
CREATE INDEX idx_crop_observation_time ON crop_observation (observation_time);

CREATE INDEX idx_crop_intervention_object_id ON crop_intervention (crop_object_id);
CREATE INDEX idx_crop_intervention_field_id ON crop_intervention (field_id);
CREATE INDEX idx_crop_intervention_type ON crop_intervention (intervention_type);
CREATE INDEX idx_crop_intervention_time ON crop_intervention (intervention_time);
```

### 6. 分析结果与告警表 (新增)

```sql
-- =========================================================
-- 【DDL-06】分析结果表：analytics_result
-- 角色：存储各种分析处理结果
-- =========================================================

-- 分析结果表
CREATE TABLE analytics_result (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联信息
  field_id          UUID REFERENCES field(id) ON DELETE CASCADE,
  session_id        UUID REFERENCES collection_session(id) ON DELETE CASCADE,
  
  -- 分析信息
  analysis_type     TEXT NOT NULL,           -- crop_health / growth_prediction / yield_estimation / disease_detection
  algorithm_version TEXT,                    -- 算法版本
  analysis_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 输入数据
  input_data_ids    UUID[] REFERENCES raw_data(id), -- 输入的原始数据ID数组
  
  -- 结果数据
  result_data       JSONB NOT NULL,          -- 分析结果（JSON格式）
  result_summary    TEXT,                    -- 结果摘要
  confidence        DECIMAL(3, 2),           -- 结果置信度（0-1）
  
  -- 可视化结果
  visualization_url TEXT,                   -- 可视化结果URL（指向MinIO）
  
  -- 验证与反馈
  verified_by       UUID,                    -- 验证人员ID
  verified_at       TIMESTAMPTZ,             -- 验证时间
  verification_status TEXT,                  -- confirmed / rejected / pending
  verification_notes TEXT,                  -- 验证备注
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- 【DDL-07】告警表：alert
-- 角色：系统告警信息管理
-- =========================================================

-- 告警表
CREATE TABLE alert (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 告警内容
  title             TEXT NOT NULL,           -- 告警标题
  description       TEXT NOT NULL,           -- 告警描述
  alert_type        TEXT NOT NULL,           -- disease / pest / stress / equipment / weather
  severity          TEXT NOT NULL,           -- low / medium / high / critical
  
  -- 关联信息
  field_id          UUID REFERENCES field(id) ON DELETE CASCADE,
  crop_object_id    UUID REFERENCES crop_object(id) ON DELETE CASCADE,
  device_id         UUID REFERENCES device(id) ON DELETE CASCADE,
  analytics_result_id UUID REFERENCES analytics_result(id) ON DELETE SET NULL,
  
  -- 告警状态
  status            TEXT DEFAULT 'active',   -- active / acknowledged / resolved / dismissed
  acknowledged_by   UUID,                    -- 确认人员ID
  acknowledged_at   TIMESTAMPTZ,             -- 确认时间
  resolved_by       UUID,                    -- 解决人员ID
  resolved_at       TIMESTAMPTZ,             -- 解决时间
  resolution_notes  TEXT,                    -- 解决方案备注
  
  -- 告警触发条件
  trigger_criteria  JSONB,                   -- 触发告警的条件
  
  -- 推荐措施
  recommendations   TEXT[],                  -- 推荐措施数组
  
  -- 地理位置信息
  location_geom     GEOMETRY(GEOMETRY, 4326), -- 告警位置
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 索引设计
CREATE INDEX idx_analytics_result_field ON analytics_result (field_id);
CREATE INDEX idx_analytics_result_session ON analytics_result (session_id);
CREATE INDEX idx_analytics_result_type ON analytics_result (analysis_type);
CREATE INDEX idx_analytics_result_time ON analytics_result (analysis_time);

CREATE INDEX idx_alert_field ON alert (field_id);
CREATE INDEX idx_alert_type ON alert (alert_type);
CREATE INDEX idx_alert_severity ON alert (severity);
CREATE INDEX idx_alert_status ON alert (status);
CREATE INDEX idx_alert_location ON alert USING GIST (location_geom);
CREATE INDEX idx_alert_created_at ON alert (created_at);
```

### 7. 用户与系统表 (优化版)

```sql
-- =========================================================
-- 【DDL-08】用户表：user
-- 角色：系统用户管理
-- =========================================================

-- 用户表
CREATE TABLE "user" (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  username          TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  
  -- 个人信息
  first_name        TEXT,
  last_name         TEXT,
  phone             TEXT,
  avatar_url        TEXT,                   -- 头像URL（指向MinIO）
  
  -- 角色与权限
  role              TEXT NOT NULL DEFAULT 'viewer', -- admin / manager / agronomist / operator / viewer
  permissions       JSONB,                  -- 详细权限配置
  
  -- 组织信息
  organization_id   UUID,                   -- 所属组织
  department        TEXT,                   -- 所属部门
  
  -- 设置与偏好
  timezone          TEXT DEFAULT 'UTC',     -- 时区设置
  language          TEXT DEFAULT 'zh-CN',   -- 语言设置
  ui_preferences    JSONB,                  -- UI偏好设置
  
  -- 状态信息
  is_active         BOOLEAN DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 操作日志表
CREATE TABLE operation_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES "user"(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,           -- 操作类型
  resource_type     TEXT,                    -- 资源类型
  resource_id       UUID,                    -- 资源ID
  details           JSONB,                   -- 操作详情
  ip_address        INET,                    -- IP地址
  user_agent        TEXT,                    -- 用户代理
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引设计
CREATE INDEX idx_user_username ON "user" (username);
CREATE INDEX idx_user_email ON "user" (email);
CREATE INDEX idx_user_role ON "user" (role);
CREATE INDEX idx_user_is_active ON "user" (is_active);
CREATE INDEX idx_user_organization ON "user" (organization_id);

CREATE INDEX idx_operation_log_user_id ON operation_log (user_id);
CREATE INDEX idx_operation_log_action ON operation_log (action);
CREATE INDEX idx_operation_log_timestamp ON operation_log (timestamp);
```

### 8. 反馈表 (feedback) - 优化版

```sql
-- =========================================================
-- 【DDL-09】反馈表优化版：feedback
-- 角色：用户反馈信息管理
-- =========================================================

-- 反馈表
CREATE TABLE feedback (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 用户信息
  user_id           UUID REFERENCES "user"(id) ON DELETE SET NULL,
  name              TEXT,                   -- 用户姓名（如未登录）
  email             TEXT,                   -- 电子邮箱
  
  -- 反馈内容
  subject           TEXT NOT NULL,          -- 反馈主题/标题
  content           TEXT NOT NULL,          -- 反馈内容详细信息
  
  -- 反馈分类与优先级
  category          TEXT DEFAULT 'general', -- bug/suggestion/question/general
  priority          TEXT DEFAULT 'normal',  -- low/normal/high/critical
  feedback_type     TEXT DEFAULT 'general', -- ui/functionality/data/performance/general
  
  -- 关联信息
  related_resource_type TEXT,                -- 相关资源类型
  related_resource_id UUID,                 -- 相关资源ID
  session_data      JSONB,                  -- 会话数据（如浏览器信息）
  attachments       TEXT[],                 -- 附件URL数组（指向MinIO）
  
  -- 反馈状态
  status            TEXT DEFAULT 'pending',  -- pending/in_process/resolved/closed
  
  -- 处理信息
  assigned_to       UUID REFERENCES "user"(id) ON DELETE SET NULL,
  response_text     TEXT,                   -- 回复内容
  internal_notes    TEXT,                   -- 内部处理备注
  resolved_at       TIMESTAMPTZ,            -- 解决时间
  resolution_method TEXT,                   -- 解决方法
  
  -- 满意度评价
  satisfaction_rating INTEGER,              -- 满意度评分（1-5）
  satisfaction_notes TEXT,                  -- 满意度备注
  
  -- 系统信息
  ip_address        INET,                   -- 用户IP
  user_agent        TEXT,                   -- 用户浏览器信息
  referrer          TEXT,                   -- 来源页面
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 索引设计
CREATE INDEX idx_feedback_user_id ON feedback (user_id);
CREATE INDEX idx_feedback_status ON feedback (status);
CREATE INDEX idx_feedback_priority ON feedback (priority);
CREATE INDEX idx_feedback_category ON feedback (category);
CREATE INDEX idx_feedback_type ON feedback (feedback_type);
CREATE INDEX idx_feedback_created_at ON feedback (created_at);
CREATE INDEX idx_feedback_assigned_to ON feedback (assigned_to);
```

## 分区策略

### 时间分区设计

对于会话、原始数据、观测记录等时序性强的表，采用时间分区策略：

```sql
-- 按月分区采集会话表
CREATE TABLE collection_session (
  -- 表结构同上
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... 其他字段
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE collection_session_2025_01 PARTITION OF collection_session
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE collection_session_2025_02 PARTITION OF collection_session
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 自动创建未来分区的函数
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  end_date DATE;
BEGIN
  partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
  end_date := start_date + interval '1 month';
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                  FOR VALUES FROM (%L) TO (%L)',
                 partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

### 按地块分区设计

对于作物对象表等空间相关的表，可以按地块ID进行哈希分区：

```sql
-- 按地块ID哈希分区作物对象表
CREATE TABLE crop_object (
  -- 表结构同上
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES field(id) ON DELETE CASCADE,
  -- ... 其他字段
) PARTITION BY HASH (field_id);

-- 创建4个分区
CREATE TABLE crop_object_0 PARTITION OF crop_object FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE crop_object_1 PARTITION OF crop_object FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE crop_object_2 PARTITION OF crop_object FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE crop_object_3 PARTITION OF crop_object FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

## 索引优化策略

### 复合索引设计

根据常见查询模式设计复合索引：

```sql
-- 按字段、时间范围和任务类型查询采集会话
CREATE INDEX idx_session_field_time_type ON collection_session 
  (field_id, start_time DESC, mission_type) 
  WHERE status = 'completed';

-- 按空间位置、数据类型和时间查询原始数据
CREATE INDEX idx_raw_data_spatial ON raw_data 
  USING GIST (location_geom) 
  WHERE data_type IN ('image', 'multispectral');

-- 按生长阶段、健康状态和时间查询作物对象
CREATE INDEX idx_crop_object_health_time ON crop_object 
  (growth_stage, health_status, last_seen_at DESC);
```

### 部分索引设计

针对特定条件的查询使用部分索引：

```sql
-- 只索引活跃的作物对象
CREATE INDEX idx_crop_active_objects ON crop_object (field_id, last_seen_at) 
  WHERE is_active = TRUE;

-- 只索引待处理的告警
CREATE INDEX idx_alert_active ON alert (severity, created_at) 
  WHERE status = 'active';
```

## 查询优化建议

### 1. 使用空间索引优化地理位置查询

```sql
-- 使用空间索引优化范围内的查询
SELECT * FROM field 
WHERE ST_Intersects(
  location_geom, 
  ST_MakeEnvelope(116.14, 39.94, 116.16, 39.96, 4326)
);

-- 使用K近邻查询最近的作物对象
SELECT *, ST_Distance(geometry, ST_MakePoint(116.1503, 39.9502)::geography) as distance_m
FROM crop_object 
ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(116.1503, 39.9502), 4326)
LIMIT 10;
```

### 2. 使用时间范围索引优化时序查询

```sql
-- 使用时间范围索引优化查询
SELECT * FROM collection_session 
WHERE start_time >= '2025-06-01' AND start_time < '2025-07-01'
  AND mission_type = '巡检';
```

### 3. 使用JSONB索引优化非结构化数据查询

```sql
-- 在JSONB字段上创建GIN索引
CREATE INDEX idx_raw_data_sensor_meta_gin ON raw_data USING GIN (sensor_meta);

-- 使用JSONB索引查询特定传感器配置的数据
SELECT * FROM raw_data 
WHERE sensor_meta @> '{"camera": "RGB", "altitude_m": 120}';
```

## 数据备份与恢复策略

### 1. 定期全量备份

```bash
# 使用pg_dump进行全量备份
pg_dump -h localhost -U postgres -d green_tracker -f backup_$(date +%Y%m%d).sql

# 使用pg_dumpall备份所有数据库
pg_dumpall -h localhost -U postgres -f full_backup_$(date +%Y%m%d).sql
```

### 2. 增量备份与WAL归档

```bash
# 配置postgresql.conf启用WAL归档
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
```

### 3. 表级备份

```bash
# 备份关键表
pg_dump -h localhost -U postgres -d green_tracker -t field -t crop_object -t raw_data -f critical_tables_$(date +%Y%m%d).sql
```

## 性能监控与调优

### 1. 慢查询监控

```sql
-- 启用慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 记录超过1秒的查询
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
```

### 2. 查询分析

```sql
-- 使用EXPLAIN ANALYZE分析查询性能
EXPLAIN ANALYZE 
SELECT * FROM raw_data 
WHERE capture_time >= '2025-06-01' 
  AND ST_DWithin(
    location_geom::geography,
    ST_SetSRID(ST_MakePoint(116.15, 39.95), 4326)::geography,
    100
  );
```

### 3. 索引使用情况监控

```sql
-- 查看索引使用统计
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 总结

本优化设计方案从空间优先、时序组织、对象抽象和扩展性四个方面，对Green Tracker系统的数据库结构进行了全面优化。通过合理的表结构设计、索引策略、分区方案和查询优化，系统能够高效支持空-天-地一体化农情监测的数据存储、查询和分析需求。

关键优化点：
1. 强调空间数据的核心地位，充分利用PostGIS的空间索引能力
2. 完善时序数据的组织和管理，支持历史回溯和趋势分析
3. 抽象作物对象作为智能分析的最小单元，支持跨时间追踪
4. 设计灵活的元数据存储方案，支持多源数据接入
5. 实现高效的索引和分区策略，提升查询性能
6. 完善的备份恢复和监控策略，保障系统可靠性

该方案为Green Tracker系统提供了坚实的数据基础，支持农情监测、智能分析和精准农业决策的全流程需求。