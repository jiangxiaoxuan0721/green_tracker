-- =========================================================
-- 【DDL-01】农田 / 地块基础表：field（简化版）
-- 只包含核心字段，与 SQLAlchemy 模型一致
-- =========================================================

-- =========================
-- 1. 前置条件：启用 PostGIS
-- =========================
CREATE EXTENSION IF NOT EXISTS postgis;

-- =========================
-- 2. 删除旧表（如果存在）
-- =========================
DROP TABLE IF EXISTS field CASCADE;

-- =========================
-- 3. 创建简化版表结构
-- =========================
CREATE TABLE field (
  -- 主键
  id                UUID PRIMARY KEY,

  -- 基本信息
  name              TEXT NOT NULL,           -- 地块名称
  description       TEXT,                    -- 备注说明

  -- 空间信息（核心字段）
  location_geom     GEOMETRY(POLYGON,4326) NOT NULL,  -- 农田边界
  area_m2           DOUBLE PRECISION,        -- 农田面积（平方米）

  -- 农业属性
  crop_type         TEXT,                    -- 当前作物类型
  soil_type         TEXT,                    -- 土壤类型
  irrigation_type   TEXT,                    -- 灌溉方式

  -- 管理属性
  owner_id          UUID,                    -- 地块负责人

  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 4. 索引设计
-- =========================

-- 4.1 空间索引（必须）
CREATE INDEX idx_field_location_geom
ON field
USING GIST (location_geom);

-- 4.2 作物类型索引
CREATE INDEX idx_field_crop_type
ON field (crop_type);

-- 4.3 所有者ID索引
CREATE INDEX idx_field_owner_id
ON field (owner_id);

-- =========================
-- 5. 字段语义说明
-- =========================
-- id              ：地块唯一标识（UUID）
-- name            ：地块名称（必填）
-- description     ：地块说明信息
-- location_geom   ：农田边界，多边形（WGS84 坐标系）
-- area_m2         ：农田面积，单位平方米
-- crop_type       ：当前种植作物
-- soil_type       ：土壤类型
-- irrigation_type ：灌溉方式（滴灌、喷灌、漫灌等）
-- owner_id        ：地块负责人ID（UUID）
-- created_at      ：创建时间（带时区的时间戳）
-- updated_at      ：更新时间（带时区的时间戳）

-- =========================
-- 6. 示例插入数据
-- =========================
INSERT INTO field (
  id,
  name,
  description,
  location_geom,
  area_m2,
  crop_type,
  soil_type,
  irrigation_type,
  owner_id
) VALUES (
  gen_random_uuid(),
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
  1000000.0,
  '小麦',
  '壤土',
  '滴灌',
  '123e4567-e89b-12d3-a456-426614174000'::uuid
);

-- =========================
-- 7. 典型查询示例
-- =========================

-- 7.1 查询某个点位属于哪块农田
SELECT id, name, crop_type
FROM field
WHERE ST_Contains(
  location_geom,
  ST_SetSRID(ST_MakePoint(116.15, 39.95), 4326)
);

-- 7.2 按作物类型查询地块
SELECT id, name, crop_type, area_m2
FROM field
WHERE crop_type = '小麦';

-- 7.3 按所有者查询地块
SELECT id, name, crop_type, soil_type
FROM field
WHERE owner_id = '123e4567-e89b-12d3-a456-426614174000'::uuid;

-- 7.4 按面积范围查询地块
SELECT id, name, area_m2, crop_type
FROM field
WHERE area_m2 BETWEEN 500000 AND 2000000
ORDER BY area_m2 DESC;

-- =========================
-- 8. 表使用注意事项
-- =========================

-- 8.1 位置数据存储
-- 使用 WGS84 (EPSG:4326) 坐标系存储几何数据
-- 支持直接存储 Well-Known Text (WKT) 格式或使用 PostGIS 函数转换

-- 8.2 面积计算
-- 面积应使用 ST_Area(location_geom::geography) 计算
-- 计算结果单位为平方米，可根据需要转换为其他单位（公顷、亩等）

-- 8.3 性能优化
-- 确保创建了空间索引 (GIST) 以支持高效的空间查询
-- 根据查询模式考虑创建适当的属性索引

-- =========================================================
-- 表 field 作用总结
-- =========================================================
-- 1. 作为所有农情数据的空间锚点
-- 2. 支持空-天-地多源数据空间对齐
-- 3. 为具身智能感知与决策提供基础空间实体
-- 4. 可长期稳定存在，不随采集任务变化
-- 5. 支持多用户、多组织的权限管理场景
-- 6. 提供完整的农业属性信息，支持精细化农田管理
-- =========================================================
