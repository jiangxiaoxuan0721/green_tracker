-- =========================================================
-- 【DDL-02】平台 / 设备表：device
-- 角色：空-天-地一体化农情监测系统的“感知与行动主体”
-- =========================================================


-- =========================
-- 1. 设计目标
-- =========================
-- 统一抽象所有平台与设备：
--   天：卫星
--   空：无人机（UAV）
--   地：地面机器人 / 固定传感器
--   具身：执行作业与主动感知的智能体
--
-- 原则：
--   先统一，再细分
--   平台 = 设备 + 感知能力 + 行动能力


-- =========================
-- 2. 表结构定义
-- =========================
CREATE TABLE device (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 平台抽象
  device_type       TEXT NOT NULL,     -- satellite / uav / ugv / robot / sensor
  platform_level    TEXT NOT NULL,     -- 天 / 空 / 地 / 具身
  model             TEXT,              -- 设备型号
  manufacturer      TEXT,              -- 厂商

  -- 能力描述
  sensors           JSONB,             -- 传感器配置（RGB/多光谱/LiDAR）
  actuators         JSONB,             -- 执行机构（轮式/履带/机械臂）
  description       TEXT,

  -- 管理属性
  owner_id          UUID,               -- 设备所有者/负责人

  -- 运行状态
  is_active         BOOLEAN DEFAULT TRUE,

  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- 3. 索引设计
-- =========================

-- 平台类型索引
CREATE INDEX idx_device_type
ON device (device_type);

-- 平台层级索引
CREATE INDEX idx_device_platform_level
ON device (platform_level);

-- 所有者ID索引
CREATE INDEX idx_device_owner_id
ON device (owner_id);


-- =========================
-- 4. 字段语义说明
-- =========================
-- id              ：设备唯一标识（UUID）
-- device_type     ：设备类型（satellite/uav/ugv/robot/sensor）
-- platform_level  ：所属平台层级（天/空/地/具身）
-- model           ：设备型号
-- manufacturer    ：设备厂商
-- sensors         ：传感器配置（JSON，支持扩展）
-- actuators       ：执行机构配置（JSON，支持具身智能）
-- description     ：设备说明
-- owner_id        ：设备所有者/负责人ID（UUID）
-- is_active       ：是否在用（布尔值，默认true）
-- created_at      ：创建时间（带时区的时间戳）
-- updated_at      ：更新时间（带时区的时间戳）


-- =========================
-- 5. 示例插入数据
-- =========================

-- 示例 1：无人机平台
INSERT INTO device (
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  description,
  owner_id
) VALUES (
  'uav',
  '空',
  'DJI M300',
  'DJI',
  '{"RGB": true, "multispectral": true, "thermal": false}',
  '{"flight": true}',
  '多光谱农业巡检无人机',
  '123e4567-e89b-12d3-a456-426614174000'::uuid
);

-- 示例 2：地面具身机器人
INSERT INTO device (
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  description,
  owner_id
) VALUES (
  'robot',
  '具身',
  'AgriBot-X',
  'AgriTech',
  '{"RGB": true, "depth": true, "soil_moisture": true}',
  '{"wheels": true, "arm": true}',
  '具身智能农田巡检与作业机器人',
  '123e4567-e89b-12d3-a456-426614174001'::uuid
);

-- 示例 3：卫星平台
INSERT INTO device (
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  description,
  owner_id
) VALUES (
  'satellite',
  '天',
  'GF-2',
  '中国航天',
  '{"RGB": true, "multispectral": true, "nir": true}',
  '{}',
  '高分二号农业遥感卫星',
  '123e4567-e89b-12d3-a456-426614174002'::uuid
);

-- 示例 4：地面传感器节点
INSERT INTO device (
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  description,
  owner_id
) VALUES (
  'sensor',
  '地',
  'SoilSense-Pro',
  'EnviroTech',
  '{"soil_moisture": true, "soil_temp": true, "air_temp": true, "humidity": true}',
  '{}',
  '农田环境监测传感器节点',
  '123e4567-e89b-12d3-a456-426614174000'::uuid
);


-- =========================
-- 6. 典型查询示例
-- =========================

-- 6.1 按所有者查询设备
SELECT id, device_type, platform_level, model
FROM device
WHERE owner_id = '123e4567-e89b-12d3-a456-426614174000'::uuid;

-- 6.2 按平台层级查询设备
SELECT id, device_type, model, description
FROM device
WHERE platform_level = '空' AND is_active = TRUE;

-- 6.3 查询具备特定传感器的设备
SELECT id, device_type, model, sensors
FROM device
WHERE sensors @> '{"RGB": true}'::jsonb;

-- 6.4 统计不同平台层级的设备数量
SELECT 
  platform_level,
  COUNT(*) AS device_count
FROM device
WHERE is_active = TRUE
GROUP BY platform_level
ORDER BY device_count DESC;

-- 6.5 查询具备特定执行能力的设备
SELECT id, device_type, model, actuators
FROM device
WHERE actuators @> '{"arm": true}'::jsonb;


-- =========================
-- 7. 表使用注意事项
-- =========================

-- 7.1 传感器和执行机构配置
-- 使用 JSONB 存储配置信息，支持灵活扩展
-- 使用 @> 操作符进行 JSONB 包含查询

-- 7.2 数据完整性
-- is_active 字段用于软删除，而不是物理删除
-- 建议保留历史设备信息，仅标记为非活跃状态

-- 7.3 关联查询
-- 可与用户表、地块表等进行关联查询
-- 支持按所有者、设备类型等多维度筛选


-- =========================================================
-- device 表作用总结
-- =========================================================
-- 1. 统一抽象空-天-地-具身所有平台
-- 2. 描述感知与执行能力
-- 3. 作为采集任务与原始数据的主体
-- 4. 为后续多平台协同与调度提供基础
-- 5. 支持多用户设备管理，实现设备所有权和访问控制
-- 6. 提供完整的设备能力描述，支持按能力匹配和筛选
-- =========================================================
