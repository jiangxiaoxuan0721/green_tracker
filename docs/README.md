# 📚 Green Tracker 文档索引

按主题分层维护。**改文档请同步本索引**，避免出现孤儿文档。
所有路径均为「仓库根目录/…」相对路径。

---

## 根目录入口文档

| 文档 | 说明 |
|------|------|
| [`README.md`](../README.md) | 项目总览：架构图、功能表、快速开始、make 命令 |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | 架构设计、数据模型与全量 API 路由清单 |
| [`DEVELOPMENT.md`](../DEVELOPMENT.md) | 本地开发、环境变量速查、质量门禁、排错 |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | 分支、提交、评审与文档约定 |
| [`CHANGELOG.md`](../CHANGELOG.md) | 版本变更记录 |

---

## `setup/` — 环境与部署

| 文档 | 说明 |
|------|------|
| [`env-config.md`](setup/env-config.md) | 全部环境变量（前端 `VITE_*` 与后端）参考 |
| [`https-setup.md`](setup/https-setup.md) | Nginx + HTTPS 证书与 dev/prod 双模式渲染 |

---

## `architecture/` — 架构与数据模型

| 文档 | 说明 |
|------|------|
| [`database_redesign_v2.md`](architecture/database_redesign_v2.md) | 数据库 v2 设计（**现行架构**：元数据库 + 每用户独立库） |
| [`minio_documentation.md`](architecture/minio_documentation.md) | MinIO 对象存储设计与实现 |

---

## `features/` — 功能专题

| 文档 | 说明 |
|------|------|
| [`algorithm_development_guide.md`](features/algorithm_development_guide.md) | 算法包开发指南（部署流程、包结构、`algorithm.yaml`、性能边界与排错） |
| [`api_key_permissions.md`](features/api_key_permissions.md) | API 密钥权限体系（三种权限、认证方式、接口与权限映射） |
| [`data_integrity.md`](features/data_integrity.md) | 原始数据 ↔ 对象存储一致性巡检（悬空记录体检与安全清理） |
| [`device_onboarding.md`](features/device_onboarding.md) | 设备端接入说明（签到与能力协商、指令接收/回执、撤销处理、排错） |
| [`thumbnail_feature_guide.md`](features/thumbnail_feature_guide.md) | 图像缩略图链路 |

---

## `ops/` — 运维操作

| 文档 | 说明 |
|------|------|
| [`screen_guide.md`](ops/screen_guide.md) | `screen` 会话日常操作 |

---

## `plans/` — 历史设计记录

| 文档 | 状态 |
|------|------|
| [`2026-09-15-structure-normalization-design.md`](plans/2026-09-15-structure-normalization-design.md) | ⚠️ Deprecated —— 结构规范化已实施完成，仅作历史决策记录；因代码注释引用而保留 |

> 本轮结构规范化的实施计划（`2026-09-15-structure-normalization-plan.md`）与
> 其余重构 plan / spec 已清理，不再保留。

---

## 子模块文档

| 文档 | 说明 |
|------|------|
| [`frontend/README.md`](../frontend/README.md) | 前端目录约定 |
| [`frontend/src/styles/README.md`](../frontend/src/styles/README.md) | 主题与样式规范 |
| [`frontend/src/pages/Dashboard/DataView/README.md`](../frontend/src/pages/Dashboard/DataView/README.md) | 数据视图模块说明 |
| [`nginx/README.md`](../nginx/README.md) | Nginx 配置与 dev/prod 前端模式 |

---

## 维护约定

- 新增文档请归入上述分层目录，并在本索引登记
- 文档内禁止出现绝对路径与本机用户名
- 徽章版本号取自 `frontend/package.json` 与 `backend/pyproject.toml`，勿手写
- `make` 命令描述必须与根目录 `Makefile` 的 target 一致
