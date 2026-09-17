# 结构规范化设计（Scope B）

- 日期：2026-09-15
- 状态：已批准
- 范围：Scope B —— 结构规范化（中风险）
- 推进策略：**先修复（立护栏 + 修真实缺陷），再搬家（结构迁移）**

---

## 1. 背景与动因

本次工作源于一个线上 404 故障，排查中发现该故障只是"结构性隐患"的一个表象。

### 1.1 404 故障结案

前端登录报 `POST /api/auth/login → 404`。逐层验证结果：

| 请求 | 结果 | 结论 |
|---|---|---|
| `POST http://localhost:6130/api/auth/login` | 422 | 后端路由存在，仅空 body 校验失败 |
| `GET http://localhost:6130/health` | 200 | 后端正常运行（uvicorn 127.0.0.1:6130） |
| `POST https://localhost/api/auth/login`（经 Nginx） | 422 | Nginx 反代正常 |
| `POST https://localhost/api/api/auth/login` | 404 | **即上报现象** |

**根因**：`.env` 中 `VITE_API_BASE_URL` 被填为 `/api`，而代码中所有调用方路径已自带 `/api/...` 前缀，拼接后形成 `/api/api/auth/login`。

**当前状态**：`.env` 已改为空值，Vite 注入 `VITE_API_BASE_URL: ""`，`frontend/dist` 中亦无 `/api/api` 残留，故障已不复现。

**遗留问题**：配置层**没有任何防护**。任何一次误填 `/api` 都会立即复现故障，且报错信息（404）与真实原因（配置错）相距甚远，排查成本高。这是本次结构优化必须根治的点。

### 1.2 审计发现的结构性问题

经全仓只读审计，归纳为 6 类：

1. **环境变量封装重复**：同一语义值 `VITE_API_BASE_URL` 有 5 处读取（`config/environment.js:37`、`utils/env.ts:7`、`services/api.ts:5`、`AlgorithmSquare.jsx:11`、`AlgorithmUse.jsx:9`），其中 2 处为死代码；`vite-env.d.ts` 存在两份完全相同的副本。
2. **扩展名混用无约定**：同一目录内 `.js` / `.ts` / `.tsx` 并存（`services/`、`hooks/`、`contexts/`）。
3. **桶文件（barrel）层不健康**：3 个零引用死 barrel；12 个单文件转发 barrel；1 处缺失 barrel 造成特例；`pages/index.js` 的 `export * as` + 解构写法无法被静态检查拦截（`KeyManagement is not defined` 崩溃的成因）。
4. **零质量门禁**：`package.json:9` 声明了 `npm run lint`，但仓库**不存在任何 ESLint 配置**（`search_file` 零命中），该命令必然失败；TypeScript 未安装，`tsconfig.json` 的 `strict` 形同虚设；项目无任何测试。
5. **路由/命名同名歧义**：根 `mqtt/`（Broker 部署物）与 `backend/mqtt/`（应用模块）同名。
6. **部署产物与生效配置脱节**：仓库内 3 份 Nginx 渲染产物，其中 1 份已废弃；真正生效的是手工安装的 `/etc/nginx/sites-available/green-tracker`；而 `scripts/nginx.sh mode` 检测的是 `/etc/nginx/snippets/green-tracker-frontend.conf`，导致模式查询**永远失败**。

---

## 2. 目标与非目标

### 2.1 目标

- 让"同一语义只存在一处定义"，尤其环境变量与 API 基址。
- 让配置误填**不再产生双前缀**（从"靠人记住"变为"结构上不可能"）。
- 为前端建立可运行的质量门禁（ESLint + TypeScript），使"未定义变量""类型不符"这类缺陷在**提交前**暴露。
- 目录与命名具备可陈述、可执行的约定，并写入文档。
- 修复审计中发现的真实缺陷（脚本不可用、依赖清单不完整等）。
- 文档结构分层，索引无失效引用。

### 2.2 非目标

