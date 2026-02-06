-- 修复 raw_data 表问题
-- 删除可能存在的残留索引，然后重新创建表

-- 首先删除可能残留的索引
DROP INDEX IF EXISTS idx_raw_data_location_geom CASCADE;

-- 删除可能残留的 raw_data 表（如果部分存在）
DROP TABLE IF EXISTS raw_data CASCADE;
DROP TABLE IF EXISTS raw_data_tags CASCADE;
DROP TABLE IF EXISTS crop_objects CASCADE;

-- 创建 raw_data 表
CREATE TABLE raw_data (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES collection_sessions (id) ON DELETE CASCADE,
    device_id VARCHAR(36) REFERENCES devices (id) ON DELETE SET NULL,
    field_id VARCHAR(36) REFERENCES fields (id) ON DELETE SET NULL,
    data_type TEXT NOT NULL,
    data_subtype TEXT,
    data_unit TEXT,
    data_value TEXT NOT NULL,
    data_format TEXT,
    bucket_name TEXT,
    object_key TEXT,
    capture_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    location_geom GEOMETRY(POINT,4326),
    altitude_m FLOAT,
    heading FLOAT,
    sensor_meta JSON,
    file_meta JSON,
    acquisition_meta JSON,
    quality_score FLOAT,
    quality_flags JSON,
    checksum TEXT,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    validation_notes TEXT,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMP WITHOUT TIME ZONE,
    ai_status TEXT NOT NULL DEFAULT 'pending',
    ai_analyzed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- 创建 raw_data_tags 表
CREATE TABLE raw_data_tags (
    id VARCHAR(36) PRIMARY KEY,
    raw_data_id VARCHAR(36) NOT NULL REFERENCES raw_data (id) ON DELETE CASCADE,
    tag_category TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    confidence FLOAT,
    source TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- 创建 crop_objects 表
CREATE TABLE crop_objects (
    id VARCHAR(36) PRIMARY KEY,
    field_id VARCHAR(36) NOT NULL REFERENCES fields (id) ON DELETE CASCADE,
    crop_type TEXT NOT NULL,
    object_level TEXT NOT NULL,
    object_code TEXT,
    geometry GEOMETRY(GEOMETRY,4326),
    growth_stage TEXT,
    health_status TEXT,
    source_raw_data_id VARCHAR(36) REFERENCES raw_data (id) ON DELETE SET NULL,
    first_seen_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    attributes JSON,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- 创建 raw_data 索引
CREATE INDEX idx_raw_data_session_id ON raw_data (session_id);
CREATE INDEX idx_raw_data_device_id ON raw_data (device_id);
CREATE INDEX idx_raw_data_field_id ON raw_data (field_id);
CREATE INDEX idx_raw_data_data_type ON raw_data (data_type);
CREATE INDEX idx_raw_data_data_subtype ON raw_data (data_subtype);
CREATE INDEX idx_raw_data_capture_time ON raw_data (capture_time);
CREATE INDEX idx_raw_data_processing_status ON raw_data (processing_status);
CREATE INDEX idx_raw_data_ai_status ON raw_data (ai_status);
CREATE INDEX idx_raw_data_location_geom ON raw_data USING gist (location_geom);
CREATE INDEX idx_raw_data_session_type ON raw_data (session_id, data_type);
CREATE INDEX idx_raw_data_device_field_time ON raw_data (device_id, field_id, capture_time);
CREATE INDEX idx_raw_data_type_time ON raw_data (data_type, capture_time);
CREATE INDEX uniq_raw_data_object ON raw_data (session_id, bucket_name, object_key);

-- 创建 raw_data_tags 索引
CREATE INDEX idx_raw_data_tags_raw_data_id ON raw_data_tags (raw_data_id);
CREATE INDEX idx_raw_data_tags_category ON raw_data_tags (tag_category);
CREATE INDEX idx_raw_data_tags_value ON raw_data_tags (tag_value);
CREATE INDEX idx_raw_data_tags_category_value ON raw_data_tags (tag_category, tag_value);

-- 创建 crop_objects 索引
CREATE INDEX uniq_crop_object_code ON crop_objects (field_id, object_code);
CREATE INDEX idx_crop_objects_field_id ON crop_objects (field_id);
CREATE INDEX idx_crop_objects_crop_type ON crop_objects (crop_type);
CREATE INDEX idx_crop_objects_growth_stage ON crop_objects (growth_stage);
CREATE INDEX idx_crop_objects_health_status ON crop_objects (health_status);
CREATE INDEX idx_crop_objects_first_seen ON crop_objects (first_seen_at);
CREATE INDEX idx_crop_objects_last_seen ON crop_objects (last_seen_at);
CREATE INDEX idx_crop_objects_active ON crop_objects (is_active);
CREATE INDEX idx_crop_objects_geometry ON crop_objects USING gist (geometry);
