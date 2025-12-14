-- =========================================================
-- 【DDL-03】采集任务 / 观测会话表：collection_session
-- 角色：空-天-地-具身多源数据的"时间 + 行为 + 组织枢纽"
-- =========================================================


-- =========================
-- 1. 设计目标
-- =========================
-- collection_session 用来回答 5 个核心问题：
-- 1）在哪块地（field）
-- 2）由哪个平台（device）
-- 3）在什么时间
-- 4）以什么方式（任务类型）
-- 5）采集了"一整批"什么数据
--
-- 所有原始数据（图像/视频/环境数据）
-- 都必须隶属于某一个 session


-- =========================
-- 2. 表结构定义
-- =========================
CREATE TABLE collection_session (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联实体
  field_id          UUID NOT NULL REFERENCES field(id)
                      ON DELETE CASCADE,

  -- 时间信息（核心）
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,

  -- 任务语义
  mission_type      TEXT NOT NULL,     -- 巡检 / 定点 / 路径 / 应急
  mission_name      TEXT,              -- 任务名称（可读）
  description       TEXT,

  -- 任务环境快照（可选）
  weather_snapshot  JSONB,             -- 温度/湿度/风速/天气

  -- 状态字段
  status            TEXT DEFAULT 'completed',  -- planned / running / completed / failed

  -- 时间戳
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- 3. 索引设计
-- =========================

-- 3.1 按地块查询任务
CREATE INDEX idx_session_field_id
ON collection_session (field_id);

-- 3.2 按时间范围查询
CREATE INDEX idx_session_time_range
ON collection_session (start_time, end_time);

-- 3.3 按任务类型查询
CREATE INDEX idx_session_mission_type
ON collection_session (mission_type);


-- =========================
-- 4. 字段语义说明
-- =========================
-- id               ：采集任务唯一标识
-- field_id         ：任务所属农田
-- start_time       ：任务开始时间
-- end_time         ：任务结束时间
-- mission_type     ：任务类型（巡检 / 定点 / 路径 / 应急）
-- mission_name     ：任务名称（便于人理解）
-- description      ：任务说明
-- weather_snapshot ：采集时的环境快照（JSON）
-- status           ：任务状态
-- created_at       ：创建时间
-- updated_at       ：更新时间


-- =========================
-- 5. 示例插入数据
-- =========================

INSERT INTO collection_session (
  field_id,
  start_time,
  end_time,
  mission_type,
  mission_name,
  description,
  weather_snapshot
) VALUES (
  '11111111-1111-1111-1111-111111111111',  -- 示例 field_id
  '2025-06-01 09:00:00+08',
  '2025-06-01 09:45:00+08',
  '巡检',
  '春季长势巡检',
  '无人机对农田进行全覆盖巡检',
  '{"temperature": 22.5, "humidity": 0.58, "wind_speed": 2.1}'
);


-- =========================
-- 6. 典型查询示例
-- =========================

-- 查询某块地最近一次巡检任务
SELECT *
FROM collection_session
WHERE field_id = '11111111-1111-1111-1111-111111111111'
ORDER BY start_time DESC
LIMIT 1;

-- 查询某块地在一段时间内执行的任务
SELECT *
FROM collection_session
WHERE field_id = '11111111-1111-1111-1111-111111111111'
  AND start_time >= '2025-06-01'
  AND start_time <  '2025-06-02';


-- =========================================================
-- collection_session 表作用总结
-- =========================================================
-- 1. 作为所有原始数据的逻辑父节点
-- 2. 统一组织"时序 + 空间 + 行为"
-- 3. 支撑空-天-地协同调度
-- 4. 支持按任务维度回溯农情数据
-- =========================================================
