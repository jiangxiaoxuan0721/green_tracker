# Green Tracker 文档索引

按主题分层维护。改文档请同步本索引。

## setup/ — 环境与部署

- **[ENV_CONFIG.md](setup/ENV_CONFIG.md)** — 全部环境变量（前端 VITE_* 与后端）参考
- **[HTTPS_SETUP.md](setup/HTTPS_SETUP.md)** — Nginx + HTTPS 证书与双模式（dev/prod）渲染

## architecture/ — 架构与数据模型

- **[database_redesign_v2.md](architecture/database_redesign_v2.md)** — 数据库 v2 重设计方案（含历史迁移脚本记录）
- **[minio_documentation.md](architecture/minio_documentation.md)** — MinIO 对象存储设计与实现

## features/ — 功能专题

- **[algorithm_development_guide.md](features/algorithm_development_guide.md)** — 算法接入开发指南
- **[thumbnail_feature_guide.md](features/thumbnail_feature_guide.md)** — 图像缩略图链路

## ops/ — 运维操作

- **[screen_guide.md](ops/screen_guide.md)** — screen 会话日常操作

## plans/ — 设计与实施计划

- 结构规范化设计与实施计划（2026-09-15）

> 前端目录约定见 `frontend/README.md`；Nginx 配置说明见 `nginx/README.md`；样式规范见 `frontend/src/styles/README.md`。

> 历史文件 `cleanup_report_2026-01-27.md`、`migration_plan.md`、`registration_flow_testing.md` 已不存在，相关链接已清除。
