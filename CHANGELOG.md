# Green Tracker 更新日志

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/spec/v2.0.0.html)。

---

## [v2026.0923] - 2026-09-23

API 密钥引入三权限体系，设备远程控制形成「下发 → 投递 → 回执」闭环，
并按分层约定归置新增模块、补齐设备端接入文档。

### 新增

- **API 密钥三权限**：`data_upload` / `data_read` / `device_control`。
  唯一定义源 `backend/utils/permissions.py`，配套 `GET /api/api-keys/permissions`
  下发权限字典，前端与第三方不再硬编码权限含义
- **设备控制指令接口** `/api/device-commands`：`catalog`、`heartbeat`、
  `devices/{device_id}/grant`、下发、列表、`pending`、`{command_id}/result`、
  `{command_id}/cancel`、详情；指令定义与 MQTT 控制台共用 `backend/mqtt/command_defs.py`
- **设备上报制授权**：设备用密钥调用 `heartbeat` 建立「设备 → 密钥」软关联
  （用户库新表 `device_key_bindings`），云端据此判定该设备能否被远程控制；
  JWT 控制台与 API 密钥走同一套判定，结论一致
- **指令双通道投递**：MQTT 在线实时下发，离线落为 `pending` 由设备 HTTP 轮询取走；
  密钥被删除 / 禁用 / 去掉 `device_control` 时自动下发 `revoke_control`
- **统一认证体** `AuthPrincipal` + `RequirePermission`：收敛 JWT（账号全权）与
  `X-API-Key`（逐项校验）两条鉴权路径，替换 `raw_data` / `collection_session` 中的旧写法
- **用户库新表** `device_commands`、`device_key_bindings`：纳入模板库建表清单、
  新建库校验与启动期自动迁移
- **设备端接入文档** `docs/features/device_onboarding.md`

### 改进

- **后端分层规范化**：权限定义下沉至 `backend/utils/permissions.py`（消除
  `database → api` 反向依赖）；设备控制授权守卫归入 `backend/api/dependencies.py`；
  密钥撤销通知归入 `database/db_services/device_revoke_service.py`
- **前端结构收敛**：`DataUpload` 独立页面合并为 `DataView` 内的 `DataUploadDialog` 弹窗；
  登录 / 注册页品牌展示面板抽取为 `AuthBrandPanel` 公共组件
- **修正建库补表逻辑**：`create_user_database.py` 的补表分支原会引用未导入的
  `DeviceCommand` 且漏掉新表，改为「表名 → 模型」映射统一校验补建
- **启动期迁移补齐** `device_key_bindings`：`migrate_user_databases()` 此前只补
  `device_commands`，存量用户库设备签到写关联会失败，控制台一直提示「尚未上报密钥」

### 文档

- 新增 `docs/features/device_onboarding.md`（签到与能力协商、指令接收 / 回执、撤销处理、排错）
- 修正 `docs/features/api_key_permissions.md`：删除「`device_control` 必须绑定设备、
  否则返回 400」的错误口径，补充 `heartbeat` / `grant` 接口与 `device_key_bindings` 表
- `ARCHITECTURE.md` 补充共享依赖层、`/api/device-commands` 全量路由与授权口径
- `docs/README.md` 索引登记两篇新文档

---

## [v2026.0919] - 2026-09-19

采集任务支持指定执行设备并引入超期自动完成调度；设备在线统计口径与设备列表对齐；
数据分析看板图表整体紧凑化，并支持点击放大查看详情。

### 新增
- **采集任务指定执行设备**: `CollectionSession` 新增 `device_id` 字段（`NULL` = 不限设备，有值 = 仅该设备可执行），
  创建/更新走 `Device` 存在性校验（设备不存在返回 400）；更新时用 `_UNSET` 哨兵区分「未传该字段（保持原样）」
  与「显式传 `null`（取消指定）」
- **设备侧任务下发**: `POST /active_sessions` 语义由「返回所有活跃任务」改为「返回该设备可执行的任务」，
  设备通过 `?device_id` 或 `X-Device-Id` 请求头自报身份，校验存在性（不存在返回 404）
