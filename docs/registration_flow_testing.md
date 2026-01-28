# 用户注册流程测试指南

## 概述

本文档描述了用户注册到数据库创建的完整流程测试方法。

## 流程说明

### 注册流程

当用户注册时，系统会自动执行以下操作：

1. **创建用户记录** - 在元数据库中创建用户记录
2. **创建用户数据库** - 为用户创建独立的 PostgreSQL 数据库
3. **启用 PostGIS 扩展** - 从模板数据库继承 PostGIS 扩展
4. **创建数据表** - 在用户数据库中创建所有必要的数据表
5. **记录数据库信息** - 在元数据库中记录用户数据库信息

### 数据表列表

每个用户数据库包含以下表：
- `fields` - 地块表
- `devices` - 设备表
- `collection_sessions` - 采集任务表
- `raw_data` - 原始数据表
- `raw_data_tags` - 原始数据标签表
- `crop_objects` - 作物对象表

### PostGIS 扩展

用户数据库包含以下扩展：
- `postgis` - 空间数据支持
- `uuid-ossp` - UUID 生成
- `pg_trgm` - 模糊搜索支持

## 前置条件

### 1. PostgreSQL 服务运行

```bash
systemctl status postgresql
```

如果未运行：
```bash
sudo systemctl start postgresql
```

### 2. 数据库端口配置

确认 PostgreSQL 运行在 5433 端口：
```bash
cat /etc/postgresql/16/main/postgresql.conf | grep port
```

应该显示：
```
port = 5433
```

### 3. 环境配置

确保 `.env` 文件配置正确：
```bash
DB_HOST=localhost
DB_PORT=5433
DB_USER=green_tracker
DB_PASSWORD=green_tracker
DB_SUPERUSER=postgres
DB_SUPERPASSWORD=postgres
USE_UNIX_SOCKET=false
```

### 4. 模板数据库（方案一）

如果使用模板数据库方案，需要先初始化模板数据库：

```bash
sudo bash scripts/init_template_database.sh
```

### 5. 授予权限（方案二，可选）

如果使用超级用户方案，需要授予 green_tracker 用户 SUPERUSER 权限：

```bash
sudo bash scripts/grant_db_permissions.sh
```

## 测试方法

### 方法一：直接测试数据库创建（推荐用于调试）

测试 `create_user_database` 函数：

```bash
cd /home/jiangxiaoxuan/workspace/green_tracker
python tests/test_database_creation.py
```

这个脚本会：
1. 创建一个测试用户数据库
2. 验证数据库存在
3. 验证所有表已创建
4. 验证 PostGIS 扩展已启用
5. 验证元数据库记录存在
6. 测试插入数据
7. 询问是否清理测试数据

**优点**：
- 直接测试数据库创建逻辑
- 不需要启动后端服务
- 可以快速验证数据库配置

**缺点**：
- 不测试完整的注册 API 流程

### 方法二：测试完整注册流程（推荐用于集成测试）

测试完整的 API 注册流程：

```bash
# 1. 启动后端服务
cd backend
python main.py

# 2. 在另一个终端运行测试
cd /home/jiangxiaoxuan/workspace/green_tracker
python tests/test_registration_flow.py
```

这个脚本会：
1. 通过 API 注册用户
2. 验证数据库是否创建
3. 验证表是否创建
4. 验证 PostGIS 扩展是否启用
5. 验证 token 是否有效

**参数**：
```bash
# 自定义 API URL
python tests/test_registration_flow.py --url http://localhost:6130

# 测试完成后自动清理
python tests/test_registration_flow.py --cleanup
```

**优点**：
- 测试完整的注册流程
- 包含 API 层的测试
- 更接近实际使用场景

**缺点**：
- 需要启动后端服务
- 测试时间较长

### 方法三：手动测试 API

使用 curl 或 Postman 测试：

```bash
# 1. 注册用户
curl -X POST http://localhost:6130/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "Test123456"
  }'

# 2. 检查返回的 user_id 和 token
# 返回示例：
# {
#   "user_id": "550e8400-e29b-41d4-a716-446655440000",
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }

# 3. 验证 token
curl -X GET http://localhost:6130/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 方法四：使用数据库客户端验证

使用 psql 直接验证数据库：

```bash
# 1. 连接到 PostgreSQL
PGPASSWORD=green_tracker psql -h localhost -p 5433 -U green_tracker

# 2. 查看所有数据库
\l

# 3. 连接到用户数据库
\c green_tracker_user_YOUR_USER_ID

# 4. 查看所有表
\dt

# 5. 查看扩展
\dx

