# 测试说明

本目录包含 Green Tracker 项目的测试脚本。

## 测试文件

### 1. quick_test.sh
快速配置验证脚本，检查数据库连接和权限。

**使用方法：**
```bash
bash tests/quick_test.sh
```

**检查内容：**
- PostgreSQL 连接
- 超级用户连接
- 用户权限
- 模板数据库存在性
- PostGIS 扩展

### 2. test_database_creation.py
直接测试 `create_user_database` 函数，不需要启动后端服务。

**使用方法：**
```bash
python tests/test_database_creation.py
```

**测试内容：**
- 创建用户数据库
- 验证数据库存在
- 验证所有表已创建
- 验证 PostGIS 扩展已启用
- 验证元数据库记录存在
- 测试插入数据

**优点：**
- 快速，不需要启动服务
- 直接测试数据库创建逻辑
- 适合开发调试

### 3. test_registration_flow.py
测试完整的 API 注册流程，需要后端服务运行。

**使用方法：**
```bash
# 启动后端服务（在另一个终端）
cd backend
python main.py

# 运行测试
python tests/test_registration_flow.py
```

**参数：**
```bash
# 自定义 API URL
python tests/test_registration_flow.py --url http://localhost:6130

# 测试完成后自动清理
python tests/test_registration_flow.py --cleanup
```

**测试内容：**
- 通过 API 注册用户
- 验证数据库是否创建
- 验证表是否创建
- 验证 PostGIS 扩展是否启用
- 验证 token 是否有效

**优点：**
- 测试完整的注册流程
- 包含 API 层测试
- 更接近实际使用场景

### 4. test_user_database_creation.py
用户数据库创建测试（旧版本，已保留但推荐使用 test_database_creation.py）

**使用方法：**
```bash
python tests/test_user_database_creation.py
```

## 测试流程

### 完整测试流程

1. **快速验证配置**
   ```bash
   bash tests/quick_test.sh
   ```

2. **测试数据库创建**
   ```bash
   python tests/test_database_creation.py
   ```

3. **启动后端服务**
   ```bash
   cd backend
   python main.py
   ```

4. **测试完整注册流程**
   ```bash
   python tests/test_registration_flow.py
   ```

### 快速测试流程（开发时使用）

1. **快速验证配置**
   ```bash
   bash tests/quick_test.sh
   ```

2. **测试数据库创建**
   ```bash
   python tests/test_database_creation.py
   ```

## 前置条件

### 1. PostgreSQL 服务运行

```bash
systemctl status postgresql
```

如果未运行：
```bash
sudo systemctl start postgresql
```

### 2. 环境配置

确保 `.env` 文件配置正确：
```bash
DB_HOST=localhost
DB_PORT=5433
DB_NAME=green_tracker
DB_USER=green_tracker
DB_PASSWORD=green_tracker
DB_SUPERUSER=postgres
DB_SUPERPASSWORD=postgres
USE_UNIX_SOCKET=false
```

### 3. 模板数据库（推荐）

如果使用模板数据库方案：
```bash
sudo bash scripts/init_template_database.sh
```

### 4. 授予权限（可选）

如果使用超级用户方案：
```bash
sudo bash scripts/grant_db_permissions.sh
```

## 常见问题

### 1. 连接失败

**错误**：`connection refused`

**解决**：
- 检查 PostgreSQL 服务状态：`systemctl status postgresql`
- 检查端口配置：`cat /etc/postgresql/16/main/postgresql.conf | grep port`
- 检查 `.env` 配置：`grep DB_PORT .env`

### 2. 权限不足

**错误**：`permission denied to create database`

**解决**：
```bash
sudo bash scripts/grant_db_permissions.sh
```

### 3. PostGIS 扩展失败

**错误**：`permission denied to create extension "postgis"`

**解决（方案一）**：
```bash
sudo bash scripts/init_template_database.sh
```

**解决（方案二）**：
```bash
sudo -u postgres psql -c "ALTER USER green_tracker SUPERUSER;"
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

### 使用测试脚本自动清理

```bash
# 方法一：test_database_creation.py 会询问是否清理
python tests/test_database_creation.py

# 方法二：test_registration_flow.py 使用 --cleanup 参数
python tests/test_registration_flow.py --cleanup
```

## 相关文档

- [注册流程测试指南](../docs/registration_flow_testing.md)
- [PostGIS 扩展修复方案](../docs/postgis_extension_fix.md)
- [清理总结](../docs/cleanup_summary.md)

## 测试最佳实践

1. **开发时**：使用 `quick_test.sh` 和 `test_database_creation.py` 快速验证
2. **集成测试**：使用 `test_registration_flow.py` 测试完整流程
3. **发布前**：运行所有测试，确保流程完整
4. **定期清理**：及时清理测试数据，避免数据库膨胀
5. **查看日志**：关注测试日志，快速定位问题

## 扩展测试

### 添加新测试

在 `tests/` 目录下创建新的测试文件：

```python
"""
测试描述
"""
import sys
from pathlib import Path
import logging

# 添加 backend 目录到 Python 路径
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_something():
    """测试某个功能"""
    logger.info("开始测试...")
    # 测试逻辑
    logger.info("测试完成")


if __name__ == "__main__":
    test_something()
```

### 测试模板

参考现有的测试文件创建新的测试：
- `test_database_creation.py` - 数据库创建测试模板
- `test_registration_flow.py` - API 流程测试模板