- **不拆分大文件**：`AlgorithmSquare.jsx`（约 700 行）等保持现状，文件级拆分另立任务。
- **不改业务逻辑**：除明确列出的缺陷修复外，不变更运行时行为。
- **不改后端代码结构**：`backend/` 的模块划分保持不动，仅处理依赖清单与既有缺陷。
- **不引入测试框架**：仅建立冒烟脚本，不引入 pytest/vitest 等测试体系。

---

## 3. 已确认的决策

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 优化深度 | Scope B：结构规范化（中风险） |
| D2 | 推进策略 | 先立护栏/修缺陷，再做结构迁移（分阶段推进） |
| D3 | `services/` 后缀 | 统一为 `.ts`，补齐请求/响应 DTO 类型，并接入 `tsc --noEmit` 门禁 |
| D4 | `mqtt` 同名歧义 | 根 `mqtt/` 重命名为 `mqtt-broker/` |
| D5 | 执行方式 | 分阶段改动 + 每阶段独立提交 + 执行回归验证 |
| D6 | ESLint 配置 | **纳入**（新增可运行的 ESLint 配置） |
| D7 | Toast 陷阱 API | 纳入修复，但**默认渲染结果不变**：`ToastContainer` 真正接收 `position` / `duration` 可选 props；`App.jsx` 无参调用行为保持不变 |

---

## 4. 目标结构

```
green_tracker/
├─ backend/                     # 保持现状（仅依赖清单修复）
├─ mqtt-broker/                 # [重命名] 原 mqtt/ —— Broker 部署物
│   ├─ deploy_mqtt.sh
│   ├─ docker-compose.mqtt.yml
│   └─ mosquitto/
├─ nginx/
│   ├─ build/                   # 渲染产物（gitignore）
│   ├─ snippets/                # 片段模板
│   ├─ green-tracker.conf.template
│   └─ README.md                # 明确「仓库产物 → 安装路径」映射
├─ scripts/
│   ├─ smoke_test.sh            # [新增] 回归冒烟
│   └─ ...                      # 修复既有缺陷
├─ frontend/
│   ├─ .eslintrc.cjs            # [新增]
│   ├─ src/
│   │   ├─ config/
│   │   │   ├─ env.ts           # [唯一] 环境变量出口 + API 基址归一化
│   │   │   └─ minio.ts         # [迁移] getMinioUrl 等纯工具
│   │   ├─ services/            # 全部 .ts，补 DTO 类型
│   │   ├─ hooks/               # 全部 .ts / .tsx
│   │   ├─ contexts/            # 全部 .tsx
│   │   ├─ utils/               # 删除 env.ts（死代码）
│   │   └─ vite-env.d.ts        # [唯一] 完整 ImportMetaEnv
│   └─ README.md                # [新增] 目录与导入约定
└─ docs/
    ├─ README.md                # 重建索引
    ├─ setup/                   # HTTPS_SETUP.md, ENV_CONFIG.md
    ├─ architecture/            # database_redesign_v2.md, minio_documentation.md
    ├─ features/                # thumbnail_feature_guide.md, algorithm_development_guide.md
    ├─ ops/                     # screen_guide.md
    └─ plans/                   # 本设计文档与实施计划
```

---

## 5. 分阶段设计

每个阶段独立提交，可独立回滚。

### Phase 0 — 验证护栏（先立网）

**目的**：在移动任何文件之前，先让机器能发现"改坏了"。

| 产物 | 说明 |
|---|---|
| `frontend`: 新增 `typescript` 依赖 | `devDependencies`，与现有 `@types/*` 配套 |
| `frontend/package.json`: `typecheck` 脚本 | `tsc --noEmit` |
| `frontend/.eslintrc.cjs` | 修复失效的 `npm run lint`。关键规则 `no-undef` 可拦截「使用了未定义变量」——即 `KeyManagement is not defined` 那类崩溃 |
| `scripts/smoke_test.sh` | 冒烟回归：`/health`、登录、一个鉴权接口、MinIO 相对路径、前端首页 200 |

