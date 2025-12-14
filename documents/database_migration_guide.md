# Green Tracker 数据库迁移与初始化指南

## 概述

本文档提供了Green Tracker系统数据库的迁移和初始化指南，包括从现有数据库结构迁移到优化版结构的步骤，以及全新安装数据库的方法。

## 数据库迁移方案

### 1. 备份现有数据库

在执行任何迁移操作之前，务必备份现有数据库：

```bash
# 创建完整数据库备份
pg_dump -h localhost -U postgres -d green_tracker -f green_tracker_backup_$(date +%Y%m%d_%H%M%S).sql

# 创建纯数据备份（不含结构）
pg_dump -h localhost -U postgres -d green_tracker --data-only -f green_tracker_data_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 迁移脚本执行顺序

1. 执行优化版表结构创建脚本：`create_optimized_tables.sql`
2. 执行数据迁移脚本：`migrate_existing_data.sql`
3. 验证迁移结果：`validate_migration.sql`

### 3. 数据迁移脚本

```sql
-- migrate_existing_data.sql
-- 从现有表结构迁移数据到优化版表结构

-- =========================================================
-- 1. 迁移农田数据 (field)
-- =========================================================

-- 创建临时映射表记录新旧ID对应关系
CREATE TEMPORARY TABLE field_id_mapping (
  old_id UUID,
  new_id UUID
);

