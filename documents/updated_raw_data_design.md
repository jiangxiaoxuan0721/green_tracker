# 更新的原始数据表设计

## 设计概述

基于农作物分析需求，重新设计原始数据表，支持多种传感器数据类型（光照、温湿度、PH值等）以及图像数据，并优化前端显示需求。

## 数据表结构

### 1. 用户原始数据表 (user_{userid}_raw_data)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键，自动生成 |
| session_id | UUID | 采集会话ID |
| device_id | UUID | 采集设备ID |
| device_display_name | TEXT | 设备前端显示名称 |
| field_id | UUID | 采集地块ID |
| field_display_name | TEXT | 地块前端显示名称 |
| data_type | TEXT | 数据类型 (image/video/environmental/soil/multi_spectral) |
| data_subtype | TEXT | 数据子类型 (temperature/humidity/ph/light/ndvi/rgb等) |
| data_unit | TEXT | 数据单位 (°C/%/ppm/lux等) |
| data_value | TEXT | 数据值（图像类型为MinIO存储位置，其他为测量值） |
| data_format | TEXT | 数据格式 (jpg/png/csv/json等) |
| capture_time | TIMESTAMPTZ | 采集时间 |
| location_geom | GEOMETRY(POINT, 4326) | 采集位置 |
| altitude_m | REAL | 采集高度(米) |
| heading | REAL | 朝向(度) |
| sensor_meta | JSONB | 传感器元数据 |
| file_meta | JSONB | 文件元数据 |
| acquisition_meta | JSONB | 采集元数据 |
| quality_score | DECIMAL(3, 2) | 数据质量评分(0-5) |
| quality_flags | TEXT[] | 质量标记数组 |
| checksum | TEXT | 文件校验值 |
| is_valid | BOOLEAN | 是否有效 |
| validation_notes | TEXT | 验证备注 |
| processing_status | TEXT | 处理状态 (pending/processing/completed/failed) |
| processed_at | TIMESTAMPTZ | 处理完成时间 |
| ai_status | TEXT | AI分析状态 (pending/analyzing/completed/failed) |
| ai_analyzed_at | TIMESTAMPTZ | AI分析完成时间 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

### 2. 数据类型定义

#### 环境数据类型 (environmental)
- 温度 (temperature)
- 湿度 (humidity)
- 光照强度 (light_intensity)
- 大气压力 (pressure)
- 风速 (wind_speed)
- 风向 (wind_direction)
- 降水量 (precipitation)

#### 土壤数据类型 (soil)
- 土壤温度 (soil_temperature)
- 土壤湿度 (soil_moisture)
- PH值 (soil_ph)
- 电导率 (electrical_conductivity)
- 氮含量 (nitrogen)
- 磷含量 (phosphorus)
- 钾含量 (potassium)

#### 光谱数据类型 (multi_spectral)
- NDVI (归一化植被指数)
- 红外光谱 (infrared)
- 紫外光谱 (ultraviolet)
- 近红外 (near_infrared)

#### 图像数据类型 (image)
- RGB图像 (rgb)
- 多光谱图像 (multi_spectral)
- 热成像 (thermal)
- 高光谱 (hyperspectral)

## 前端显示需求

### 列表显示字段
1. 数据ID
2. 设备名称 (device_display_name)
3. 地块名称 (field_display_name)
4. 数据类型 (data_type)
5. 数据值 (data_value) - 图像显示缩略图，数值显示单位
6. 操作按钮 - 删除和详情

### 详情页面显示
1. 基本信息：数据ID、采集时间、采集位置
2. 设备信息：设备ID、设备名称、传感器参数
3. 地块信息：地块ID、地块名称、位置信息
4. 数据详情：数据类型、数据值、数据单位、数据格式
5. 元数据：传感器元数据、采集参数、文件元数据
6. 质量信息：质量评分、质量标记、验证备注
7. 处理状态：处理状态、AI分析状态

## 数据存储设计

### 图像数据
- 存储位置：MinIO对象存储
- data_value字段：存储MinIO对象路径
- data_format字段：存储图像格式 (jpg/png/tif等)
- file_meta字段：存储图像元数据（分辨率、大小等）

### 传感器数据
- 存储位置：数据库
- data_value字段：存储测量值
- data_unit字段：存储测量单位
- data_format字段：存储数据格式 (numeric/json等)
- sensor_meta字段：存储传感器参数（量程、精度等）

## 查询优化

### 常见查询场景
1. 按地块查询数据
2. 按设备查询数据
3. 按数据类型查询数据
4. 按时间范围查询数据
5. 按地理位置查询数据

### 索引设计
1. 设备ID索引
2. 地块ID索引
3. 数据类型索引
4. 采集时间索引
5. 位置空间索引
6. 复合索引（设备+地块+时间）
7. 复合索引（数据类型+时间）

## 数据质量控制

### 质量标记类型
1. sensor_error - 传感器故障
2. out_of_range - 数值超出范围
3. calibration_needed - 需要校准
4. environmental_interference - 环境干扰
5. data_missing - 数据缺失
6. format_error - 格式错误
7. duplicate_data - 重复数据

### 质量评分标准
- 5.0：完美数据，无需任何处理
- 4.0-4.9：高质量数据，轻微异常
- 3.0-3.9：中等质量数据，需要检查
- 2.0-2.9：低质量数据，需要修复
- 1.0-1.9：极低质量数据，需要重新采集
- 0.0-0.9：无效数据，建议删除

## 数据处理流程

### 数据采集
1. 设备采集数据
2. 数据暂存到临时区域
3. 数据质量检查
4. 数据入库

### 数据处理
1. 原始数据解析
2. 数据格式标准化
3. 数据质量评估
4. 数据清洗和校正
5. 数据分析和特征提取

### AI分析
1. 数据预处理
2. 特征提取
3. 模型推理
4. 结果生成
5. 结果存储

## API设计

### 数据列表API
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "id": "uuid",
        "device_display_name": "无人机-01",
        "field_display_name": "玉米地块A",
        "data_type": "image",
        "data_subtype": "rgb",
        "data_value": "minio://bucket/path/to/image.jpg",
        "data_unit": null,
        "data_format": "jpg",
        "capture_time": "2023-06-15T10:30:00Z",
        "is_valid": true,
        "processing_status": "completed",
        "ai_status": "completed"
      }
    ]
  }
}
```

### 数据详情API
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "session_id": "uuid",
    "device_id": "uuid",
    "device_display_name": "无人机-01",
    "field_id": "uuid",
    "field_display_name": "玉米地块A",
    "data_type": "environmental",
    "data_subtype": "temperature",
    "data_value": "25.6",
    "data_unit": "°C",
    "data_format": "numeric",
    "capture_time": "2023-06-15T10:30:00Z",
    "location_geom": "POINT(116.15 39.95)",
    "sensor_meta": {
      "sensor_model": "DHT22",
      "accuracy": "±0.5°C",
      "range": "-40~80°C"
    },
    "acquisition_meta": {
      "sampling_rate": "1/min",
      "duration": "10s"
    },
    "quality_score": 4.5,
    "quality_flags": [],
    "is_valid": true,
    "processing_status": "completed",
    "ai_status": "completed"
  }
}
```

## 总结

更新的原始数据表设计更加贴合农作物分析需求，支持多种传感器数据类型，并优化了前端显示需求。通过统一的数据模型，可以方便地存储和查询不同类型的农业数据，为农作物分析提供全面的数据支持。