**关键约束**：先测量 `tsc --noEmit` 的**错误基线**。若错误量大，按文件分批达标并显式记录豁免，**不做一次性硬改**。

**验证**：`npm run lint` 可运行；`npm run typecheck` 有明确基线；`bash scripts/smoke_test.sh` 全绿。

### Phase 1 — 环境变量收敛为一处（含 404 根治）

| 动作 | 说明 |
|---|---|
| 建立唯一出口 | `src/config/env.ts`（由 `utils/env.ts` 改造，补全类型） |
| 删除死代码 | `src/utils/env.ts`（0 引用）；`config/environment.js` 中的 env 读取块（`api.baseUrl` 无消费方） |
| 迁移纯工具 | `getMinioUrl` / `isImageFormatSupported` / `formatFileSize` 从 `config/environment.js` 迁至 `config/minio.ts` 与 `utils/format.ts` |
| 类型声明合一 | 删除 `src/utils/vite-env.d.ts`，`src/vite-env.d.ts` 补齐全部 `VITE_*`（现缺 `VITE_AMAP_*`、`VITE_MINIO_*`、`VITE_ALLOWED_HOSTS`、`VITE_MAX_*` 等） |
| **API 基址归一化** | `env.ts` 内剥除尾部 `/api` 并 `console.warn`；`services/api.ts` 仅读取归一化后的值 |
| URL 构建收敛 | `AlgorithmSquare.jsx`（11 处）、`AlgorithmUse.jsx`（2 处）的内联 `${API_BASE_URL}/api/...` 改为统一的 `buildApiUrl(path)` |

**验收**：即使把 `VITE_API_BASE_URL` 填成 `/api`，请求仍为 `/api/auth/login`（不出现 `/api/api/...`）。

### Phase 2 — 目录与命名规范化

| 动作 | 说明 |
|---|---|
| `mqtt/` → `mqtt-broker/` | `git mv`；同步 `Makefile:197/201/204/207`、`.gitignore:133-135`。`deploy_mqtt.sh` 与 compose 使用自定位路径，无需改动；`backend/mqtt` 为带 `__init__.py` 的正规包，不受影响 |
| `services/` 后缀统一 | `apiKeyService.js`、`imageUploadService.js` → `.ts`；集中补 DTO 类型 |
| `hooks/` 与 `contexts/` 后缀统一 | `hooks/common/{useDataList,useForm,useModal}.js`、`hooks/useToast.js` → `.ts`；`contexts/ToastContext.jsx` → `.tsx` |
| Toast 陷阱契约修复（D7） | `ToastContainer` 接收 `position` / `duration` 可选 props，默认值与现状一致（默认渲染结果不变） |
| 桶文件策略 | 删除 3 个零引用死 barrel（`pages/Dashboard/components/index.js`、`Fields/components/index.js` 的 `export *`、`hooks/auth/index.ts`）；补齐缺失的 `pages/Dashboard/MQTT/index.js` 消除特例；`App.jsx` 改用具名导入 |
| 写入约定 | 新增 `frontend/README.md`，陈述"桶文件策略 / 扩展名规则 / 导入规范" |

**验收**：`typecheck` + `lint` 全绿；冒烟全绿；`make mqtt-status` 可用。

### Phase 3 — 部署与脚本层