- **地块最新采集任务接口**: `GET /collection-sessions/field/{field_id}/latest`，支持按 `mission_type` 过滤
- **列表分页总数**: 新增 `count_collection_sessions_with_field_info()`，与列表共用 `_build_collection_session_filters()`，
  避免列表与计数条件漂移；总数经 `X-Total-Count` 响应头返回（CORS 已 `expose_headers`），
  前端新增 `getSessionsWithPagination()` 读取
- **超期任务自动完成调度**: 新增 `backend/scheduler/session_auto_complete.py` 守护线程，
  每 60s 扫描活跃用户库（`SESSION_AUTO_COMPLETE_INTERVAL` 可配，最小 10s；`SESSION_AUTO_COMPLETE_ENABLED=false` 可关闭），
  把 `end_time` 已过且仍为 `planned` / `running` 的任务置为 `completed`；读接口另有一层兜底执行，
  调度未启动也不影响查询，`start()` 幂等、`stop()` 优雅退出
- **图表放大查看**: 数据分析页时序图与数据分布图支持点击放大，`ChartDetailModal` 内展示大尺寸渐变面积图
  （带 Brush 时间轴缩放）或带数值标签的柱状图，并给出数据点数 / 平均值 / 最值 / 时间范围摘要
- **系统操作日志**: 全链路操作审计日志系统，覆盖认证、设备、地块、采集会话、数据、API密钥、算法等 23 个关键操作点
- **日志查询与导出**: 支持按级别/来源/日期筛选、分页查询和 CSV 导出
- **MQTT 模块**: IoT 设备实时通信支持
- **开发/生产双模式部署**: Nginx 支持一键在「Vite 热加载（开发）」与「静态成品 dist/（生产）」之间切换
  （`make serve-dev` / `make serve-prod` / `make deploy` / `make mode`）
- **密钥管理路由**: 补齐 `/dashboard/api-keys` 页面路由与侧边栏菜单入口
- **算法构建流式订阅**: 上传算法包后服务端自动触发镜像构建并返回 `task_id` + `stream_url`，
  前端 `useDeployTasksStore.attachExisting` 直接复用后端 task 订阅 NDJSON 构建日志，零额外请求
- **算法下载进度条 & Toast 化**: 上传弹窗新增 `onUploadProgress` 进度反馈；所有失败提示统一走 `useToast`

### 改进
- **数据分析图表紧凑化**: 图表区整体压缩到约原尺寸的 2/3——时序网格由 3 列改 4 列（窄屏逐级降为 3 / 2 / 1 列），
  `gap` 与卡片内边距收紧，消除 `.chart-card` 与 `.card-content` 的双重内边距，图表高度 220 → 150；
  分布条形图行高 32px → 18px，数值移到条形右侧固定列，不再压在色条上
- **数据分布与统计明细同行**: 两个区块并入 `.analyze-duo` 两列布局（分布 `1fr` / 明细 `1.7fr`，等高对齐），
  窄屏（≤1024px）降为单列
- **采集会话详情重构**: `SessionDetail` 重写为 `sd-` 前缀的自包含分区卡片（任务信息 / 时间安排 / 描述 / 环境快照 + 底部操作区），
  CSS 不再与全局 `.modal-*` 互相覆盖；结束时间缺席时按状态显示「进行中」或「未记录」，不再一律「未设置」
- **Sessions 列表实时性**: 新增 30 秒轮询（页面不可见时跳过），与后端自动完成调度配合同步任务状态；
  并用 `appliedFiltersRef` / `refreshContextRef` 避免闭包拿到过期的页码与筛选条件
- **筛选查询态**: `FilterPanel` 触发查询后到结果返回前，`DataTable` 显示「正在查询...」占位（含 `querying` 态样式），
  与真正的「暂无数据」区分开来；期间分页信息弱化展示，避免把上一次结果的总数误读为本次结果
