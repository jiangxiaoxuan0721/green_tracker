# MinIO对象存储集成文档

## 概述

MinIO作为Green Tracker系统的对象存储组件，负责存储所有原始感知数据，包括图像、视频、环境数据和点云等多源数据。MinIO与PostgreSQL协同工作，PostgreSQL存储元数据和索引，MinIO存储实际的二进制文件。

## 架构设计

### 数据流向
1. **数据采集**: 设备（无人机、卫星、传感器等）采集原始数据
2. **上传处理**: 原始数据通过API上传至后端服务
3. **存储索引**: 文件存储至MinIO，元数据记录至PostgreSQL
4. **检索使用**: 通过PostgreSQL查询元数据，从MinIO获取实际文件

### 组件关系图
```
┌──────────────┐      上传      ┌─────────────┐      索引       ┌──────────────┐
│   采集设备    │  ────────>   │   后端API   │  ────────>    │  PostgreSQL   │
│ (UAV/传感器) │             │             │             │    (元数据)    │
└──────────────┘             └─────────────┘             └──────────────┘
                                                              │
                                                              │
                                                              ▼
                                                     ┌──────────────┐
                                                     │     MinIO    │
                                                     │   (原始文件)  │
                                                     └──────────────┘
```

## MinIO配置

### 环境变量配置
在`.env`文件中配置MinIO连接参数：
```bash
# MinIO连接配置
MINIO_ENDPOINT=localhost          # MinIO服务地址
MINIO_PORT=9000                   # MinIO服务端口
MINIO_ACCESS_KEY=minioadmin       # 访问密钥
MINIO_SECRET_KEY=minioadmin       # 秘密密钥
MINIO_BUCKET_NAME=green-tracker   # 默认存储桶名称
MINIO_SECURE=false                # 是否使用HTTPS
```

### MinIO客户端初始化
```python
from minio import Minio
from minio.error import S3Error
import os

def get_minio_client():
    """初始化MinIO客户端"""
    endpoint = f"{os.getenv('MINIO_ENDPOINT')}:{os.getenv('MINIO_PORT')}"
    access_key = os.getenv('MINIO_ACCESS_KEY')
    secret_key = os.getenv('MINIO_SECRET_KEY')
    secure = os.getenv('MINIO_SECURE', 'false').lower() == 'true'
    
    client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure
    )
    
    return client
```

### 存储桶结构设计
MinIO中的存储桶按照以下层次结构组织数据：

```
green-tracker/                          # 默认存储桶
├── fields/                            # 按地块组织
│   ├── {field_id}/                    # 按地块ID
│   │   ├── {session_id}/              # 按采集会话ID
│   │   │   ├── images/                # 图像数据
│   │   │   │   ├── {timestamp}_{device_id}_{sequence}.jpg
│   │   │   │   └── ...
│   │   │   ├── videos/                # 视频数据
│   │   │   │   ├── {timestamp}_{device_id}_{sequence}.mp4
│   │   │   │   └── ...
│   │   │   ├── lidar/                 # 激光雷达数据
│   │   │   │   ├── {timestamp}_{device_id}_{sequence}.pcd
│   │   │   │   └── ...
│   │   │   └── environmental/         # 环境数据
│   │   │       ├── {timestamp}_{device_id}_{sequence}.json
│   │   │       └── ...
│   │   └── ...
│   └── ...
├── processed/                         # 处理后的数据
│   ├── analytics/                     # 分析结果
│   ├── models/                        # 模型输出
│   └── reports/                       # 报告文件
└── temp/                             # 临时文件
```

## 数据上传与索引

### 数据上传流程
1. 接收前端或设备上传的文件
2. 生成唯一的对象路径
3. 将文件上传至MinIO
4. 将元数据信息记录到PostgreSQL的raw_data表