-- 迁移农田基础数据
INSERT INTO field (
  id,
  name,
  description,
  code,
  location_geom,
  crop_type,
  soil_type,
  irrigation_type,
  is_active,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  name,
  description,
  COALESCE(code, 'FIELD-' || substr(md5(id::text), 1, 8)) AS code,
  location_geom,
  crop_type,
  soil_type,
  irrigation_type,
  is_active,
  created_at,
  updated_at
FROM field_old;

-- 记录ID映射关系
INSERT INTO field_id_mapping
SELECT old.id AS old_id, f.id AS new_id
FROM field_old old
JOIN field f ON old.name = f.name AND old.created_at = f.created_at;

-- =========================================================
-- 2. 迁移设备数据 (device)
-- =========================================================

-- 创建设备ID映射表
CREATE TEMPORARY TABLE device_id_mapping (
  old_id UUID,
  new_id UUID
);

-- 迁移设备基础数据
INSERT INTO device (
  id,
  name,
  code,
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  is_active,
  status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  name,
  COALESCE(code, 'DEV-' || substr(md5(id::text), 1, 8)) AS code,
  device_type,
  platform_level,
  model,
  manufacturer,
  sensors,
  actuators,
  is_active,
  'idle' AS status, -- 默认状态
  created_at,
  updated_at
FROM device_old;

-- 记录设备ID映射关系
INSERT INTO device_id_mapping
SELECT old.id AS old_id, d.id AS new_id
FROM device_old old
JOIN device d ON old.name = d.name AND old.created_at = d.created_at;

-- =========================================================
-- 3. 迁移用户数据 (user)
-- =========================================================

-- 创建用户ID映射表
CREATE TEMPORARY TABLE user_id_mapping (
  old_id UUID,
  new_id UUID
);

-- 迁移用户基础数据
INSERT INTO "user" (
  id,
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  is_active,
  last_login_at,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  username,
  email,
  password_hash,
  first_name,
  last_name,
  COALESCE(role, 'viewer') AS role, -- 默认角色
  is_active,
  last_login_at,
  created_at,
  updated_at
FROM user_old;

-- 记录用户ID映射关系
INSERT INTO user_id_mapping
SELECT old.id AS old_id, u.id AS new_id
FROM user_old old
JOIN "user" u ON old.username = u.username AND old.email = u.email;

-- =========================================================
-- 4. 迁移采集会话数据 (collection_session)
-- =========================================================

-- 创建会话ID映射表
CREATE TEMPORARY TABLE session_id_mapping (
  old_id UUID,
  new_id UUID
);

-- 迁移采集会话数据
INSERT INTO collection_session (
  id,
  field_id,
  device_id,
  start_time,
  end_time,
  mission_type,
  mission_name,
  description,
  weather_snapshot,
  status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  fm.new_id AS field_id,
  dm.new_id AS device_id,
  start_time,
  end_time,
  mission_type,
  mission_name,
  description,
  weather_snapshot,
  status,
  created_at,
  updated_at
FROM collection_session_old old
JOIN field_id_mapping fm ON old.field_id = fm.old_id
JOIN device_id_mapping dm ON old.device_id = dm.old_id;

-- 记录会话ID映射关系
INSERT INTO session_id_mapping
SELECT old.id AS old_id, cs.id AS new_id
FROM collection_session_old old
JOIN collection_session cs ON old.start_time = cs.start_time AND old.field_id IN (SELECT old_id FROM field_id_mapping);

-- =========================================================
-- 5. 迁移原始数据 (raw_data)
-- =========================================================

-- 创建原始数据ID映射表
CREATE TEMPORARY TABLE raw_data_id_mapping (
  old_id UUID,
  new_id UUID
);

-- 迁移原始数据
INSERT INTO raw_data (
  id,
  session_id,
  data_type,
  data_subtype,
  device_id,
  bucket_name,
  object_key,
  capture_time,
  location_geom,
  altitude_m,
  heading,
  sensor_meta,
  file_meta,
  acquisition_meta,
  checksum,
  is_valid,
  processing_status,
  ai_status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  sm.new_id AS session_id,
  data_type,
  NULL AS data_subtype, -- 新增字段，原表没有
  dm.new_id AS device_id,
  bucket_name,
  object_key,
  capture_time,
  location_geom,
  altitude_m,
  heading,
  sensor_meta,
  file_meta,
  acquisition_meta,
  checksum,
  is_valid,
  CASE 
    WHEN processed THEN 'completed'
    ELSE 'pending'
  END AS processing_status, -- 根据原表字段推断
  'pending' AS ai_status, -- 默认值
  created_at,
  updated_at
FROM raw_data_old old
JOIN session_id_mapping sm ON old.session_id = sm.old_id
LEFT JOIN device_id_mapping dm ON old.device_id = dm.old_id;

-- 记录原始数据ID映射关系
INSERT INTO raw_data_id_mapping
SELECT old.id AS old_id, rd.id AS new_id
FROM raw_data_old old
JOIN raw_data rd ON old.bucket_name = rd.bucket_name AND old.object_key = rd.object_key;

-- =========================================================
-- 6. 迁移作物对象 (crop_object)
-- =========================================================

-- 创建作物对象ID映射表
CREATE TEMPORARY TABLE crop_object_id_mapping (
  old_id UUID,
  new_id UUID
);

-- 迁移作物对象
INSERT INTO crop_object (
  id,
  field_id,
  crop_type,
  crop_variety,
  object_level,
  object_code,
  geometry,
  area_m2,
  growth_stage,
  health_status,
  stress_type,
  stress_level,
  source_raw_data_id,
  first_seen_at,
  last_seen_at,
  attributes,
  measurements,
  is_active,
  needs_attention,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  fm.new_id AS field_id,
  crop_type,
  crop_variety,
  object_level,
  object_code,
  geometry,
  area_m2,
  growth_stage,
  health_status,
  stress_type,
  stress_level,
  rdm.new_id AS source_raw_data_id,
  first_seen_at,
  last_seen_at,
  attributes,
  measurements,
  is_active,
  CASE 
    WHEN health_status IN ('stress', 'disease') THEN TRUE
    ELSE FALSE
  END AS needs_attention, -- 根据健康状态推断
  created_at,
  updated_at
FROM crop_object_old old
JOIN field_id_mapping fm ON old.field_id = fm.old_id
LEFT JOIN raw_data_id_mapping rdm ON old.source_raw_data_id = rdm.old_id;

-- 记录作物对象ID映射关系
INSERT INTO crop_object_id_mapping
SELECT old.id AS old_id, co.id AS new_id
FROM crop_object_old old
JOIN crop_object co ON old.object_code = co.object_code AND old.field_id IN (SELECT old_id FROM field_id_mapping);

-- =========================================================
-- 7. 迁移作物观测记录 (crop_observation)
-- =========================================================

-- 如果原表没有作物观测记录表，可以从作物对象的历史记录中提取
-- 这里假设没有这个表，所以跳过

-- =========================================================
-- 8. 迁移反馈数据 (feedback)
-- =========================================================

-- 迁移反馈数据
INSERT INTO feedback (
  id,
  user_id,
  name,
  email,
  subject,
  content,
  category,
  priority,
  feedback_type,
  status,
  assigned_to,
  response_text,
  internal_notes,
  resolved_at,
  resolution_method,
  satisfaction_rating,
  satisfaction_notes,
  ip_address,
  user_agent,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() AS id,
  um.new_id AS user_id,
  name,
  email,
  subject,
  content,
  category,
  priority,
  'general' AS feedback_type, -- 默认值
  status,
  assigned_to,
  response_text,
  notes AS internal_notes,
  resolved_at,
  NULL AS resolution_method, -- 新增字段，原表没有
  satisfaction_rating,
  satisfaction_notes,
  ip_address,
  user_agent,
  created_at,
  updated_at
FROM feedback_old old
LEFT JOIN user_id_mapping um ON old.user_id = um.old_id;

-- =========================================================
-- 9. 迁移完成，清理临时表
-- =========================================================

DROP TABLE IF EXISTS field_id_mapping;
DROP TABLE IF EXISTS device_id_mapping;
DROP TABLE IF EXISTS user_id_mapping;
DROP TABLE IF EXISTS session_id_mapping;
DROP TABLE IF EXISTS raw_data_id_mapping;
DROP TABLE IF EXISTS crop_object_id_mapping;

-- 输出迁移完成消息
DO $$
BEGIN
  RAISE NOTICE '数据迁移完成！';
  RAISE NOTICE '已迁移以下表的数据：';
  RAISE NOTICE '  - field (农田基础表)';
  RAISE NOTICE '  - device (设备表)';
  RAISE NOTICE '  - user (用户表)';
  RAISE NOTICE '  - collection_session (采集会话表)';
  RAISE NOTICE '  - raw_data (原始数据表)';
  RAISE NOTICE '  - crop_object (作物对象表)';
  RAISE NOTICE '  - feedback (反馈表)';
END $$;
```

### 4. 迁移验证脚本

```sql
-- validate_migration.sql
-- 验证数据迁移结果的脚本

-- 创建迁移验证报告
DO $$
DECLARE
  report_content TEXT;
BEGIN
  -- 初始化报告内容
  report_content := 'Green Tracker 数据库迁移验证报告' || CHR(10) || '生成时间: ' || NOW() || CHR(10) || CHR(10);
  
  -- 验证农田数据
  report_content := report_content || '1. 农田数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM field_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM field) || CHR(10);
  
  -- 验证设备数据
  report_content := report_content || '2. 设备数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM device_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM device) || CHR(10);
  
  -- 验证用户数据
  report_content := report_content || '3. 用户数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM user_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM "user") || CHR(10);
  
  -- 验证采集会话数据
  report_content := report_content || '4. 采集会话数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM collection_session_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM collection_session) || CHR(10);
  
  -- 验证原始数据
  report_content := report_content || '5. 原始数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM raw_data_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM raw_data) || CHR(10);
  
  -- 验证作物对象
  report_content := report_content || '6. 作物对象数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM crop_object_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM crop_object) || CHR(10);
  
  -- 验证反馈数据
  report_content := report_content || '7. 反馈数据验证:' || CHR(10);
  report_content := report_content || '   - 旧表记录数: ' || (SELECT COUNT(*) FROM feedback_old) || CHR(10);
  report_content := report_content || '   - 新表记录数: ' || (SELECT COUNT(*) FROM feedback) || CHR(10);
  
  -- 验证外键关系
  report_content := report_content || '8. 外键关系验证:' || CHR(10);
  
  -- 检查采集会话的外键
  report_content := report_content || '   - 采集会话中的无效field_id数量: ' || 
    (SELECT COUNT(*) FROM collection_session WHERE field_id NOT IN (SELECT id FROM field)) || CHR(10);
  report_content := report_content || '   - 采集会话中的无效device_id数量: ' || 
    (SELECT COUNT(*) FROM collection_session WHERE device_id NOT IN (SELECT id FROM device)) || CHR(10);
  
  -- 检查原始数据的外键
  report_content := report_content || '   - 原始数据中的无效session_id数量: ' || 
    (SELECT COUNT(*) FROM raw_data WHERE session_id NOT IN (SELECT id FROM collection_session)) || CHR(10);
  report_content := report_content || '   - 原始数据中的无效device_id数量: ' || 
    (SELECT COUNT(*) FROM raw_data WHERE device_id IS NOT NULL AND device_id NOT IN (SELECT id FROM device)) || CHR(10);
  
  -- 检查作物对象的外键
  report_content := report_content || '   - 作物对象中的无效field_id数量: ' || 
    (SELECT COUNT(*) FROM crop_object WHERE field_id NOT IN (SELECT id FROM field)) || CHR(10);
  report_content := report_content || '   - 作物对象中的无效source_raw_data_id数量: ' || 
    (SELECT COUNT(*) FROM crop_object WHERE source_raw_data_id IS NOT NULL AND source_raw_data_id NOT IN (SELECT id FROM raw_data)) || CHR(10);
  
  -- 输出报告
  RAISE NOTICE '%', report_content;
END $$;
```

## 全新安装指南

### 1. 创建数据库

```bash
# 创建数据库
createdb -h localhost -U postgres green_tracker

# 启用PostGIS扩展（需要超级用户权限）
psql -h localhost -U postgres -d green_tracker -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 2. 执行初始化脚本

```bash
# 执行优化版表结构创建脚本
psql -h localhost -U postgres -d green_tracker -f create_optimized_tables.sql
```

### 3. 加载示例数据（可选）

```bash
# 加载示例数据
psql -h localhost -U postgres -d green_tracker -f sample_data.sql
```

## 性能优化建议

### 1. 索引优化

根据实际查询模式，可能需要添加额外的索引：

```sql
-- 为常用查询添加复合索引
CREATE INDEX CONCURRENTLY idx_raw_data_field_time ON raw_data (session_id, capture_time DESC);

-- 为JSONB字段添加GIN索引
CREATE INDEX CONCURRENTLY idx_raw_data_sensor_meta_gin ON raw_data USING GIN (sensor_meta);
```

### 2. 分区表实施

对于大数据量场景，考虑实施分区：

```sql
-- 为原始数据表按月分区
CREATE TABLE raw_data_partitioned (
  -- 表结构同raw_data
  LIKE raw_data INCLUDING ALL
) PARTITION BY RANGE (capture_time);

-- 创建分区
CREATE TABLE raw_data_2025_01 PARTITION OF raw_data_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 3. 配置调优

根据服务器资源调整PostgreSQL配置：

```bash
# 在postgresql.conf中调整以下参数
shared_buffers = 256MB              # 25% of RAM
effective_cache_size = 1GB           # 75% of RAM
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

## 备份与恢复策略

### 1. 定期备份

设置定期备份任务：

```bash
#!/bin/bash
# backup_green_tracker.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgresql"
DB_NAME="green_tracker"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 全量备份
pg_dump -h localhost -U postgres -d $DB_NAME -f $BACKUP_DIR/green_tracker_full_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/green_tracker_full_$DATE.sql

# 保留最近30天的备份
find $BACKUP_DIR -name "green_tracker_full_*.sql.gz" -type f -mtime +30 -delete
```

### 2. 恢复流程

从备份恢复数据库：

```bash
# 解压备份文件
gunzip green_tracker_full_20250614_120000.sql.gz

# 恢复数据库
psql -h localhost -U postgres -d green_tracker -f green_tracker_full_20250614_120000.sql
```

## 监控与维护

### 1. 性能监控

```sql
-- 查看慢查询
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 查看表大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 2. 定期维护

```sql
-- 更新表统计信息
ANALYZE;

-- 重建索引（如需要）
REINDEX DATABASE green_tracker;

-- 清理死元组
VACUUM (VERBOSE, ANALYZE);
```

## 总结

本指南提供了Green Tracker系统数据库的完整迁移和初始化方案，包括：

1. **数据迁移**：从旧表结构到新表结构的完整迁移脚本
2. **验证机制**：确保迁移数据完整性的验证脚本
3. **全新安装**：从零开始安装数据库的步骤
4. **性能优化**：针对不同场景的优化建议
5. **备份恢复**：可靠的数据备份和恢复策略
6. **监控维护**：确保数据库稳定运行的方法

按照本指南操作，可以安全、高效地完成Green Tracker系统的数据库初始化和迁移工作。