- 日志表格宽度优化，消息列占位更充分
- **数据分析页重构**: 自研的 `analysis-controls` 替换为 `FilterPanel` + `FilterSelect` / `FilterMultiSelect`（时间范围、数据大类、
  监测指标、采集设备、采集任务），并补齐重置入口；顶部 4 张并列 `stat-card` 收敛为一条 `StatsBar` 四合一统计栏
  （数据记录 / 涉及任务 / 覆盖指标 / 涉及设备 + 统计区间）
- **分析筛选逻辑修正**: 设备选择此前完全未参与查询，现通过 `session.device_id` 落到 `session_ids`；空选表示「不限」，
  设备与任务为「与」关系；筛选无命中任务时不再退化成「查全部」，改为空结果 + 提示条
- **分析图表按需渲染**: 时序图只渲染真正有数据的指标，不再固定渲染 8 张空卡片；统计明细改用 `DataTable`
- **`MinioClient` API 收敛**: 新增 `iter_object` / `stat_object_size` 公开方法，下载路由不再直访 `_client` 私有属性
- **`minio_client` 惰性代理**: `from storage.minio_client import minio_client` 改为 `_LazyMinioProxy`，
  后端启动不再因 MinIO 不可达而失败；运行时访问才连接

### 修复
- **在线设备数统计口径**: 概览统计与 MQTT `/stats` 此前直接取 MQTT 管理器的全局在线数，可能出现「在线数 > 设备总数」；
  现统一走 `count_devices_online_status()`，以用户活跃设备为分母、与设备列表/详情的 `online` 同源，
  保证「在线 + 离线 == 设备总数」（用户库不可用时仍降级为 MQTT 侧统计）
- **任务状态流转按钮**: `SessionDetail` 的「开始任务 / 完成任务」此前调用 `onEdit(id, newStatus)`，
  只会弹出编辑框而不会改变状态；现改为独立的 `onUpdateStatus` 回调，未传该回调则不渲染按钮
- **Sessions 分页参数**: `page` / `page_size` 改为后端约定的 `limit` / `offset`，总数改读 `X-Total-Count`；
  同时修复首屏加载后因筛选 effect 触发的重复请求，以及删除末页数据后页码越界不回退的问题
- **采集列表设备信息**: 列表查询改为 `outerjoin Device` 并带出 `device_id` / `device_name`；
  `device_name` 不再恒为「未知设备」，可区分「未指定（所有设备可执行）」与「指定过但设备已删除」
- **首页路由**: 项目主页正确挂载于根路径 `/`
- **API 基础路径**: `VITE_API_BASE_URL` 统一为空 origin 前缀（不含 `/api`）、`VITE_MINIO_PUBLIC_URL` 统一为相对路径（`/minio/<bucket>`），
  开发经 Vite proxy、生产经 Nginx 反代，避免端口号暴露与 HTTPS 混合内容问题
- **登录 404 修复**: 因 `VITE_API_BASE_URL` 误设为 `/api`，与调用点自带的 `/api` 前缀重复，导致所有请求变成 `/api/api/...`，
  现已在 `api.ts`、`environment.js`、`utils/env.ts`、`AlgorithmSquare/AlgorithmUse` 统一改为空 origin
- **静态资源配置**: 生产片段对 `/api/` 使用 `^~` 前缀修饰符，避免被静态资源正则误捕获
- **算法压缩包大小上限**: 由 10 MB 放宽到 **1 GB**（覆盖大型 ML 模型 + 依赖 + 数据集打包场景）。
  生效路径为**仓库根目录 `.env` 的 `VITE_MAX_FILE_SIZE`**——因 `vite.config.js` 配置 `envDir: projectRoot`，
  前端只读根目录 `.env`，而环境变量会覆盖 `config/env.ts` 的默认值，故仅改默认值无效（首轮踩坑）。
  同时后端补齐 1 GB 流式上传：`upload_file` 支持 file-like + length，路由不再 `await file.read()`
  全量驻留内存（原先 1 GB 包峰值约 2 GB），并在应用层做 413 硬上限兜底；
  nginx `client_max_body_size 0` + `proxy_request_buffering off` + 600s 超时已就绪