### 代码示例
```python
import uuid
from datetime import datetime
from minio import Minio
from minio.error import S3Error
from sqlalchemy.orm import Session
from database.models import RawData

def upload_and_index_file(
    db: Session, 
    file_data: bytes, 
    filename: str,
    data_type: str,
    device_id: uuid.UUID,
    session_id: uuid.UUID,
    capture_time: datetime,
    location_geom
) -> uuid.UUID:
    """
    上传文件到MinIO并索引到PostgreSQL
    
    参数:
        db: 数据库会话
        file_data: 文件二进制数据
        filename: 原始文件名
        data_type: 数据类型(image/video/lidar/environmental)
        device_id: 设备ID
        session_id: 采集会话ID
        capture_time: 采集时间
        location_geom: 采集位置几何信息
    
    返回:
        raw_data_id: 创建的原始数据记录ID
    """
    # 1. 初始化MinIO客户端
    minio_client = get_minio_client()
    bucket_name = os.getenv('MINIO_BUCKET_NAME')
    
    # 2. 确保存储桶存在
    if not minio_client.bucket_exists(bucket_name):
        minio_client.make_bucket(bucket_name)
    
    # 3. 生成对象路径
    timestamp = capture_time.strftime('%Y%m%d_%H%M%S')
    file_extension = filename.split('.')[-1]
    object_name = f"fields/{field_id}/{session_id}/{data_type}s/{timestamp}_{device_id}.{file_extension}"
    
    # 4. 上传文件到MinIO
    try:
        file_size = len(file_data)
        minio_client.put_object(
            bucket_name,
            object_name,
            data=BytesIO(file_data),
            length=file_size,
            content_type=get_content_type(data_type, file_extension)
        )
    except S3Error as e:
        raise Exception(f"文件上传失败: {e}")
    
    # 5. 创建PostgreSQL记录
    raw_data_record = RawData(
        session_id=session_id,
        data_type=data_type,
        device_id=device_id,
        bucket_name=bucket_name,
        object_key=object_name,
        capture_time=capture_time,
        location_geom=location_geom
    )
    
    db.add(raw_data_record)
    db.commit()
    db.refresh(raw_data_record)
    
    return raw_data_record.id

def get_content_type(data_type: str, file_extension: str) -> str:
    """根据数据类型和文件扩展名返回MIME类型"""
    if data_type == "image":
        return f"image/{file_extension}"
    elif data_type == "video":
        return f"video/{file_extension}"
    elif data_type == "lidar":
        return "application/octet-stream"
    elif data_type == "environmental":
        return "application/json"
    else:
        return "application/octet-stream"
```

## 数据检索与访问

### 数据检索流程
1. 根据查询条件从PostgreSQL获取raw_data记录
2. 从记录中提取MinIO的bucket和object_key
3. 使用MinIO客户端获取文件
4. 返回文件数据或生成预签名URL

### 代码示例
```python
from urllib.parse import quote
from datetime import timedelta

def get_raw_data_file(raw_data_id: uuid.UUID, db: Session):
    """
    根据raw_data_id获取文件
    
    参数:
        raw_data_id: 原始数据ID
        db: 数据库会话
    
    返回:
        文件二进制数据
    """
    # 1. 从数据库查询raw_data记录
    raw_data = db.query(RawData).filter(RawData.id == raw_data_id).first()
    if not raw_data:
        raise HTTPException(status_code=404, detail="原始数据不存在")
    
    # 2. 从MinIO获取文件
    minio_client = get_minio_client()
    
    try:
        response = minio_client.get_object(raw_data.bucket_name, raw_data.object_key)
        file_data = response.read()
        response.close()
        response.release_conn()
        
        return file_data
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"文件获取失败: {e}")

def get_presigned_url(raw_data_id: uuid.UUID, db: Session, expires: int = 3600):
    """
    生成预签名URL用于前端直接访问文件
    
    参数:
        raw_data_id: 原始数据ID
        db: 数据库会话
        expires: URL过期时间(秒)，默认1小时
    
    返回:
        预签名URL字符串
    """
    # 1. 从数据库查询raw_data记录
    raw_data = db.query(RawData).filter(RawData.id == raw_data_id).first()
    if not raw_data:
        raise HTTPException(status_code=404, detail="原始数据不存在")
    
    # 2. 生成预签名URL
    minio_client = get_minio_client()
    
    try:
        url = minio_client.presigned_get_object(
            raw_data.bucket_name,
            raw_data.object_key,
            expires=timedelta(seconds=expires)
        )
        return url
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"URL生成失败: {e}")
```

## 数据清理与维护

