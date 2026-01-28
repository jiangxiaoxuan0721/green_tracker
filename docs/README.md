# Green Tracker 文档

本文档目录包含 Green Tracker 项目的所有设计文档、迁移指南和测试文档。

## 📚 文档目录

### 架构设计

- **[database_redesign_v2.md](database_redesign_v2.md)**
  - 当前数据库架构设计 v2.0
  - 独立用户数据库架构
  - 元数据库和用户数据库分离
  - 数据模型和关系

### 迁移和计划

- **[migration_plan.md](migration_plan.md)**
  - 从旧架构到新架构的迁移计划
  - 迁移步骤和验证方法
  - 回滚策略

### 测试文档

- **[registration_flow_testing.md](registration_flow_testing.md)**
  - 用户注册流程测试
  - 测试用例和预期结果
  - 验证方法

### MinIO 文档

- **[minio_documentation.md](minio_documentation.md)**
  - MinIO 对象存储配置
  - 文件上传下载
  - 最佳实践

## 🔧 快速链接

- [项目 README](../README.md)
- [环境配置](../ENV_CONFIG.md)
- [更新日志](../CHANGELOG.md)

## 📝 文档维护

### 更新规范

1. 所有文档应包含：
   - 文档标题和目的
   - 最后更新日期
   - 相关链接

2. 文档命名规范：
   - 使用小写字母和下划线
   - 使用描述性名称
   - 避免使用版本号（除非必要）

3. 过时文档：
   - 移动到 `archived/` 目录
   - 添加说明为何归档
   - 保留参考价值的内容

### 文档审查

- 每月审查一次文档的准确性
- 删除过时或不再需要的文档
- 更新有重大变更的文档

## 📞 联系方式

如有文档相关的问题或建议，请联系项目维护者。
