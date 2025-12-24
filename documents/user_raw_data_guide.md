# 用户原始数据表使用指南

## 概述

本指南介绍了Green Tracker系统中为每个用户创建独立的原始数据表(raw_data)的设计和使用方法。这种设计确保了不同用户的数据隔离，提高了数据安全性和查询性能。

## 设计原理

### 数据隔离

每个用户拥有独立的原始数据表，表命名规则为：
- 原始数据表：`user_{userid}_raw_data`
- 原始数据标签表：`user_{userid}_raw_data_tags`

其中`{userid}`是用户的唯一标识符(UUID)。

### 表结构

#### 原始数据表 (user_{userid}_raw_data)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键，自动生成 |
| session_id | UUID | 采集会话ID |
| device_id | UUID | 设备ID |
| device_display_name | TEXT | 设备前端显示名称 |
| field_id | UUID | 地块ID |
| field_display_name | TEXT | 地块前端显示名称 |
| data_type | TEXT | 数据类型 (image/video/environmental/soil/multi_spectral) |
| data_subtype | TEXT | 数据子类型 (temperature/humidity/ph/light/ndvi/rgb等) |
| data_unit | TEXT | 数据单位 (°C/%/ppm/lux等) |
| data_value | TEXT | 数据值（图像类型为MinIO存储位置，其他为测量值） |
| data_format | TEXT | 数据格式 (jpg/png/csv/json等) |
| bucket_name | TEXT | MinIO bucket名称（仅图像数据需要） |
| object_key | TEXT | MinIO对象路径（仅图像数据需要） |
| capture_time | TIMESTAMPTZ | 采集时间 |
| location_geom | GEOMETRY(POINT, 4326) | 位置信息 |
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

#### 原始数据标签表 (user_{userid}_raw_data_tags)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | UUID | 主键，自动生成 |
| raw_data_id | UUID | 关联的原始数据ID |
| tag_category | TEXT | 标签类别 (content/quality/weather/crop_stage) |
| tag_value | TEXT | 标签值 |
| confidence | DECIMAL(3, 2) | 置信度(0-1) |
| source | TEXT | 标注来源 (manual/ai/predefined) |
| created_at | TIMESTAMPTZ | 创建时间 |

## 使用方法

### 1. 创建用户表

当创建新用户时，系统会自动为该用户创建原始数据表。也可以手动创建：

#### 使用Python服务

```python
from database.db_services.user_raw_data_service import init_user_raw_data_tables

# 为用户ID创建表
success = init_user_raw_data_tables("用户ID")
```

#### 使用命令行工具

```bash
# 为特定用户创建表
python -m database.db_builder.manage_user_tables init --userid 12345678-1234-1234-1234-123456789abc

# 或使用用户名
python -m database.db_builder.manage_user_tables init --username testuser

# 为所有用户创建表
python -m database.db_builder.manage_user_tables init-all
```

#### 使用SQL函数

```sql
-- 为特定用户创建表
SELECT create_user_raw_data_tables('12345678-1234-1234-1234-123456789abc');

-- 为所有用户创建表
SELECT init_all_user_raw_data_tables();
```

### 2. 添加原始数据

```python
from database.db_services.user_raw_data_service import add_raw_data

# 添加图像数据
image_data_id = add_raw_data(
    userid="用户ID",
    session_id="会话ID",
    data_type="image",
    data_value="minio://green-tracker/field_001/img_001.jpg",  # MinIO存储路径
    capture_time="2025-06-23T10:30:00Z",
    device_id="设备ID",
    device_display_name="无人机-01",  # 前端显示名称
    field_id="地块ID",
    field_display_name="玉米地块A",  # 前端显示名称
    data_subtype="rgb",  # 图像子类型
    data_format="jpg",  # 图像格式
    bucket_name="green-tracker",  # MinIO bucket
    object_key="field_001/img_001.jpg",  # MinIO对象路径
    location_geom="POINT(116.15 39.95)",
    altitude_m=100.0,
    heading=0.0,
    sensor_meta={"camera": "RGB", "resolution": "4000x3000"},
    file_meta={"size": 2048576, "format": "jpg"}
)

# 添加环境数据（温度）
temperature_data_id = add_raw_data(
    userid="用户ID",
    session_id="会话ID",
    data_type="environmental",
    data_value="25.6",  # 测量值
    capture_time="2025-06-23T10:30:00Z",
    device_id="设备ID",
    device_display_name="环境传感器-01",  # 前端显示名称
    field_id="地块ID",
    field_display_name="玉米地块A",  # 前端显示名称
    data_subtype="temperature",  # 数据子类型
    data_unit="°C",  # 数据单位
    data_format="numeric",  # 数据格式
    location_geom="POINT(116.15 39.95)"
)

# 添加土壤数据（PH值）
ph_data_id = add_raw_data(
    userid="用户ID",
    session_id="会话ID",
    data_type="soil",
    data_value="6.8",  # 测量值
    capture_time="2025-06-23T10:30:00Z",
    device_id="设备ID",
    device_display_name="土壤传感器-01",  # 前端显示名称
    field_id="地块ID",
    field_display_name="玉米地块A",  # 前端显示名称
    data_subtype="ph",  # 数据子类型
    data_unit="pH",  # 数据单位
    data_format="numeric",  # 数据格式
    location_geom="POINT(116.15 39.95)"
)
```

### 3. 查询原始数据

#### 前端列表显示

