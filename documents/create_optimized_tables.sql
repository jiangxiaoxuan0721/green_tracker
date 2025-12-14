-- =========================================================
-- Green Tracker 优化版数据库表结构创建脚本
-- 执行顺序：按表依赖关系排序
-- =========================================================

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 设置时区
SET timezone = 'UTC';

-- =========================================================
-- 1. 农田基础表 (field) - 优化版
-- =========================================================

CREATE TABLE IF NOT EXISTS field (
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

-- 创建触发器
DROP TRIGGER IF EXISTS trg_update_field_geometry_attributes ON field;
CREATE TRIGGER trg_update_field_geometry_attributes
BEFORE INSERT OR UPDATE ON field
FOR EACH ROW EXECUTE FUNCTION update_field_geometry_attributes();

-- 触发器：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 field 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_field_updated_at ON field;
CREATE TRIGGER update_field_updated_at 
BEFORE UPDATE ON field 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 索引设计
CREATE INDEX IF NOT EXISTS idx_field_location_geom ON field USING GIST (location_geom);
CREATE INDEX IF NOT EXISTS idx_field_center_point ON field USING GIST (center_point);
CREATE INDEX IF NOT EXISTS idx_field_crop_type ON field (crop_type);
CREATE INDEX IF NOT EXISTS idx_field_tags ON field USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_field_is_active ON field (is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_field_code ON field (code) WHERE code IS NOT NULL;

-- =========================================================
-- 2. 设备表 (device) - 优化版
-- =========================================================

-- 设备表
CREATE TABLE IF NOT EXISTS device (
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

-- 为 device 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_device_updated_at ON device;
CREATE TRIGGER update_device_updated_at 
BEFORE UPDATE ON device 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 设备状态历史表
CREATE TABLE IF NOT EXISTS device_status (
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
CREATE TABLE IF NOT EXISTS maintenance_log (
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

-- 设备相关索引
CREATE INDEX IF NOT EXISTS idx_device_type ON device (device_type);
CREATE INDEX IF NOT EXISTS idx_device_platform_level ON device (platform_level);
CREATE INDEX IF NOT EXISTS idx_device_is_active ON device (is_active);
CREATE INDEX IF NOT EXISTS idx_device_status ON device (status);
CREATE INDEX IF NOT EXISTS idx_device_current_location ON device USING GIST (current_location);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_device_code ON device (code) WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_device_status_device_id ON device_status (device_id);
CREATE INDEX IF NOT EXISTS idx_device_status_recorded_at ON device_status (recorded_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_log_device_id ON maintenance_log (device_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_performed_at ON maintenance_log (performed_at);

-- =========================================================
-- 3. 用户表 (user) - 优化版
-- =========================================================

-- 用户表
CREATE TABLE IF NOT EXISTS "user" (
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

-- 为 user 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_user_updated_at ON "user";
CREATE TRIGGER update_user_updated_at 
BEFORE UPDATE ON "user" 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_log (
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

-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user" (email);
CREATE INDEX IF NOT EXISTS idx_user_role ON "user" (role);
CREATE INDEX IF NOT EXISTS idx_user_is_active ON "user" (is_active);
CREATE INDEX IF NOT EXISTS idx_user_organization ON "user" (organization_id);

CREATE INDEX IF NOT EXISTS idx_operation_log_user_id ON operation_log (user_id);
CREATE INDEX IF NOT EXISTS idx_operation_log_action ON operation_log (action);
CREATE INDEX IF NOT EXISTS idx_operation_log_timestamp ON operation_log (timestamp);

-- =========================================================
-- 4. 采集会话表 (collection_session) - 优化版
-- =========================================================

-- 采集会话表
CREATE TABLE IF NOT EXISTS collection_session (
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

-- 为 collection_session 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_collection_session_updated_at ON collection_session;
CREATE TRIGGER update_collection_session_updated_at 
BEFORE UPDATE ON collection_session 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 任务执行日志表
CREATE TABLE IF NOT EXISTS mission_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES collection_session(id) ON DELETE CASCADE,
  log_level         TEXT NOT NULL,           -- DEBUG / INFO / WARNING / ERROR
  message           TEXT NOT NULL,
  details           JSONB,                   -- 日志详细信息
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 采集会话相关索引
CREATE INDEX IF NOT EXISTS idx_session_field_id ON collection_session (field_id);
CREATE INDEX IF NOT EXISTS idx_session_device_id ON collection_session (device_id);
CREATE INDEX IF NOT EXISTS idx_session_time_range ON collection_session (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_session_mission_type ON collection_session (mission_type);
CREATE INDEX IF NOT EXISTS idx_session_status ON collection_session (status);

CREATE INDEX IF NOT EXISTS idx_mission_log_session_id ON mission_log (session_id);
CREATE INDEX IF NOT EXISTS idx_mission_log_recorded_at ON mission_log (recorded_at);

-- =========================================================
-- 5. 原始数据表 (raw_data) - 优化版
-- =========================================================

-- 原始数据表
CREATE TABLE IF NOT EXISTS raw_data (
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

-- 为 raw_data 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_raw_data_updated_at ON raw_data;
CREATE TRIGGER update_raw_data_updated_at 
BEFORE UPDATE ON raw_data 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 数据标签表（支持多维度标记数据）
CREATE TABLE IF NOT EXISTS raw_data_tags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data_id       UUID NOT NULL REFERENCES raw_data(id) ON DELETE CASCADE,
  tag_category      TEXT NOT NULL,           -- 标签类别：content/quality/weather/crop_stage
  tag_value         TEXT NOT NULL,           -- 标签值
  confidence        DECIMAL(3, 2),           -- 标注置信度（0-1）
  source            TEXT,                    -- 标注来源：manual/ai/predefined
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 原始数据相关索引
CREATE INDEX IF NOT EXISTS idx_raw_data_session ON raw_data (session_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_type ON raw_data (data_type);
CREATE INDEX IF NOT EXISTS idx_raw_data_subtype ON raw_data (data_subtype);
CREATE INDEX IF NOT EXISTS idx_raw_data_device_id ON raw_data (device_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_capture_time ON raw_data (capture_time);
CREATE INDEX IF NOT EXISTS idx_raw_data_location_geom ON raw_data USING GIST (location_geom);
CREATE INDEX IF NOT EXISTS idx_raw_data_processing_status ON raw_data (processing_status);
CREATE INDEX IF NOT EXISTS idx_raw_data_ai_status ON raw_data (ai_status);

-- 复合索引：支持常见查询组合
CREATE INDEX IF NOT EXISTS idx_raw_data_session_type ON raw_data (session_id, data_type);
CREATE INDEX IF NOT EXISTS idx_raw_data_time_type ON raw_data (capture_time, data_type);
CREATE INDEX IF NOT EXISTS idx_raw_data_location_type ON raw_data USING GIST (location_geom) WHERE data_type = 'image';

-- 防止同一 session 下重复索引同一对象
CREATE UNIQUE INDEX IF NOT EXISTS uniq_raw_data_object ON raw_data (session_id, bucket_name, object_key);

CREATE INDEX IF NOT EXISTS idx_raw_data_tags_data_id ON raw_data_tags (raw_data_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_tags_category ON raw_data_tags (tag_category);
CREATE INDEX IF NOT EXISTS idx_raw_data_tags_value ON raw_data_tags (tag_value);

-- =========================================================
-- 6. 作物对象表 (crop_object) - 优化版
-- =========================================================

-- 作物对象表
CREATE TABLE IF NOT EXISTS crop_object (
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
  stress_type       TEXT,                    -- water / nutrient / pest / disease / unknown
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

-- 为 crop_object 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_crop_object_updated_at ON crop_object;
CREATE TRIGGER update_crop_object_updated_at 
BEFORE UPDATE ON crop_object 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 作物观测记录表（历史状态追踪）
CREATE TABLE IF NOT EXISTS crop_observation (
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
CREATE TABLE IF NOT EXISTS crop_intervention (
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

-- 作物对象相关索引
CREATE INDEX IF NOT EXISTS idx_crop_object_field ON crop_object (field_id);
CREATE INDEX IF NOT EXISTS idx_crop_object_type ON crop_object (crop_type);
CREATE INDEX IF NOT EXISTS idx_crop_object_stage ON crop_object (growth_stage);
CREATE INDEX IF NOT EXISTS idx_crop_object_health ON crop_object (health_status);
CREATE INDEX IF NOT EXISTS idx_crop_object_geometry ON crop_object USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_crop_object_lifecycle ON crop_object (first_seen_at, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_crop_object_active ON crop_object (is_active);
CREATE INDEX IF NOT EXISTS idx_crop_object_attention ON crop_object (needs_attention);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crop_object_code ON crop_object (field_id, object_code) WHERE object_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crop_observation_object_id ON crop_observation (crop_object_id);
CREATE INDEX IF NOT EXISTS idx_crop_observation_time ON crop_observation (observation_time);

CREATE INDEX IF NOT EXISTS idx_crop_intervention_object_id ON crop_intervention (crop_object_id);
CREATE INDEX IF NOT EXISTS idx_crop_intervention_field_id ON crop_intervention (field_id);
CREATE INDEX IF NOT EXISTS idx_crop_intervention_type ON crop_intervention (intervention_type);
CREATE INDEX IF NOT EXISTS idx_crop_intervention_time ON crop_intervention (intervention_time);

-- =========================================================
-- 7. 分析结果表 (analytics_result)
-- =========================================================

-- 分析结果表
CREATE TABLE IF NOT EXISTS analytics_result (
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

-- 为 analytics_result 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_analytics_result_updated_at ON analytics_result;
CREATE TRIGGER update_analytics_result_updated_at 
BEFORE UPDATE ON analytics_result 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 分析结果相关索引
CREATE INDEX IF NOT EXISTS idx_analytics_result_field ON analytics_result (field_id);
CREATE INDEX IF NOT EXISTS idx_analytics_result_session ON analytics_result (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_result_type ON analytics_result (analysis_type);
CREATE INDEX IF NOT EXISTS idx_analytics_result_time ON analytics_result (analysis_time);

-- =========================================================
-- 8. 告警表 (alert)
-- =========================================================

-- 告警表
CREATE TABLE IF NOT EXISTS alert (
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

-- 为 alert 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_alert_updated_at ON alert;
CREATE TRIGGER update_alert_updated_at 
BEFORE UPDATE ON alert 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 告警相关索引
CREATE INDEX IF NOT EXISTS idx_alert_field ON alert (field_id);
CREATE INDEX IF NOT EXISTS idx_alert_type ON alert (alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_severity ON alert (severity);
CREATE INDEX IF NOT EXISTS idx_alert_status ON alert (status);
CREATE INDEX IF NOT EXISTS idx_alert_location ON alert USING GIST (location_geom);
CREATE INDEX IF NOT EXISTS idx_alert_created_at ON alert (created_at);

-- =========================================================
-- 9. 反馈表 (feedback) - 优化版
-- =========================================================

-- 反馈表
CREATE TABLE IF NOT EXISTS feedback (
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
  related_resource_type TEXT,               -- 相关资源类型
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
  satisfaction_rating INTEGER,             -- 满意度评分（1-5）
  satisfaction_notes TEXT,                  -- 满意度备注
  
  -- 系统信息
  ip_address        INET,                   -- 用户IP
  user_agent        TEXT,                   -- 用户浏览器信息
  referrer          TEXT,                   -- 来源页面
  
  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 为 feedback 表创建 updated_at 触发器
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at 
BEFORE UPDATE ON feedback 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 反馈相关索引
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback (priority);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback (category);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback (feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON feedback (assigned_to);

-- =========================================================
-- 示例数据插入
-- =========================================================

-- 插入示例农田
INSERT INTO field (
  name, 
  description, 
  code, 
  location_geom,
  crop_type,
  crop_variety,
  planting_date,
  soil_type,
  irrigation_type,
  tags
) VALUES (
  '示范田A区',
  '用于示范的高标准农田',
  'FIELD-DEMO-A',
  ST_GeomFromText('POLYGON((116.10 39.90, 116.20 39.90, 116.20 40.00, 116.10 40.00, 116.10 39.90))', 4326),
  'wheat',
  '济麦22',
  '2025-03-15',
  '壤土',
  '滴灌',
  ARRAY['示范田', '高标准', '有机']
) ON CONFLICT (code) DO NOTHING;

-- 插入示例设备
INSERT INTO device (
  name, 
  code, 
  device_type, 
  platform_level, 
  model, 
  manufacturer,
  sensors,
  actuators,
  capabilities,
  status,
  description
) VALUES (
  '农业巡检无人机1号',
  'UAV-AGRI-001',
  'uav',
  '空',
  'DJI M300 RTK',
  '大疆',
  '{"RGB": true, "multispectral": true, "thermal": false}',
  '{"flight": true, "gimbal": true}',
  ARRAY['巡检', '测绘', '多光谱'],
  'active',
  '多光谱农业巡检无人机，配备RGB和多光谱相机'
) ON CONFLICT (code) DO NOTHING;

-- 插入示例管理员用户
INSERT INTO "user" (
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role
) VALUES (
  'admin',
  'admin@greentracker.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W',  -- 密码: admin123
  '系统',
  '管理员',
  'admin'
) ON CONFLICT (username) DO NOTHING;

-- =========================================================
-- 视图定义
-- =========================================================

-- 创建农田统计视图
CREATE OR REPLACE VIEW field_statistics AS
SELECT 
  f.id,
  f.name,
  f.code,
  f.crop_type,
  f.crop_variety,
  f.area_m2,
  f.planting_date,
  f.expected_harvest,
  COALESCE(obj_count.total_objects, 0) AS total_objects,
  COALESCE(obj_count.healthy_objects, 0) AS healthy_objects,
  COALESCE(obj_count.stress_objects, 0) AS stress_objects,
  COALESCE(alert_count.active_alerts, 0) AS active_alerts,
  COALESCE(session_count.total_sessions, 0) AS total_sessions,
  COALESCE(session_count.last_session, NULL) AS last_session_date
FROM field f
LEFT JOIN (
  SELECT 
    field_id,
    COUNT(*) AS total_objects,
    COUNT(CASE WHEN health_status = 'healthy' THEN 1 END) AS healthy_objects,
    COUNT(CASE WHEN health_status IN ('stress', 'disease') THEN 1 END) AS stress_objects
  FROM crop_object
  WHERE is_active = TRUE
  GROUP BY field_id
) obj_count ON f.id = obj_count.field_id
LEFT JOIN (
  SELECT 
    field_id,
    COUNT(*) AS active_alerts
  FROM alert
  WHERE status = 'active'
  GROUP BY field_id
) alert_count ON f.id = alert_count.field_id
LEFT JOIN (
  SELECT 
    field_id,
    COUNT(*) AS total_sessions,
    MAX(start_time) AS last_session
  FROM collection_session
  GROUP BY field_id
) session_count ON f.id = session_count.field_id
WHERE f.is_active = TRUE;

-- 创建设备状态统计视图
CREATE OR REPLACE VIEW device_status_summary AS
SELECT 
  d.id,
  d.name,
  d.code,
  d.device_type,
  d.platform_level,
  d.model,
  d.status AS current_status,
  d.last_status_at,
  ds.battery_level,
  ds.signal_strength,
  COALESCE(session_count.total_sessions, 0) AS total_sessions,
  COALESCE(session_count.last_session, NULL) AS last_session_date,
  COALESCE(session_count.total_flight_hours, 0) AS total_flight_hours
FROM device d
LEFT JOIN (
  SELECT DISTINCT ON (device_id) 
    device_id,
    battery_level,
    signal_strength,
    recorded_at
  FROM device_status
  ORDER BY device_id, recorded_at DESC
) ds ON d.id = ds.device_id
LEFT JOIN (
  SELECT 
    device_id,
    COUNT(*) AS total_sessions,
    SUM(CASE WHEN end_time IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    ELSE NULL END) AS total_flight_hours,
    MAX(start_time) AS last_session
  FROM collection_session
  GROUP BY device_id
) session_count ON d.id = session_count.device_id
WHERE d.is_active = TRUE;

-- 创建最新作物观测视图
CREATE OR REPLACE VIEW latest_crop_observations AS
SELECT DISTINCT ON (crop_object_id)
  co.id AS crop_object_id,
  co.field_id,
  co.crop_type,
  co.crop_variety,
  co.object_level,
  co.object_code,
  co.geometry,
  co.growth_stage,
  co.health_status,
  co.stress_type,
  co.stress_level,
  co.needs_attention,
  obs.observation_time,
  obs.height_cm,
  obs.lai,
  obs.ndvi,
  obs.chlorophyll,
  obs.ai_confidence,
  CASE 
    WHEN obs.observation_time >= NOW() - INTERVAL '7 days' THEN 'recent'
    WHEN obs.observation_time >= NOW() - INTERVAL '30 days' THEN 'moderate'
    ELSE 'old'
  END AS observation_freshness
FROM crop_object co
LEFT JOIN crop_observation obs ON co.id = obs.crop_object_id
WHERE co.is_active = TRUE
ORDER BY crop_object_id, obs.observation_time DESC;

-- =========================================================
-- 存储过程定义
-- =========================================================

-- 创建存储过程：更新作物对象健康状态
CREATE OR REPLACE FUNCTION update_crop_health_status(
  p_field_id UUID,
  p_stress_threshold INTEGER DEFAULT 3
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- 更新超过胁迫阈值的作物对象状态
  UPDATE crop_object
  SET 
    health_status = CASE 
      WHEN stress_level >= p_stress_threshold THEN 'stress'
      ELSE 'healthy'
    END,
    needs_attention = CASE 
      WHEN stress_level >= p_stress_threshold THEN TRUE
      ELSE FALSE
    END,
    updated_at = NOW()
  WHERE 
    field_id = p_field_id
    AND is_active = TRUE
    AND stress_level IS NOT NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- 记录操作日志
  INSERT INTO operation_log (
    user_id,
    action,
    resource_type,
    details,
    timestamp
  ) VALUES (
    NULL,  -- 系统操作
    '批量更新作物健康状态',
    'crop_object',
    JSON_BUILD_OBJECT(
      'field_id', p_field_id,
      'stress_threshold', p_stress_threshold,
      'updated_count', updated_count
    ),
    NOW()
  );
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 创建存储过程：生成作物生长报告
CREATE OR REPLACE FUNCTION generate_crop_growth_report(
  p_field_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  crop_object_id UUID,
  object_code TEXT,
  crop_type TEXT,
  growth_stage TEXT,
  health_status TEXT,
  avg_height_cm REAL,
  avg_lai REAL,
  avg_ndvi REAL,
  observation_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    co.id AS crop_object_id,
    co.object_code,
    co.crop_type,
    co.growth_stage,
    co.health_status,
    AVG(obs.height_cm) AS avg_height_cm,
    AVG(obs.lai) AS avg_lai,
    AVG(obs.ndvi) AS avg_ndvi,
    COUNT(*) AS observation_count
  FROM crop_object co
  JOIN crop_observation obs ON co.id = obs.crop_object_id
  WHERE 
    co.field_id = p_field_id
    AND co.is_active = TRUE
    AND obs.observation_time >= p_start_date::TIMESTAMPTZ
    AND obs.observation_time <= (p_end_date + 1)::TIMESTAMPTZ - INTERVAL '1 second'
  GROUP BY co.id, co.object_code, co.crop_type, co.growth_stage, co.health_status
  ORDER BY co.crop_type, co.object_code;
END;
$$ LANGUAGE plpgsql;

-- 创建存储过程：创建农事干预记录并更新作物状态
CREATE OR REPLACE FUNCTION create_crop_intervention(
  p_field_id UUID,
  p_crop_object_id UUID,
  p_intervention_type TEXT,
  p_material TEXT,
  p_amount REAL,
  p_unit TEXT,
  p_performed_by UUID,
  p_equipment TEXT,
  p_before_data_id UUID DEFAULT NULL,
  p_after_data_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  intervention_id UUID;
BEGIN
  -- 创建干预记录
  INSERT INTO crop_intervention (
    crop_object_id,
    field_id,
    intervention_type,
    material,
    amount,
    unit,
    performed_by,
    equipment,
    before_data_id,
    after_data_id
  ) VALUES (
    p_crop_object_id,
    p_field_id,
    p_intervention_type,
    p_material,
    p_amount,
    p_unit,
    p_performed_by,
    p_equipment,
    p_before_data_id,
    p_after_data_id
  ) RETURNING id INTO intervention_id;
  
  -- 更新作物对象的注意状态（根据干预类型）
  IF p_intervention_type IN ('fertilization', 'irrigation', 'pesticide') THEN
    UPDATE crop_object
    SET 
      needs_attention = FALSE,
      updated_at = NOW()
    WHERE id = p_crop_object_id;
  END IF;
  
  -- 记录操作日志
  INSERT INTO operation_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    timestamp
  ) VALUES (
    p_performed_by,
    '创建农事干预记录',
    'crop_intervention',
    intervention_id,
    JSON_BUILD_OBJECT(
      'field_id', p_field_id,
      'crop_object_id', p_crop_object_id,
      'intervention_type', p_intervention_type,
      'material', p_material
    ),
    NOW()
  );
  
  RETURN intervention_id;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 函数定义
-- =========================================================

-- 创建函数：计算两个点之间的距离（米）
CREATE OR REPLACE FUNCTION calculate_distance_m(
  point1 GEOMETRY(POINT, 4326),
  point2 GEOMETRY(POINT, 4326)
) RETURNS REAL AS $$
BEGIN
  RETURN ST_Distance(point1::geography, point2::geography);
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取指定农田的最近一次采集会话
CREATE OR REPLACE FUNCTION get_latest_session(
  p_field_id UUID
) RETURNS TABLE (
  session_id UUID,
  device_id UUID,
  device_name TEXT,
  mission_type TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT,
  data_count JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id AS session_id,
    cs.device_id,
    d.name AS device_name,
    cs.mission_type,
    cs.start_time,
    cs.end_time,
    cs.duration_minutes,
    cs.status,
    cs.data_count
  FROM collection_session cs
  JOIN device d ON cs.device_id = d.id
  WHERE cs.field_id = p_field_id
  ORDER BY cs.start_time DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：获取指定农田的健康作物比例
CREATE OR REPLACE FUNCTION get_health_ratio(
  p_field_id UUID
) RETURNS DECIMAL(5, 2) AS $$
DECLARE
  total_objects INTEGER;
  healthy_objects INTEGER;
  health_ratio DECIMAL(5, 2);
BEGIN
  -- 获取总对象数
  SELECT COUNT(*) INTO total_objects
  FROM crop_object
  WHERE field_id = p_field_id AND is_active = TRUE;
  
  -- 获取健康对象数
  SELECT COUNT(*) INTO healthy_objects
  FROM crop_object
  WHERE field_id = p_field_id AND is_active = TRUE AND health_status = 'healthy';
  
  -- 计算健康比例
  IF total_objects > 0 THEN
    health_ratio := (healthy_objects::DECIMAL / total_objects::DECIMAL) * 100;
  ELSE
    health_ratio := 0;
  END IF;
  
  RETURN health_ratio;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 触发器定义
-- =========================================================

-- 创建触发器：在插入作物观测记录时，更新作物对象的最新状态
CREATE OR REPLACE FUNCTION update_crop_object_from_observation()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新作物对象的最新观测时间和状态
  UPDATE crop_object
  SET 
    last_seen_at = NEW.observation_time,
    growth_stage = COALESCE(NEW.growth_stage, growth_stage),
    health_status = COALESCE(NEW.health_status, health_status),
    stress_type = COALESCE(NEW.stress_type, stress_type),
    stress_level = COALESCE(NEW.stress_level, stress_level),
    updated_at = NOW()
  WHERE id = NEW.crop_object_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为作物观测表创建触发器
DROP TRIGGER IF EXISTS trg_update_crop_object_from_observation ON crop_observation;
CREATE TRIGGER trg_update_crop_object_from_observation
AFTER INSERT ON crop_observation
FOR EACH ROW EXECUTE FUNCTION update_crop_object_from_observation();

-- 创建触发器：在插入告警记录时，更新关联作物对象的注意状态
CREATE OR REPLACE FUNCTION update_crop_object_attention_from_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果告警级别为高或紧急，更新关联作物对象的注意状态
  IF NEW.severity IN ('high', 'critical') AND NEW.crop_object_id IS NOT NULL THEN
    UPDATE crop_object
    SET 
      needs_attention = TRUE,
      updated_at = NOW()
    WHERE id = NEW.crop_object_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为告警表创建触发器
DROP TRIGGER IF EXISTS trg_update_crop_object_attention_from_alert ON alert;
CREATE TRIGGER trg_update_crop_object_attention_from_alert
AFTER INSERT ON alert
FOR EACH ROW EXECUTE FUNCTION update_crop_object_attention_from_alert();

-- =========================================================
-- 脚本执行完成
-- =========================================================

-- 输出创建成功的消息
DO $$
BEGIN
  RAISE NOTICE 'Green Tracker 优化版数据库表结构创建完成！';
  RAISE NOTICE '已创建以下表：';
  RAISE NOTICE '  - field (农田基础表)';
  RAISE NOTICE '  - device (设备表)';
  RAISE NOTICE '  - device_status (设备状态历史表)';
  RAISE NOTICE '  - maintenance_log (设备维护日志表)';
  RAISE NOTICE '  - user (用户表)';
  RAISE NOTICE '  - operation_log (操作日志表)';
  RAISE NOTICE '  - collection_session (采集会话表)';
  RAISE NOTICE '  - mission_log (任务执行日志表)';
  RAISE NOTICE '  - raw_data (原始数据表)';
  RAISE NOTICE '  - raw_data_tags (数据标签表)';
  RAISE NOTICE '  - crop_object (作物对象表)';
  RAISE NOTICE '  - crop_observation (作物观测记录表)';
  RAISE NOTICE '  - crop_intervention (农事干预记录表)';
  RAISE NOTICE '  - analytics_result (分析结果表)';
  RAISE NOTICE '  - alert (告警表)';
  RAISE NOTICE '  - feedback (反馈表)';
  RAISE NOTICE '  - 已创建相关索引、触发器、视图和存储过程';
END $$;