- **算法上传闭环 (P0.1)**: 上传成功后接口"假装"成功却不触发构建；现上传流程与「提交构建」共用 `_submit_build_for`，
  200 返回即 build task 已起
- **UUID 双重来源 (P0.2)**: `Algorithm.uuid` 与 MinIO 路径前缀不一致；现统一由路由预生成 `algorithm_uuid`，
  `minio_path = {uuid}/{filename}` 闭环一致
- **容器命名碰撞 (P0.3)**: `ContainerManager.remove_container` 内部仍用 `uuid[:8]` 截断命名，存在重建同前缀算法时停错容器隐患；
  现统一走 `self.container_name(uuid)`（含本批次的 `dockerfile_generator.generate_docker_compose` 内 dead-code 整体删除）
- **删除算法泄漏 (P1.1)**: 删除时仅删 DB，遗留 MinIO 对象 / 容器 / 镜像；
  现级联清理容器（`remove_container`）+ 镜像（`docker rmi -f`）+ MinIO 对象，失败仅 warning 不阻塞 DB 删除
- **响应字段重复构造 (P1.2)**: 4 处 17 字段 `AlgorithmResponse` 重复构造；现统一走 `_algorithm_to_response(algorithm)` helper
- **前端 alert() 滥用 (P1.3)**: `AlgorithmSquare.jsx` 全部 `alert()` → `addToast()`（已 `search_content \balert\(` 命中 0 验证）
- **路由 try/except 模板 (P1.4)**: 8 处重复 `try/except/raise` 模板；现抽象为 `_standard_errors(action_name)` 装饰器

### 技术升级
- 新增 `backend/scheduler/` 后台调度包（首个调度任务：采集会话超期自动完成），
  由 `backend/main.py` 的 startup / shutdown 事件启停，启动失败不影响主应用
- `.env.example` 新增 `SESSION_AUTO_COMPLETE_ENABLED`（默认 `true`）与 `SESSION_AUTO_COMPLETE_INTERVAL`（默认 60，最小 10）
- `scripts/render_nginx.sh`: 统一 Nginx 配置渲染与前端模式切换（dev/prod），主站配置与前端片段解耦

### 文档
- **`docs/features/algorithm_development_guide.md` 重写**为面向算法开发者的「算法包开发指南」：补齐部署流程总览、
  性能边界（包体 1 GB、容器内存 4 GB、单次推理 60s、端口池 8001–9999、单 worker 串行）、部署状态机与构建日志、
  排错清单与发布检查清单；并纠正容器内端口（8001 → 固定 8000）、`requirements.txt` 由「可选」改为「必需」
  （须含 fastapi / uvicorn / python-multipart）、推理接口须用同步 `def` 以免阻塞 `/health`
- `ARCHITECTURE.md` 补充「后台调度 `backend/scheduler`」目录、`GET /field/{field_id}/latest` 接口，
  以及分页约定（`limit/offset` + `X-Total-Count`）、设备下发规则（`device_id` / `X-Device-Id` / `ON DELETE SET NULL` 回退）、
  超期自动完成三节说明
- README 新增「开发环境 vs 生产部署」章节，更新 Makefile 命令与项目结构说明
- **文档体系重构**：根目录收敛为 `README.md` / `ARCHITECTURE.md` / `DEVELOPMENT.md` / `CONTRIBUTING.md` / `CHANGELOG.md` 五篇入口文档，专题文档归入 `docs/` 的 `architecture/` `features/` `ops/` `setup/` 分层目录
- 新增 `ARCHITECTURE.md`（运行时拓扑、分层、数据模型与全量 API 路由清单）、
  `DEVELOPMENT.md`（本地开发、覆盖 `.env.example` 全部参数的环境变量表、质量门禁与排错）、`CONTRIBUTING.md`
- 重写 `README.md`：徽章版本号改为读取 `frontend/package.json` 与 `backend/pyproject.toml` 真值；
  快速开始步骤与 `Makefile` target 严格对齐；补充架构图、11 个功能模块表、make 命令表与文档导航