# 6. 查看表结构
\d fields
\d devices
\d collection_sessions
\d raw_data
\d raw_data_tags
\d crop_objects

# 7. 退出
\q
```

## 验证检查清单

完成测试后，使用以下检查清单验证：

### 数据库创建
- [ ] 用户数据库已创建（格式：`green_tracker_user_{user_id}`）
- [ ] 数据库属于 `green_tracker` 用户
- [ ] 数据库连接正常

### 数据表创建
- [ ] `fields` 表已创建
- [ ] `devices` 表已创建
- [ ] `collection_sessions` 表已创建
- [ ] `raw_data` 表已创建
- [ ] `raw_data_tags` 表已创建
- [ ] `crop_objects` 表已创建

### PostGIS 扩展
- [ ] `postgis` 扩展已启用
- [ ] `uuid-ossp` 扩展已启用
- [ ] `pg_trgm` 扩展已启用

### 元数据库记录
- [ ] `user_databases` 表中存在记录
- [ ] `user_id` 正确
- [ ] `database_name` 正确
- [ ] `is_active` 为 True
- [ ] `schema_versions` 表中存在版本记录

### API 响应
- [ ] 注册成功返回 `user_id` 和 `token`
- [ ] Token 验证成功
- [ ] 可以使用 token 访问受保护的端点

## 常见问题

### 1. 数据库创建失败

**错误**：`permission denied to create database`

**原因**：`green_tracker` 用户没有 `CREATEDB` 权限

**解决**：
```bash
sudo -u postgres psql -c "ALTER USER green_tracker CREATEDB;"
```

### 2. PostGIS 扩展创建失败

**错误**：`permission denied to create extension "postgis"`

**原因**：`green_tracker` 用户没有 `SUPERUSER` 权限

**解决（方案一）**：
```bash
sudo bash scripts/init_template_database.sh
```

**解决（方案二）**：
```bash
sudo -u postgres psql -c "ALTER USER green_tracker SUPERUSER;"
```

### 3. 连接失败

**错误**：`connection refused` 或 `could not connect to server`

**原因**：端口不匹配或服务未运行

**解决**：
```bash
# 检查服务状态
systemctl status postgresql

# 检查端口
netstat -tlnp | grep postgres

# 检查 .env 配置
grep DB_PORT .env
```

### 4. 表创建失败

**错误**：`relation already exists` 或 `cannot create table`

**原因**：表已存在或权限不足

**解决**：
```bash
# 删除现有数据库
sudo -u postgres psql -c "DROP DATABASE \"green_tracker_user_YOUR_USER_ID\";"

# 重新注册或运行测试
```

### 5. Token 验证失败

**错误**：`401 Unauthorized` 或 `Invalid token`

**原因**：Token 过期或无效

**解决**：
```bash
# 检查 SECRET_KEY 配置
grep SECRET_KEY .env

# 检查 JWT_ALGORITHM 配置
grep JWT_ALGORITHM .env

# 重新注册获取新 token
```

## 性能测试

### 批量创建测试

测试系统在批量创建用户时的性能：

```python
import time
from database.create_user_database import create_user_database

# 批量创建 100 个用户数据库
start_time = time.time()

for i in range(100):
    user_id = f"perf_test_{i}"
    create_user_database(user_id)
    print(f"Created database {i+1}/100", end='\r')

end_time = time.time()
print(f"\nTotal time: {end_time - start_time:.2f}s")
print(f"Average time per database: {(end_time - start_time) / 100:.2f}s")
```

## 清理测试数据

### 清理单个测试数据库

```python
from database.create_user_database import drop_user_database
from database.main_db import SessionLocal
from database.db_models.user_model import User

user_id = "YOUR_TEST_USER_ID"

# 1. 删除数据库
drop_user_database(user_id)

# 2. 删除用户记录
with SessionLocal() as db:
    user = db.query(User).filter(User.userid == user_id).first()
    if user:
        db.delete(user)
        db.commit()
```

### 清理所有测试数据库

```bash
# 连接到 PostgreSQL
PGPASSWORD=green_tracker psql -h localhost -p 5433 -U green_tracker

# 查看所有测试数据库
\l | grep test

# 删除所有测试数据库
DROP DATABASE IF EXISTS "green_tracker_user_test_user_1";
DROP DATABASE IF EXISTS "green_tracker_user_test_user_2";
# ...
```

## 总结

完成以上测试后，你应该能够：

1. ✓ 理解完整的注册流程
2. ✓ 验证数据库和表创建成功
3. ✓ 确认 PostGIS 扩展正常工作
4. ✓ 调试常见问题
5. ✓ 清理测试数据

如果所有测试都通过，说明用户注册流程已经正常工作！
