-- =========================================================
-- 【DDL-04】原始数据索引表：raw_data
-- 角色：PostgreSQL ↔ MinIO 的“桥梁表”
-- =========================================================


-- =========================
-- 1. 设计目标
-- =========================
-- raw_data 表只做一件事：
--   用“结构化 + 可查询”的方式，
--   索引 MinIO 中的原始感知数据（图像/视频/环境/点云）
--
-- 原则：
--   ❌ 不存二进制
--   ✅ 只存路径、语义、时空、传感器元数据
--
-- 这张表是：
--   AI 分析、回溯、重算、一切智能能力的起点


-- =========================
-- 2. 表结构定义
-- =========================
CREATE TABLE raw_data (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 逻辑归属
  session_id        UUID NOT NULL
                      REFERENCES collection_session(id)
                      ON DELETE CASCADE,

  -- 数据类型与来源
  data_type         TEXT NOT NULL,   -- image / video / env / lidar / hyperspectral
  device_id         UUID
                      REFERENCES device(id)
                      ON DELETE SET NULL,

  -- 对象存储索引（核心）
  bucket_name       TEXT NOT NULL,   -- MinIO bucket
  object_key        TEXT NOT NULL,   -- MinIO 对象路径

  -- 采集时空信息
  capture_time      TIMESTAMPTZ NOT NULL,
  location_geom     GEOMETRY(POINT, 4326),

  -- 传感器与数据元信息
  sensor_meta       JSONB,            -- 相机参数 / 光谱段 / 高度 / 姿态
  file_meta         JSONB,            -- 文件大小 / 分辨率 / 编码

  -- 校验与状态
  checksum          TEXT,             -- 文件校验（MD5/SHA256）
  is_valid          BOOLEAN DEFAULT TRUE,

  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- 3. 约束设计
-- =========================

-- 防止同一 session 下重复索引同一对象
CREATE UNIQUE INDEX uniq_raw_data_object
ON raw_data (session_id, bucket_name, object_key);


-- =========================
-- 4. 索引设计
-- =========================

-- 4.1 按会话查询
CREATE INDEX idx_raw_data_session
ON raw_data (session_id);

-- 4.2 按数据类型查询
CREATE INDEX idx_raw_data_type
ON raw_data (data_type);

-- 4.3 按时间查询
CREATE INDEX idx_raw_data_capture_time
ON raw_data (capture_time);

-- 4.4 空间索引（极其关键）
CREATE INDEX idx_raw_data_location_geom
ON raw_data
USING GIST (location_geom);


-- =========================
-- 5. 字段语义说明
-- =========================
-- id            ：原始数据唯一标识
-- session_id    ：所属采集任务
-- data_type     ：数据类型（图像/视频/环境/点云等）
-- device_id     ：数据来源设备
-- bucket_name   ：MinIO bucket 名称
-- object_key    ：MinIO 中的对象路径
-- capture_time  ：数据采集时间
-- location_geom ：采集位置（POINT）
-- sensor_meta   ：传感器元信息（JSON，可扩展）
-- file_meta     ：文件元数据（大小/分辨率等）
-- checksum      ：文件校验值
-- is_valid      ：数据是否有效
-- created_at    ：入库时间


-- =========================
-- 6. 示例插入数据
-- =========================

INSERT INTO raw_data (
  session_id,
  data_type,
  device_id,
  bucket_name,
  object_key,
  capture_time,
  location_geom,
  sensor_meta,
  file_meta,
  checksum
) VALUES (
  '33333333-3333-3333-3333-333333333333',  -- 示例 session_id
  'image',
  '22222222-2222-2222-2222-222222222222',  -- 示例 device_id
  'green-tracker',
  'field_001/2025-06-01/uav/img_000123.jpg',
  '2025-06-01 09:12:34+08',
  ST_SetSRID(ST_MakePoint(116.15, 39.95), 4326),
  '{"camera": "RGB", "altitude_m": 120, "fov": 84}',
  '{"width": 4000, "height": 3000, "format": "jpg"}',
  '9f86d081884c7d659a2feaa0c55ad015'
);


-- =========================
-- 7. 典型查询示例
-- =========================

-- 7.1 查询某次任务下的所有图像
SELECT *
FROM raw_data
WHERE session_id = '33333333-3333-3333-3333-333333333333'
  AND data_type = 'image';

-- 7.2 判断原始数据属于哪块农田（空间关联）
SELECT r.id AS raw_data_id, f.id AS field_id
FROM raw_data r
JOIN field f
ON ST_Contains(f.location_geom, r.location_geom);

-- 7.3 按时间 + 空间检索数据
SELECT *
FROM raw_data
WHERE capture_time BETWEEN '2025-06-01 09:00' AND '2025-06-01 10:00'
  AND ST_DWithin(
    location_geom::geography,
    ST_SetSRID(ST_MakePoint(116.15, 39.95), 4326)::geography,
    50
  );


-- =========================================================
-- raw_data 表作用总结
-- =========================================================
-- 1. PostgreSQL 与 MinIO 的唯一绑定点
-- 2. 原始感知数据的“事实索引表”
-- 3. 所有 AI 分析与重算的起点
-- 4. 支撑时空检索与多源数据融合
-- =========================================================