```python
from database.db_services.user_raw_data_service import get_raw_data_list_for_frontend

# 获取前端列表显示的数据
result = get_raw_data_list_for_frontend(
    userid="用户ID",
    page=1,
    page_size=20,
    device_id="设备ID",  # 可选过滤
    field_id="地块ID",   # 可选过滤
    data_type="image"     # 可选过滤
)

# 返回格式:
# {
#     "total": 100,
#     "page": 1,
#     "page_size": 20,
#     "items": [
#         {
#             "id": "uuid",
#             "device_display_name": "无人机-01",
#             "field_display_name": "玉米地块A",
#             "data_type": "image",
#             "data_subtype": "rgb",
#             "display_value": "minio://green-tracker/field_001/img_001.jpg",  # 图像显示路径
#             "capture_time": "2023-06-15T10:30:00Z",
#             "is_valid": true,
#             "processing_status": "completed",
#             "ai_status": "completed"
#         }
#     ]
# }
```

#### 根据ID查询

```python
from database.db_services.user_raw_data_service import get_raw_data_by_id

# 获取特定原始数据
data = get_raw_data_by_id("用户ID", "数据ID")

# 返回的data包含:
# - 基本信息：数据ID、采集时间、采集位置
# - 设备信息：设备ID、设备名称、传感器参数
# - 地块信息：地块ID、地块名称、位置信息
# - 数据详情：数据类型、数据值、数据单位、数据格式
# - 元数据：传感器元数据、采集参数、文件元数据
# - 质量信息：质量评分、质量标记、验证备注
# - 处理状态：处理状态、AI分析状态
```

#### 根据会话ID查询

```python
from database.db_services.user_raw_data_service import get_raw_data_by_session

# 获取会话中的所有数据
data_list = get_raw_data_by_session("用户ID", "会话ID")
```

#### 根据时间范围查询

```python
from database.db_services.user_raw_data_service import get_raw_data_by_time_range

# 获取时间范围内的数据
data_list = get_raw_data_by_time_range(
    userid="用户ID",
    start_time="2025-06-01T00:00:00Z",
    end_time="2025-06-30T23:59:59Z",
    data_type="image",
    limit=100
)
```

#### 根据位置查询

```python
from database.db_services.user_raw_data_service import get_raw_data_by_location

# 获取位置附近的数据
data_list = get_raw_data_by_location(
    userid="用户ID",
    longitude=116.15,
    latitude=39.95,
    radius_meters=500,
    limit=50
)
```

### 4. 更新处理状态

```python
from database.db_services.user_raw_data_service import update_processing_status

# 更新处理状态
success = update_processing_status("用户ID", "数据ID", "completed")

# 更新AI分析状态
success = update_ai_status("用户ID", "数据ID", "completed")
```

### 5. 添加和管理标签

```python
from database.db_services.user_raw_data_service import add_raw_data_tag, get_raw_data_tags

# 添加标签
tag_id = add_raw_data_tag(
    userid="用户ID",
    raw_data_id="数据ID",
    tag_category="content",
    tag_value="crop_row",
    confidence=0.95,
    source="ai"
)

# 获取数据的所有标签
tags = get_raw_data_tags("用户ID", "数据ID")
```

### 6. 删除用户表

当用户被删除时，其对应的表也会被自动删除。也可以手动删除：

#### 使用Python服务

```python
from database.db_services.user_raw_data_service import remove_user_raw_data_tables

# 删除用户的表
success = remove_user_raw_data_tables("用户ID")
```

#### 使用命令行工具

```bash
# 删除特定用户的表
python -m database.db_builder.manage_user_tables delete --userid 12345678-1234-1234-1234-123456789abc

# 或使用用户名
python -m database.db_builder.manage_user_tables delete --username testuser
```

#### 使用SQL函数

```sql
-- 删除特定用户的表
SELECT drop_user_raw_data_tables('12345678-1234-1234-1234-123456789abc');
```

## 管理工具

### 命令行工具

`manage_user_tables.py` 提供了以下命令：

1. `init` - 为用户初始化表
2. `delete` - 删除用户的表
3. `list-users` - 列出所有用户
4. `list-tables` - 列出用户的表
5. `init-all` - 为所有用户初始化表

### 查看用户表

```bash
# 列出所有用户
python -m database.db_builder.manage_user_tables list-users

# 列出特定用户的表
python -m database.db_builder.manage_user_tables list-tables --userid 12345678-1234-1234-1234-123456789abc
```

## 最佳实践

1. **自动初始化**：确保在创建新用户时自动初始化其原始数据表
2. **数据清理**：定期清理无效或过期的原始数据
3. **索引优化**：根据查询模式优化索引，提高查询性能
4. **监控表大小**：定期监控表大小，考虑分区策略
5. **备份策略**：为每个用户的表制定适当的备份策略

## 性能考虑

1. **分区策略**：对于数据量大的用户，可以考虑按时间范围对表进行分区
2. **查询优化**：使用适当的索引和查询提示，避免全表扫描
3. **连接池**：合理配置数据库连接池，避免连接泄漏
4. **批量操作**：对于大量数据插入，使用批量操作提高性能

## 故障排除

### 常见问题

1. **表不存在错误**
   - 确保已为用户初始化表
   - 检查表名格式是否正确

2. **权限问题**
   - 确保数据库用户有创建表的权限
   - 检查PostGIS扩展是否已安装

3. **性能问题**
   - 检查表是否有适当的索引
   - 考虑对大表进行分区

4. **空间查询问题**
   - 确保PostGIS扩展已正确安装
   - 检查SRID是否正确(应为4326)

### 日志检查

检查应用程序日志，查看是否有相关错误信息：

```
[后端UserService] 用户保存成功: 12345678-1234-1234-1234-123456789abc
[后端UserService] 用户 12345678-1234-1234-1234-123456789abc 的原始数据表初始化成功
```

## 总结

用户特定的原始数据表设计提供了良好的数据隔离和管理能力，确保了多用户环境下的数据安全和性能。通过合理的使用和管理，可以有效地支持Green Tracker系统的原始数据存储和查询需求。