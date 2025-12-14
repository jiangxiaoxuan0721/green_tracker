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


-- =========================
-- 4. 字段语义说明
-- =========================
-- id              ：设备唯一标识
-- device_type     ：设备类型（卫星/无人机/地面机器人/传感器）
-- platform_level  ：所属平台层级（天/空/地/具身）
-- model           ：设备型号
-- manufacturer    ：设备厂商
-- sensors         ：传感器配置（JSON，支持扩展）
-- actuators       ：执行机构配置（JSON，支持具身智能）
-- description     ：设备说明
-- is_active       ：是否在用
-- created_at      ：创建时间
-- updated_at      ：更新时间


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
  description
) VALUES (
  'uav',
  '空',
  'DJI M300',
  'DJI',
  '{"RGB": true, "multispectral": true, "thermal": false}',
  '{"flight": true}',
  '多光谱农业巡检无人机'
);

-- 示例 2：地面具身机器人
INSERT INTO device (
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  description
) VALUES (
  'robot',
  '具身',
  'AgriBot-X',
  'AgriTech',
  '{"RGB": true, "depth": true, "soil_moisture": true}',
  '{"wheels": true, "arm": true}',
  '具身智能农田巡检与作业机器人'
);


-- =========================================================
-- device 表作用总结
-- =========================================================
-- 1. 统一抽象空-天-地-具身所有平台
-- 2. 描述感知与执行能力
-- 3. 作为采集任务与原始数据的主体
-- 4. 为后续多平台协同与调度提供基础
-- =========================================================
