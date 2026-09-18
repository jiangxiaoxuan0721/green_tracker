# Green Tracker 更新日志

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/spec/v2.0.0.html)。

---

## [未发布]

### 新增
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
- 日志表格宽度优化，消息列占位更充分
- **`MinioClient` API 收敛**: 新增 `iter_object` / `stat_object_size` 公开方法，下载路由不再直访 `_client` 私有属性
- **`minio_client` 惰性代理**: `from storage.minio_client import minio_client` 改为 `_LazyMinioProxy`，
  后端启动不再因 MinIO 不可达而失败；运行时访问才连接

### 修复
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
- `scripts/render_nginx.sh`: 统一 Nginx 配置渲染与前端模式切换（dev/prod），主站配置与前端片段解耦

### 文档
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
