-- =========================================================
-- 为每个用户创建独立的raw_data表的SQL脚本
-- =========================================================

-- 确保PostGIS扩展已安装
CREATE EXTENSION IF NOT EXISTS postgis;

-- 创建用户特定的原始数据表的函数
CREATE OR REPLACE FUNCTION create_user_raw_data_tables(userid TEXT)
RETURNS VOID AS $$
DECLARE
    raw_data_table_name TEXT;
    raw_data_tags_table_name TEXT;
BEGIN
    -- 设置表名
    raw_data_table_name := 'user_' || userid || '_raw_data';
    raw_data_tags_table_name := 'user_' || userid || '_raw_data_tags';
    
    -- 创建原始数据表
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            -- 主键
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- 逻辑归属
            session_id        UUID NOT NULL,
            
            -- 设备信息
            device_id         UUID,
            device_display_name TEXT,                  -- 设备前端显示名称
            
            -- 地块信息
            field_id          UUID,
            field_display_name TEXT,                  -- 地块前端显示名称
            
            -- 数据类型与值
            data_type         TEXT NOT NULL,           -- image/video/environmental/soil/multi_spectral
            data_subtype      TEXT,                    -- temperature/humidity/ph/light/ndvi/rgb等
            data_unit         TEXT,                    -- 数据单位 (°C/%/ppm/lux等)
            data_value        TEXT NOT NULL,           -- 数据值（图像类型为MinIO存储位置，其他为测量值）
            data_format       TEXT,                    -- 数据格式 (jpg/png/csv/json等)
            
            -- 对象存储索引（仅图像数据需要）
            bucket_name       TEXT,                    -- MinIO bucket
            object_key        TEXT,                    -- MinIO 对象路径
            
            -- 采集时空信息
            capture_time      TIMESTAMPTZ NOT NULL,
            location_geom     GEOMETRY(POINT, 4326),
            altitude_m        REAL,                    -- 采集高度（米）
            heading           REAL,                    -- 朝向（度）
            
            -- 传感器与数据元信息
            sensor_meta       JSONB,                   -- 传感器参数 / 量程 / 精度
            file_meta         JSONB,                   -- 文件大小 / 分辨率 / 编码
            acquisition_meta  JSONB,                   -- 采集参数
            
            -- 数据质量
            quality_score     DECIMAL(3, 2),           -- 数据质量评分（0-5）
            quality_flags     TEXT[],                  -- 质量标记数组
            checksum          TEXT,                    -- 文件校验（MD5/SHA256）
            is_valid          BOOLEAN DEFAULT TRUE,
            validation_notes  TEXT,                    -- 验证备注
            
            -- 处理状态
            processing_status TEXT DEFAULT ''pending'',  -- pending / processing / completed / failed
            processed_at      TIMESTAMPTZ,             -- 处理完成时间
            
            -- AI分析状态
            ai_status         TEXT DEFAULT ''pending'',  -- pending / analyzing / completed / failed
            ai_analyzed_at    TIMESTAMPTZ,             -- AI分析完成时间
            
            -- 时间戳
            created_at        TIMESTAMPTZ DEFAULT NOW(),
            updated_at        TIMESTAMPTZ DEFAULT NOW()
        )',
        raw_data_table_name
    );
    
    -- 创建原始数据标签表
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            -- 主键
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- 关联用户原始数据表
            raw_data_id       UUID NOT NULL,
            
            -- 标签信息
            tag_category      TEXT NOT NULL,           -- 标签类别：content/quality/weather/crop_stage
            tag_value         TEXT NOT NULL,           -- 标签值
            confidence        DECIMAL(3, 2),           -- 标注置信度（0-1）
            source            TEXT,                    -- 标注来源：manual/ai/predefined
            
            -- 时间戳
            created_at        TIMESTAMPTZ DEFAULT NOW()
        )',
        raw_data_tags_table_name
    );
    
    -- 为原始数据表创建索引
    -- 1. 会话ID索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_session_id
        ON %I (session_id);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 2. 设备ID索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_device_id
        ON %I (device_id);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 3. 地块ID索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_field_id
        ON %I (field_id);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 4. 数据类型索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_data_type
        ON %I (data_type);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 5. 数据子类型索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_data_subtype
        ON %I (data_subtype);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 6. 空间索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_location_geom
        ON %I
        USING GIST (location_geom);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 7. 时间索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_capture_time
        ON %I (capture_time DESC);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 8. 处理状态索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_processing_status
        ON %I (processing_status);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 9. AI状态索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_ai_status
        ON %I (ai_status);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 10. 唯一约束（仅对图像数据）
    EXECUTE format('
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_%s_image_object
        ON %I (session_id, bucket_name, object_key) 
        WHERE data_type IN (''image'', ''video'');
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 11. 复合索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_session_type
        ON %I (session_id, data_type);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 12. 复合索引（设备+地块+时间）
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_device_field_time
        ON %I (device_id, field_id, capture_time DESC);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 13. 复合索引（数据类型+时间）
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_type_time
        ON %I (data_type, capture_time DESC);
    ',
    raw_data_table_name, raw_data_table_name);
    
    -- 为原始数据标签表创建索引
    -- 1. 原始数据ID索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_raw_data_id
        ON %I (raw_data_id);
    ',
    raw_data_tags_table_name, raw_data_tags_table_name);
    
    -- 2. 标签类别索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_tag_category
        ON %I (tag_category);
    ',
    raw_data_tags_table_name, raw_data_tags_table_name);
    
    -- 3. 标签值索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_tag_value
        ON %I (tag_value);
    ',
    raw_data_tags_table_name, raw_data_tags_table_name);
    
    -- 4. 类别-值复合索引
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%s_category_value
        ON %I (tag_category, tag_value);
    ',
    raw_data_tags_table_name, raw_data_tags_table_name);
    
    RAISE NOTICE '用户 % 的原始数据表创建成功', userid;
END;
$$ LANGUAGE plpgsql;

-- 删除用户特定表的函数
CREATE OR REPLACE FUNCTION drop_user_raw_data_tables(userid TEXT)
RETURNS VOID AS $$
DECLARE
    raw_data_table_name TEXT;
    raw_data_tags_table_name TEXT;
BEGIN
    -- 设置表名
    raw_data_table_name := 'user_' || userid || '_raw_data';
    raw_data_tags_table_name := 'user_' || userid || '_raw_data_tags';
    
    -- 删除表
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', raw_data_tags_table_name);
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', raw_data_table_name);
    
    RAISE NOTICE '用户 % 的原始数据表删除成功', userid;
END;
$$ LANGUAGE plpgsql;

-- 为所有现有用户创建表的函数
CREATE OR REPLACE FUNCTION init_all_user_raw_data_tables()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    count INTEGER := 0;
BEGIN
    FOR user_record IN SELECT userid FROM users LOOP
        PERFORM create_user_raw_data_tables(user_record.userid::TEXT);
        count := count + 1;
    END LOOP;
    
    RAISE NOTICE '为 % 个用户创建了原始数据表', count;
    RETURN count;
END;
$$ LANGUAGE plpgsql;

-- 使用示例
-- 1. 为特定用户创建表
-- SELECT create_user_raw_data_tables('12345678-1234-1234-1234-123456789abc');

-- 2. 为所有用户创建表
-- SELECT init_all_user_raw_data_tables();

-- 3. 删除特定用户的表
-- SELECT drop_user_raw_data_tables('12345678-1234-1234-1234-123456789abc');