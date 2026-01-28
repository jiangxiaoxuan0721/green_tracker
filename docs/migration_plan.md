# 数据库架构重构迁移计划

## 📋 目录
1. [迁移方案概述](#迁移方案概述)
2. [阶段一：核心组件开发](#阶段一核心组件开发)
3. [阶段二：用户数据库迁移](#阶段二用户数据库迁移)
4. [阶段三：认证流程改造](#阶段三认证流程改造)
5. [阶段四：API 路由改造](#阶段四api-路由改造)
6. [阶段五：清理与优化](#阶段五清理与优化)

---

## 迁移方案概述

### 目标
将当前"全局表 + 用户级动态表"的架构迁移到"每个用户独立数据库"的架构。

### 架构对比

#### 旧架构
```
green_tracker (单数据库)
├── users (全局)
├── field (全局)
├── device (全局)
├── collection_session (全局)
├── feedback (全局)
├── user_{userid}_raw_data (动态表)
└── user_{userid}_raw_data_tags (动态表)
```

#### 新架构
```
green_tracker (元数据库)
├── users
├── user_databases (新增)
├── schema_versions (新增)
└── feedback

green_tracker_user_{userid} (每个用户独立数据库)
├── fields
├── devices
├── collection_sessions
├── raw_data
├── raw_data_tags
└── crop_objects (新增)
```

---

## 阶段一：核心组件开发

### 1.1 创建元数据表模型

**文件**: `backend/database/db_models/meta_model.py`

**内容**:
- `UserDatabase` - 用户数据库映射表
- `SchemaVersion` - Schema 版本管理表

**已完成**: ✅

---

### 1.2 创建用户数据库模型

**文件**: `backend/database/db_models/user_models.py`

**内容**:
- `Field` - 地块表
- `Device` - 设备表
- `CollectionSession` - 采集任务表
- `RawData` - 原始数据表
- `RawDataTag` - 原始数据标签表
- `CropObject` - 作物对象表

**已完成**: ✅

---

### 1.3 创建数据库连接管理器

**文件**: `backend/database/user_db_manager.py`

**功能**:
- 为每个用户维护独立的数据库连接池
- 懒加载连接
- 线程安全
- 连接统计和监控

**已完成**: ✅

---

### 1.4 创建用户数据库创建脚本

**文件**: `backend/database/create_user_database.py`

**功能**:
- 创建用户独立数据库
- 初始化表结构
- 启用 PostGIS 扩展
- 在元数据库中记录信息

**已完成**: ✅

---

### 1.5 创建数据库管理 API

**文件**: `backend/api/routes/admin_database.py`

**功能**:
- 列出所有用户数据库
- 获取指定用户数据库信息
- 创建用户数据库
- 删除用户数据库
- 测试数据库连接
- 同步数据库连接
- Schema 版本管理

**已完成**: ✅

---

### 1.6 创建迁移脚本

**文件**: `backend/database/migrate_to_user_databases.py`

**功能**:
- 将现有用户数据迁移到新数据库
- 数据验证
- 迁移回滚

**待创建**: ⏳

---

### 1.7 更新模型导入

**文件**: `backend/database/db_models/__init__.py`

**修改内容**:
```python
# 新增
from .meta_model import UserDatabase, SchemaVersion
from .user_models import Field, Device, CollectionSession, RawData, RawDataTag, CropObject
```

**待修改**: ⏳

---

### 1.8 更新 main.py

**文件**: `backend/main.py`

**修改内容**:
```python
# 新增导入
from api.routes import admin_database_router

# 注册路由
app.include_router(admin_database_router)  # /api/admin/database
```

**待修改**: ⏳

---

## 阶段二：用户数据库迁移

### 2.1 备份现有数据

**脚本**: `scripts/backup_current_database.sh`

**功能**:
- 导出所有表数据到 SQL 文件
- 备份 MinIO 数据

---

### 2.2 创建迁移脚本

**文件**: `backend/database/migrate_to_user_databases.py`

**功能**:
1. 获取所有用户列表
2. 为每个用户创建独立数据库
3. 迁移数据：
   - `field` → `user_database.fields`
   - `device` → `user_database.devices`
   - `collection_session` → `user_database.collection_sessions`
   - `user_{userid}_raw_data` → `user_database.raw_data`
   - `user_{userid}_raw_data_tags` → `user_database.raw_data_tags`
4. 数据验证
5. 生成迁移报告

---

### 2.3 数据验证

**检查项**:
- 记录数是否一致
- 外键关系是否正确
- 空间数据是否完整
- JSON 数据是否完整

---

### 2.4 执行迁移

**步骤**:
```bash
# 1. 备份数据
bash scripts/backup_current_database.sh

# 2. 创建元数据表
python -m database.db_builder.create_meta_tables

# 3. 执行迁移
python -m database.migrate_to_user_databases

# 4. 验证迁移结果
python -m database.validate_migration
```

---

## 阶段三：认证流程改造

### 3.1 修改用户注册流程

**文件**: `backend/api/routes/auth.py`

**修改内容**:
```python
@router.post("/register")
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # 1. 创建用户（在元数据库）
    new_user = create_user(db, user_data)

    # 2. 为用户创建独立数据库
    try:
        from database.create_user_database import create_user_database
        create_user_database(new_user.userid)
    except Exception as e:
        # 回滚用户创建
        db.delete(new_user)
        db.commit()
        raise HTTPException(status_code=500, detail=f"创建用户数据库失败: {str(e)}")

    return {"message": "用户注册成功", "user_id": new_user.userid}
```

---

### 3.2 修改 JWT Token

**文件**: `backend/api/routes/auth.py`

**修改内容**:
```python
# 在 Token 中包含用户数据库信息
token_data = {
    "sub": user.userid,
    "username": user.username,
    "db_name": get_user_database_info(user.userid)["database_name"]
}
```

---

## 阶段四：API 路由改造

### 4.1 修改依赖注入

**文件**: 所有 `backend/api/routes/*.py` 文件

**旧方式**:
```python
@router.get("/")
async def get_fields(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)  # 元数据库
):
    return get_fields_by_owner(db, current_user.userid)  # 需要 user_id
```

**新方式**:
```python
from database.user_db_manager import db_manager

@router.get("/")
async def get_fields(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(lambda: db_manager.get_db(current_user.userid))  # 用户数据库
):
    return get_all_fields(db)  # 不需要 user_id
```

---

### 4.2 修改 Service 层

**文件**: 所有 `backend/database/db_services/*.py` 文件

**修改原则**:
- 移除 `user_id` 参数（因为数据库已隔离）
- 移除表名动态拼接逻辑
- 使用统一的模型

**示例**:

**旧代码** (`field_service.py`):
```python
def get_fields_by_owner(db: Session, owner_id: str) -> List[Field]:
    return db.query(Field).filter(Field.owner_id == owner_id).all()
```

**新代码**:
```python
def get_all_fields(db: Session) -> List[Field]:
    # 数据库已隔离，无需过滤 owner_id
    return db.query(Field).filter(Field.is_active == True).all()
```

---

### 4.3 需要改造的文件清单

1. `backend/api/routes/field.py`
2. `backend/api/routes/device.py`
3. `backend/api/routes/collection_session.py`
4. `backend/api/routes/raw_data.py`
5. `backend/database/db_services/field_service.py`
6. `backend/database/db_services/device_service.py`
7. `backend/database/db_services/collection_session_service.py`
8. `backend/database/db_services/raw_data_service.py`
9. `backend/database/db_services/user_raw_data_service.py` (需要删除)

---

### 4.4 删除旧代码

**需要删除的文件**:
- `backend/database/db_builder/user_raw_data_table.py`
- `backend/database/db_builder/manage_user_tables.py`
- `backend/database/db_models/raw_data_model.py` (全局 raw_data 表，未使用)
- `backend/database/db_services/user_raw_data_service.py`

---

## 阶段五：清理与优化

### 5.1 删除旧表

**SQL 脚本**:
```sql
-- 删除所有用户级动态表
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'user_%_raw_data%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || r.tablename || ' CASCADE';
    END LOOP;
END $$;
```

---

### 5.2 性能测试

**测试项**:
1. 并发用户连接数测试
2. 数据库查询性能测试
3. 内存使用测试
4. 连接池效率测试

---

### 5.3 监控与告警

**添加监控指标**:
1. 活跃用户连接数
2. 每个数据库的连接池状态
3. 数据库存储使用量
4. 查询响应时间

---

### 5.4 文档更新

**需要更新的文档**:
1. `README.md`
2. `ENV_CONFIG.md`
3. `documents/database_redesign_v2.md`

---

## 执行计划

### 第1天
- [x] 创建元数据表模型
- [x] 创建用户数据库模型
- [x] 创建数据库连接管理器
- [x] 创建用户数据库创建脚本
- [x] 创建数据库管理 API
- [ ] 更新模型导入
- [ ] 更新 main.py
- [ ] 创建迁移脚本

### 第2天
- [ ] 备份现有数据
- [ ] 创建元数据表
- [ ] 执行数据迁移
- [ ] 数据验证

### 第3天
- [ ] 修改注册流程
- [ ] 修改登录流程
- [ ] 测试认证流程

### 第4-5天
- [ ] 修改所有 API 路由
- [ ] 修改所有 Service 层
- [ ] 测试所有接口

### 第6天
- [ ] 删除旧代码
- [ ] 性能测试
- [ ] 优化与监控
- [ ] 文档更新

---

## 风险与应对

### 风险1：数据丢失
**应对**:
- 执行前完整备份
- 迁移过程记录详细日志
- 保留回滚方案

### 风险2：性能下降
**应对**:
- 连接池优化
- 懒加载连接
- 分层连接池策略

### 风险3：用户访问中断
**应对**:
- 维护期间关闭注册
- 蓝绿部署
- 快速回滚机制

---

## 成功标准

1. ✅ 所有用户数据完整迁移
2. ✅ 所有 API 接口正常工作
3. ✅ 性能不下降或提升
4. ✅ 前端无需修改
5. ✅ 数据库管理 API 可用

---

## 下一步

开始执行 **阶段一：核心组件开发** 中的剩余任务：
1. 更新模型导入
2. 更新 main.py
3. 创建迁移脚本

准备好后，请告诉我继续！