- `docs/README.md` 改写为文档索引，为每篇文档提供入口链接（含 `frontend/`、`nginx/` 子模块文档）
- 统一文档命名风格：`docs/setup/ENV_CONFIG.md` → `env-config.md`、`HTTPS_SETUP.md` → `https-setup.md`
- 清理已完成的重构计划：`docs/plans/2026-09-15-structure-normalization-plan.md`、
  `docs/superpowers/plans/` 与 `docs/superpowers/specs/` 下的 2026-09-16 plan / spec
- `docs/plans/2026-09-15-structure-normalization-design.md` 标记 **Deprecated**：
  结构规范化已实施完成，因 `frontend/src/components/ui/ToastContainer.jsx` 注释仍引用其 Toast 契约而保留

### 待办
- 仓库根目录补 `LICENSE` 文件（MIT）；`backend/pyproject.toml` 已声明 MIT，但实际文件缺失

---

## 2026-04-12 - UI/UX 全面优化 (第二阶段)

### 重点优化

#### **数据上传页面 (DataUpload)**

- ✅ 完全重新设计的上传界面，移除层层折叠的树形结构
- ✅ 采用步骤条导航：选择会话 → 选择数据类型 → 上传数据
- ✅ 会话选择改为卡片网格展示，带悬浮效果
- ✅ 数据类型选择使用彩色图标卡片
- ✅ 子类型改为胶囊标签按钮
- ✅ 所有元素使用矩形圆角（去掉椭圆形）
- ✅ 步骤条始终显示在顶部
- ✅ 视图切换标签支持快速切换到密钥管理

#### **密钥管理页面 (KeyManagement)**

- ✅ 紧凑型表格设计，减少行高和间距
- ✅ 优化模态框尺寸和布局
- ✅ 统一的加载状态动画
- ✅ 权限标签和状态徽章更紧凑

#### **首页 (Home) 和 登录页 (Login)**

- ✅ 保持第一阶段优化的动画效果
- ✅ 响应式设计持续优化

---

## 2026-04-09 - UI/UX 全面优化 (第一阶段)

### 新增
- **UI动画系统**: 引入Framer Motion库，为所有页面添加流畅的动画效果
- **增强加载组件**: 新的加载动画、骨架屏和进度条组件
- **状态管理组件**: 统一的加载、错误、空状态显示组件
- **动画工具库**: 预定义的动画变体和缓动函数

### 改进
- **算法广场UI**: 重构按钮布局，采用"主操作+菜单"的现代化设计
- **响应式设计**: 所有页面增强移动端体验
- **可访问性**: 改进键盘导航和屏幕阅读器支持

### 修复
- **算法部署端口**: 修复算法容器内部端口硬编码问题
- **下载API认证**: 算法包下载现在支持公开访问，无需认证
- **重启逻辑**: 修复算法容器重启时的镜像检查问题

---

## 早期版本

### 2026-04-08 - 算法部署功能完善
- 修复算法容器端口映射问题
- 改进Docker镜像构建流程
- 修复算法重启和停止功能
- 优化算法广场UI交互

### 2026-04-07 - 多主题系统发布
- 新增6种精美主题：默认黑蓝、明亮模式、深色模式、薄荷绿、日落橙、天空蓝
- 实现主题实时切换功能
- 优化响应式设计，支持移动设备

### 2026-04-06 - 基础功能上线
- 用户认证系统（注册/登录）
- 设备管理模块
- 地块管理模块
- 数据采集与可视化
- API密钥管理系统

---

## 版本规划

### v1.0.0 (规划中)
- ✅ 稳定的UI/UX设计
- ✅ 完整的设备管理功能
- 🔄 实时数据推送 (WebSocket)
- 🔄 高级报表和分析功能
- 🔄 精细化的权限系统

### v0.9.x (当前)
- 核心功能稳定版本
- UI/UX优化完善 (两阶段)
- 性能和安全改进

---

**注意**: 项目仍处于活跃开发阶段，API和界面可能发生变化。