| 动作 | 说明 |
|---|---|
| 清理废弃产物 | 删除 `nginx/green-tracker.conf.rendered`（`.gitignore:141` 已自述"已废弃"），同步清理 `.gitignore:140-141` |
| 修脚本缺陷 | `stop-services.sh:16`（`SCRIPT_DIR` 从未定义 → MilvIO 实际无法停止）、`start-services.sh:61`（`${RED}` 未定义）、`stop-services.sh:28`（`${YELLOW}` 未定义）、`minio.sh:414-418`（`restart` 调用不存在的 `stop`/`start`，`set -e` 下直接中断）、`minio.sh:397`（`FORCE_INSTALL`）、`minio.sh:342-346`（引用不存在的测试脚本）、`postgres-install.sh:40/128`、`grant_db_permissions.sh:142`（引用不存在的 `init_new_architecture.sh`） |
| 统一脚本纪律 | 各脚本补 `set -euo pipefail`；颜色变量集中定义 |
| 后端依赖单一来源 | 以 `pyproject.toml` 为准补齐缺失的 8 个运行期依赖（`minio`/`paho-mqtt`/`Pillow`/`python-multipart`/`redis`/`httpx`/`pyyaml`）；处理 `dotenv` 与 `python-dotenv` 冗余；修非法的 `[project.scripts]` 入口与 `packages.find` 仅打包 `database` 的问题 |
| Nginx 产物对齐 | 统一"仓库产物 → 安装路径"映射，使 `scripts/nginx.sh mode` 能正确检测；修 `nginx/green-tracker.conf.template:4` 的错误注释（写 `setup_https.sh`，实际为 `render_nginx.sh`） |

**验收**：`make mqtt-status`、`make minio` 相关命令可用；`pip install -e backend` 后可 import `minio`/`paho.mqtt`；冒烟全绿。

### Phase 4 — 文档重组

| 动作 | 说明 |
|---|---|
| 分层 | 建立 `docs/setup|architecture|features|ops|plans`，移动既有文档 |
| 重建索引 | 重写 `docs/README.md` |
| 修失效引用 | 3 个不存在的 doc 链接；`README.md:9,467` 的 `LICENSE`（仓库无此文件）；`database_redesign_v2.md:786` 的 `backend/scripts/migrate_to_v2.py` |
| 修过时表述 | `ENV_CONFIG.md:192` 与 `docs/HTTPS_SETUP.md:210-222` 仍主张"不区分开发/生产"，与现行 dev/prod 双模式矛盾；`ENV_CONFIG.md` 补记 `VITE_DEFAULT_USERNAME/PASSWORD`，标注死变量 `SERVER_PORT` |

**验收**：文档内所有相对链接可解析。

### Phase 5 — 回归与收尾

`smoke_test.sh` + `typecheck` + `lint` + `build` 全绿 → 重启 dev 服务实测登录 → 清理临时文件（`/tmp/gt_diag*.txt`）。

---

## 6. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| 前端严格类型化错误量未知 | 中 | Phase 0 先测基线；按文件分批达标，不硬改 |
| 重命名 `mqtt/` 遗漏引用 | 低 | 引用点已全量枚举（6 处），且 3 处为自定位路径无需改 |
| 脚本改动影响部署流程 | 中 | 每个脚本改后单独执行 `bash -n` 与实跑验证 |
| 补齐后端依赖影响现有环境 | 中 | 补齐只增不减；`pip install -e backend` 后逐项 import 验证 |
| Nginx 生效配置为手工安装，与仓库产物不一致 | 中 | 本次仅统一"检测路径"与文档，**不覆盖正在生效的线上配置** |
| MinIO / MQTT Broker / 算法容器无法自动验证 | 中 | 冒烟脚本覆盖 HTTP 层；容器层由用户人工确认 |

---

## 7. 验收标准

1. 误填 `VITE_API_BASE_URL=/api` 时，登录请求仍指向 `/api/auth/login`。
2. `npm run lint` 与 `npm run typecheck` 可执行且通过。
3. 全仓 `VITE_API_BASE_URL` 读取点收敛为 1 处。
4. `services/`、`hooks/`、`contexts/` 无 `.js`/`.ts` 混用。
5. 零引用死 barrel 全部移除；`frontend/README.md` 记载约定。
6. `bash scripts/smoke_test.sh` 全绿。
7. `pip install -e backend` 后 `import minio`、`import paho.mqtt.client` 均成功。
8. `docs/` 内无失效相对链接。
9. 每阶段对应一次独立提交，可单独回滚。