### 数据生命周期管理
1. **临时文件清理**: 定期清理temp存储桶中的临时文件
2. **冷数据归档**: 将长时间未访问的数据归档到低频访问存储
3. **冗余数据清理**: 清理数据库中存在但MinIO中已不存在的数据记录
4. **存储监控**: 监控存储使用情况，及时预警

### 代码示例
```python
def cleanup_temp_files():
    """清理临时文件"""
    minio_client = get_minio_client()
    
    # 列出并删除temp存储桶中的所有对象
    temp_bucket = "green-tracker-temp"
    if minio_client.bucket_exists(temp_bucket):
        objects = minio_client.list_objects(temp_bucket, recursive=True)
        for obj in objects:
            minio_client.remove_object(temp_bucket, obj.object_name)

def verify_data_integrity(db: Session):
    """验证数据完整性"""
    minio_client = get_minio_client()
    
    # 获取所有raw_data记录
    raw_data_records = db.query(RawData).all()
    missing_files = []
    
    for record in raw_data_records:
        try:
            # 检查对象是否存在
            minio_client.stat_object(record.bucket_name, record.object_key)
        except S3Error:
            # 记录不存在的文件
            missing_files.append({
                "id": str(record.id),
                "bucket": record.bucket_name,
                "object_key": record.object_key
            })
    
    return missing_files
```

## 性能优化与最佳实践

### 性能优化策略
1. **并行上传**: 支持多线程/异步上传多个文件
2. **断点续传**: 对大文件实现断点续传功能
3. **压缩存储**: 对文本类数据压缩存储
4. **预签名URL**: 对前端访问使用预签名URL减少后端负载
5. **缓存机制**: 对频繁访问的小文件实现内存缓存

### 代码示例
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
from minio import Minio
from minio.error import S3Error

async def parallel_upload_files(files_data, session_id, device_id):
    """并行上传多个文件"""
    minio_client = get_minio_client()
    bucket_name = os.getenv('MINIO_BUCKET_NAME')
    
    async def upload_single_file(file_info):
        filename = file_info['filename']
        file_data = file_info['data']
        data_type = file_info['data_type']
        
        # 生成对象路径
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_extension = filename.split('.')[-1]
        object_name = f"fields/{field_id}/{session_id}/{data_type}s/{timestamp}_{device_id}.{file_extension}"
        
        # 使用线程池执行同步上传
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor, 
                lambda: minio_client.put_object(
                    bucket_name,
                    object_name,
                    data=BytesIO(file_data),
                    length=len(file_data),
                    content_type=get_content_type(data_type, file_extension)
                )
            )
        
        return object_name
    
    # 并行上传所有文件
    tasks = [upload_single_file(file_info) for file_info in files_data]
    object_names = await asyncio.gather(*tasks)
    
    return object_names
```

## 安全与备份

### 安全措施
1. **访问控制**: 限制MinIO访问密钥的权限范围
2. **传输加密**: 生产环境启用HTTPS传输
3. **数据加密**: 敏感数据客户端加密后上传
4. **审计日志**: 记录所有文件访问和修改操作

### 备份策略
1. **跨区域复制**: 配置MinIO服务器间数据复制
2. **定期快照**: 创建存储桶定期快照
3. **导出备份**: 定期导出重要数据到外部存储
4. **元数据备份**: 定期备份PostgreSQL中的元数据

## 监控与故障处理

### 监控指标
1. **存储使用量**: 存储桶使用空间监控
2. **请求量与延迟**: API请求量、成功率和延迟
3. **错误率**: 4xx和5xx错误统计
4. **网络带宽**: 上传下载带宽使用情况

### 故障处理
1. **网络中断**: 实现重试机制和离线缓存
2. **服务不可用**: 降级服务并记录未成功操作
3. **存储空间不足**: 自动清理临时文件和告警
4. **数据损坏**: 使用校验和验证并从备份恢复

## 总结

MinIO作为Green Tracker系统的对象存储组件，与PostgreSQL协同工作，实现了原始感知数据的高效存储、检索和管理。通过合理的设计和优化，系统可以支持大规模农情数据的存储和分析，为空-天-地一体化农情监测提供可靠的数据基础。