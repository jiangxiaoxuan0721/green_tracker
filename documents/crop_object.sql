-- =========================================================
-- 【DDL-05】作物对象表：crop_object
-- 角色：从“原始感知数据”中抽象出的【具身作物实体】
-- =========================================================


-- =========================
-- 1. 设计定位
-- =========================
-- crop_object 是：
--   空天地一体化农情系统中的「最小智能对象单元」
--
-- 它不是“图片里的像素”，而是：
--   ✔ 一株作物
--   ✔ 一行作物
--   ✔ 一个生长斑块
--
-- 特点：
--   - 可被持续跟踪（跨时间）
--   - 可被多模态感知（图像/光谱/环境）
--   - 可被智能体操作与决策


-- =========================
-- 2. 表结构定义
-- =========================
CREATE TABLE crop_object (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 空间归属
  field_id          UUID NOT NULL
                      REFERENCES field(id)
                      ON DELETE CASCADE,

  -- 作物基础语义
  crop_type         TEXT NOT NULL,      -- 作物种类：wheat / corn / rice
  object_level      TEXT NOT NULL,      -- plant / row / patch
  object_code       TEXT,               -- 业务可读编号（如 P-001-023）

  -- 空间形态（核心）
  geometry          GEOMETRY(GEOMETRY, 4326),

  -- 生长状态
  growth_stage      TEXT,               -- 出苗/拔节/抽穗/成熟
  health_status     TEXT,               -- healthy / stress / disease / unknown

  -- 来源数据
  source_raw_data_id UUID
                      REFERENCES raw_data(id)
                      ON DELETE SET NULL,

  -- 生命周期
  first_seen_at     TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ NOT NULL,

  -- 智能属性扩展
  attributes        JSONB,              -- 高度/叶面积指数/颜色指数等

  -- 管理字段
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- 3. 约束与一致性
-- =========================

-- 同一地块下，对象编号唯一
CREATE UNIQUE INDEX uniq_crop_object_code
ON crop_object (field_id, object_code)
WHERE object_code IS NOT NULL;


-- =========================
-- 4. 索引设计
-- =========================

-- 4.1 按地块
CREATE INDEX idx_crop_object_field
ON crop_object (field_id);

-- 4.2 按作物类型
CREATE INDEX idx_crop_object_type
ON crop_object (crop_type);

-- 4.3 按生长阶段
CREATE INDEX idx_crop_object_stage
ON crop_object (growth_stage);

-- 4.4 空间索引（关键）
CREATE INDEX idx_crop_object_geometry
ON crop_object
USING GIST (geometry);

-- 4.5 生命周期查询
CREATE INDEX idx_crop_object_seen
ON crop_object (first_seen_at, last_seen_at);


-- =========================
-- 5. 字段语义说明
-- =========================
-- field_id        ：所属农田
-- crop_type       ：作物种类
-- object_level    ：对象层级（plant/row/patch）
-- object_code     ：业务编号（便于人工巡检）
-- geometry        ：对象空间形态（点/线/面）
-- growth_stage    ：生育期
-- health_status   ：健康状态
-- source_raw_data_id ：首次识别来源的原始数据
-- first_seen_at   ：首次观测时间
-- last_seen_at    ：最近一次观测时间
-- attributes      ：连续数值/指数/模型输出
-- is_active       ：是否仍存在于农田中


-- =========================
-- 6. 示例插入数据
-- =========================

INSERT INTO crop_object (
  field_id,
  crop_type,
  object_level,
  object_code,
  geometry,
  growth_stage,
  health_status,
  source_raw_data_id,
  first_seen_at,
  last_seen_at,
  attributes
) VALUES (
  '11111111-1111-1111-1111-111111111111',  -- field_id
  'wheat',
  'plant',
  'W-P-0001',
  ST_SetSRID(ST_MakePoint(116.1503, 39.9502), 4326),
  'tillering',
  'healthy',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2025-03-20 10:12:00+08',
  '2025-04-02 09:45:00+08',
  '{"height_cm": 32.5, "lai": 2.1, "ndvi": 0.74}'
);


-- =========================
-- 7. 典型查询示例
-- =========================

-- 7.1 查询某块地的所有作物对象
SELECT *
FROM crop_object
WHERE field_id = '11111111-1111-1111-1111-111111111111';

-- 7.2 查询出现胁迫的作物
SELECT *
FROM crop_object
WHERE health_status IN ('stress', 'disease');

-- 7.3 空间范围内的作物对象
SELECT *
FROM crop_object
WHERE ST_Intersects(
  geometry,
  ST_MakeEnvelope(116.14, 39.94, 116.16, 39.96, 4326)
);


-- =========================================================
-- crop_object 表作用总结
-- =========================================================
-- 1. 把“感知数据”升维为“可操作对象”
-- 2. 支撑跨时间跟踪（生长轨迹）
-- 3. 连接 AI 识别结果与农艺知识
-- 4. 作为具身智能决策的最小实体
-- =========================================================
