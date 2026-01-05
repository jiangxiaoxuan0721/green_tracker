# 变更日志 (CHANGELOG)

本文档记录 Green Tracker 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中
- 数据导出功能
- 实时数据推送（WebSocket）
- 移动端App开发
- 多语言支持
- 数据报表生成
- 更多数据分析工具
- 用户权限管理细化

## [0.16.0]

## [0.15.0]

### 新增

#### 全栈架构
- 重构为全栈架构（React + FastAPI）
- 集成PostgreSQL数据库
- 添加PostGIS空间数据支持
- 集成MinIO对象存储服务

#### 地块管理
- 地块列表管理
- 地块地理信息（PostGIS）
- 地块信息编辑
- 地块详情查看
- 地块创建/更新/删除

#### 设备管理
- 设备列表管理
- 设备信息查看
- 设备状态监控
- 设备详情查看
- 设备创建/编辑/删除

#### 数据管理
- 采集会话管理模块
- 原始数据管理
- 数据分析模块
  - 数据图表可视化
  - 趋势分析
  - 多维度数据对比
- 数据视图优化
  - 原始数据列表展示
  - 数据详情查看
  - 数据筛选和搜索

#### 系统功能
- JWT认证授权系统
- 反馈系统
- 日志查看功能
  - 系统日志展示
  - 操作记录追踪
  - 错误日志查看
- Makefile管理脚本
  - `make install` - 安装所有依赖
  - `make start` - 启动所有服务
  - `make dev` - 开发模式
  - `make stop` - 停止所有服务
  - `make clean` - 清理临时文件和容器
- Docker容器化MinIO服务

#### API端点
- `/api/auth` - 用户认证
- `/api/fields` - 地块CRUD操作
- `/api/devices` - 设备CRUD操作
- `/api/collection-sessions` - 数据采集会话管理
- `/api/raw-data` - 原始数据管理
- `/api/feedback` - 用户反馈收集

#### 数据库模型
- User - 用户表
- Field - 地块表（包含地理位置几何字段）
- Device - 设备表
- CollectionSession - 采集会话表
- RawData - 原始数据表
- RawDataTag - 原始数据标签表
- Feedback - 反馈表

### 技术栈更新

#### 后端
- FastAPI 0.124.4 - 高性能异步Web框架
- Python 3.8+
- SQLAlchemy 2.0.45 - ORM框架
- GeoAlchemy2 0.18.1 - 空间数据支持
- Uvicorn 0.38.0 - ASGI服务器
- PostgreSQL - 关系型数据库
- PostGIS - 地理空间扩展
- MinIO - 对象存储服务
- JWT认证 - 用户认证授权

#### 文档
- 数据库迁移指南
- MinIO文档
- 用户原始数据指南
- 环境配置说明

## [0.14.0]

### 新增
- 基础Dashboard界面
- 6种主题系统
  - 默认黑蓝主题
  - 明亮模式
  - 深色模式
  - 薄荷绿主题
  - 日落橙主题
  - 天空蓝主题
- 用户认证系统
- 响应式设计
- 可折叠面板功能
- 前端技术栈
  - React 18.2.0
  - Vite 5.0.8
  - React Router 6.8.0
  - Axios 1.6.0

### 功能
- 实时数据展示
- 控制面板（可收起）
- 快速操作面板
- 主题切换功能
- 用户登录/注册
- 登录状态持久化
- 受保护的路由

---

## 版本说明

- **[Unreleased]** - 计划中的功能和变更
- **[0.15.0]** - 当前版本
- **[0.14.0]** - 上一个版本

## 变更类型

- **新增** - 新增功能
- **更改** - 对现有功能的更改
- **弃用** - 即将移除的功能
- **移除** - 已移除的功能
- **修复** - Bug修复
- **安全** - 安全相关的改进
