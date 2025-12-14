-- =========================================================
-- 【DDL-01】农田 / 地块基础表：field
-- 角色：空-天-地一体化农情监测系统的“空间原点”
-- =========================================================


-- =========================
-- 1. 前置条件：启用 PostGIS
-- =========================
CREATE EXTENSION IF NOT EXISTS postgis;


-- =========================
-- 2. 表结构定义
-- =========================
CREATE TABLE field (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本信息
  name              TEXT NOT NULL,           -- 地块名称
  description       TEXT,                    -- 备注说明

  -- 空间信息（核心字段）
  location_geom     GEOMETRY(POLYGON, 4326) NOT NULL,  -- 农田边界
  area_m2           DOUBLE PRECISION,        -- 农田面积（平方米）

  -- 农业属性
  crop_type         TEXT,                    -- 当前作物类型
  soil_type         TEXT,                    -- 土壤类型
  irrigation_type   TEXT,                    -- 灌溉方式

  -- 管理属性（为多用户/多组织扩展预留）
  owner_id          UUID,                    -- 地块负责人
  organization_id   UUID,                    -- 所属组织

  -- 状态字段
  is_active         BOOLEAN DEFAULT TRUE,    -- 是否有效

  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- 3. 索引设计
-- =========================

-- 3.1 空间索引（必须）
CREATE INDEX idx_field_location_geom
ON field
USING GIST (location_geom);

-- 3.2 作物类型索引（可选）
CREATE INDEX idx_field_crop_type
ON field (crop_type);


-- =========================
-- 4. 字段语义说明
-- =========================
-- id              ：地块唯一标识
-- name            ：地块名称
-- description     ：地块说明信息
-- location_geom   ：农田边界，多边形（WGS84 坐标系）
-- area_m2         ：农田面积，单位平方米（可由 ST_Area 计算）
-- crop_type       ：当前种植作物
-- soil_type       ：土壤类型
-- irrigation_type ：灌溉方式
-- owner_id        ：地块负责人（预留）
-- organization_id ：所属组织（预留）
-- is_active       ：是否有效
-- created_at      ：创建时间
-- updated_at      ：更新时间


-- =========================
-- 5. 示例插入数据
-- =========================
INSERT INTO field (
  name,
  description,
  location_geom,
  crop_type,
  soil_type
) VALUES (
  '示例农田 A',
  '用于系统测试的示例地块',
  ST_GeomFromText(
    'POLYGON((
      116.10 39.90,
      116.20 39.90,
      116.20 40.00,
      116.10 40.00,
      116.10 39.90
    ))',
    4326
  ),
  '小麦',
  '壤土'
);


-- =========================
-- 6. 面积计算示例（可选）
-- =========================
UPDATE field
SET area_m2 = ST_Area(location_geom::geography)
WHERE area_m2 IS NULL;


-- =========================
-- 7. 典型查询示例
-- =========================

-- 查询某个点位属于哪块农田
SELECT id, name
FROM field
WHERE ST_Contains(
  location_geom,
  ST_SetSRID(ST_MakePoint(116.15, 39.95), 4326)
);


-- =========================================================
-- 表 field 作用总结
-- =========================================================
-- 1. 作为所有农情数据的空间锚点
-- 2. 支持空-天-地多源数据空间对齐
-- 3. 为具身智能感知与决策提供基础空间实体
-- 4. 可长期稳定存在，不随采集任务变化
-- =========================================================
