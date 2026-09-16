# 结构规范化实施计划（Scope B）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实 `docs/plans/2026-09-15-structure-normalization-design.md`：先建立质量护栏并修复真实缺陷，再做目录/命名结构迁移。

**Architecture:** 六阶段推进（护栏 → 环境变量收敛 → 目录命名 → 部署脚本/依赖 → 文档 → 回归）。每任务独立提交、独立可回滚；结构性改动以 `typecheck` + `lint` + 冒烟脚本三道门禁验证。

**Tech Stack:** React 18 + Vite 5 + TypeScript 5 / FastAPI / Bash / Make / Nginx

**Spec:** `docs/plans/2026-09-15-structure-normalization-design.md`

## Global Constraints

- 工作分支：`refactor/structure-normalization`；用户未提交的改动留在工作区，**不得**被卷入提交。
- 每个任务只 `git add` 该任务「Files」清单内的文件，禁止 `git add -A` / `git commit -a`。
- 除任务明确列出的缺陷修复外，**不改变任何运行时行为**。
- 环境变量收敛后，全仓 `import.meta.env` 只允许出现在 `frontend/src/config/env.ts` 与 `frontend/src/vite-env.d.ts`。
- 三道验证门禁（前两个在 `frontend/` 下执行）：`npm run typecheck`、`npm run lint`、`bash scripts/smoke_test.sh`。
- 设计文档的 D1–D7 决策对全部任务生效。

## 对设计的一处收紧（记录在案）

设计 §5 Phase 1 要求 `AlgorithmSquare/AlgorithmUse` 的 13 处 URL 改为 `buildApiUrl()`。实施采用**更低风险的最小替换**：保留本地常量名，仅把取值来源从 `import.meta.env` 换成归一化后的 `env.API_BASE_URL`（每文件 2 行）。安全性质（不再可能双前缀）完全一致，churn 更小。`buildApiUrl` 仍导出供后续渐进采用。

---

## Task 0: 建分支并提交设计文档与本计划

**Files:** Create: 本文件

- [ ] **Step 1: 创建工作分支**

```bash
# 注：以下路径为执行当时的本机环境实录，请在你的环境里替换为实际项目根目录。
cd <PROJECT_DIR>
git switch -c refactor/structure-normalization
```

- [ ] **Step 2: 仅提交这两个文档**

```bash
git add docs/plans/2026-09-15-structure-normalization-design.md docs/plans/2026-09-15-structure-normalization-plan.md
git commit -m "docs(plans): 结构规范化设计与实施计划（Scope B）"
```

- [ ] **Step 3: 确认用户改动未被卷入**

```bash
git show --stat HEAD   # 应只包含 2 个 docs/plans 文件
```

---

## Task 1: 安装 TypeScript 并建立 typecheck 门禁

**Files:** Modify: `frontend/package.json`

**Interfaces:** Produces: npm script `typecheck` = `tsc --noEmit`；devDeps：`typescript`、`@typescript-eslint/parser`、`@typescript-eslint/eslint-plugin`（Task 2 使用）

- [ ] **Step 1: 安装依赖**

```bash
cd frontend
npm install -D typescript@^5.6 @typescript-eslint/parser@^8 @typescript-eslint/eslint-plugin@^8
```

若报 peer 冲突（eslint 需 ≥8.57）：`npm install -D eslint@^8.57` 后重试。

- [ ] **Step 2: 修改 scripts**

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --ext js,jsx,ts,tsx --report-unused-disable-directives",
  "preview": "vite preview"
},
```

- [ ] **Step 3: 测量基线**

```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-baseline.txt | grep -c 'error TS'
```

基线数字写入提交信息。若 >0：逐条修复（仅加类型标注，不改逻辑）后进 Task 2。

- [ ] **Step 4: 验证**

```bash
npm run typecheck && echo TYPECHECK_OK
```

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "build(frontend): 接入 TypeScript typecheck 门禁（基线 N 个错误→0）"
```

---

## Task 2: 修复失效的 ESLint（新增配置）

**Files:** Create: `frontend/.eslintrc.cjs`

**Interfaces:** Produces: 可运行的 `npm run lint`；`no-undef` 拦截「使用未定义变量」（`KeyManagement is not defined` 崩溃类 bug）

- [ ] **Step 1: 写入 `frontend/.eslintrc.cjs`**

```js
/* Green Tracker ESLint 配置
 * 背景：package.json 曾声明 npm run lint 但仓库无任何 ESLint 配置，命令必然失败。
 * no-undef 是关键规则——曾在 App.jsx 漏解构 KeyManagement 导致整页白屏，该规则可直接拦截。
 */
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'no-undef': 'error',
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        'no-undef': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.cjs'],
}
```

- [ ] **Step 2: 首跑测基线**

```bash
npm run lint 2>&1 | tee /tmp/lint-baseline.txt | tail -5
```

- [ ] **Step 3: 修复所有 error（仅删未用导入/变量，不改行为）；warning 记录数量，不清零**

- [ ] **Step 4: 验证**

```bash
npm run lint >/dev/null 2>&1 && echo LINT_OK
```

- [ ] **Step 5: Commit**

```bash
git add frontend/.eslintrc.cjs
# 修复 error 时改动的源文件一并 add
git commit -m "build(frontend): 修复失效的 ESLint（error 清零，warning 基线 N）"
```

---

## Task 3: 新增冒烟回归脚本

**Files:** Create: `scripts/smoke_test.sh`

**Interfaces:** Produces: `bash scripts/smoke_test.sh [FRONT_URL] [API_URL]`，退出码 0=全绿；可选 `SMOKE_USERNAME`/`SMOKE_PASSWORD` 执行真实登录

- [ ] **Step 1: 写入脚本**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Green Tracker 冒烟回归
# 验证：后端存活、API 路由可达、Nginx 反代正确、双前缀防护、前端入口可用
# 用法: bash scripts/smoke_test.sh [FRONT_BASE_URL] [API_BASE_URL]
#   FRONT_BASE_URL 默认 https://localhost（自签名证书自动加 -k）
#   API_BASE_URL   默认 http://localhost:6130

FRONT_URL="${1:-https://localhost}"
API_URL="${2:-http://localhost:6130}"

KFLAG=""
if [[ "$FRONT_URL" == https://* ]]; then
  KFLAG="-k"
fi

PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    printf '  [PASS] %-52s -> %s\n' "$name" "$actual"
    PASS=$((PASS + 1))
  else
    printf '  [FAIL] %-52s -> %s（期望 %s）\n' "$name" "$actual" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo " Green Tracker 冒烟回归"
echo " 前端入口: $FRONT_URL"
echo " 后端直连: $API_URL"
echo "=========================================="

echo "[1/5] 后端直连"
check "GET  /health"                        200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$API_URL/health")"
check "POST /api/auth/login（空body=路由存在）" 422 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API_URL/api/auth/login" -H 'Content-Type: application/json' -d '{}')"

echo "[2/5] 经 Nginx 反代"
check "GET  /health"                        200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG "$FRONT_URL/health")"
check "POST /api/auth/login"                422 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG -X POST "$FRONT_URL/api/auth/login" -H 'Content-Type: application/json' -d '{}')"

echo "[3/5] 双前缀反例（必须 404；若 422 即 baseURL 配置回归）"
check "POST /api/api/auth/login"            404 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG -X POST "$FRONT_URL/api/api/auth/login" -H 'Content-Type: application/json' -d '{}')"

echo "[4/5] 鉴权接口（无 token 应 401）"
check "GET  /api/fields"                    401 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG "$FRONT_URL/api/fields")"

echo "[5/5] 前端入口"
check "GET  /"                              200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG "$FRONT_URL/")"

if [[ -n "${SMOKE_USERNAME:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  echo "[可选] 真实登录（SMOKE_USERNAME 已设置）"
  code=$(curl -s -o /tmp/gt_smoke_login.json -w '%{http_code}' --max-time 15 $KFLAG \
    -X POST "$FRONT_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$SMOKE_USERNAME\",\"password\":\"$SMOKE_PASSWORD\"}")
  check "POST /api/auth/login（真实凭据）" 200 "$code"
  rm -f /tmp/gt_smoke_login.json
else
  echo "[跳过] 真实登录（未设置 SMOKE_USERNAME/SMOKE_PASSWORD）"
fi

echo "=========================================="
echo " 结果: $PASS 通过, $FAIL 失败"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
echo " 冒烟回归全部通过 ✓"
```

- [ ] **Step 2: 赋权并首跑**

```bash
chmod +x scripts/smoke_test.sh
bash scripts/smoke_test.sh
```

预期 8–9 项全 PASS。若 [4/5] 非 401，先核实 `/api/fields` 实际返回再调整期望值。

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_test.sh
git commit -m "test(scripts): 新增冒烟回归脚本（健康/登录/双前缀反例/鉴权/前端入口）"
```

---

## Task 4: 环境变量唯一出口 `src/config/env.ts`（含 404 根治）

**Files:** Create: `frontend/src/config/env.ts`

**Interfaces:**
- `export const env`（含 `API_BASE_URL`、`API_TIMEOUT`、`MINIO_*`、`AMAP_*` 等，见代码）
- `export const normalizeApiBaseUrl(raw: string | undefined): string`
- `export const buildApiUrl(path: string): string`
- `export default env`

- [ ] **Step 1: 写入 `frontend/src/config/env.ts`**

```ts
/**
 * 全局环境变量唯一出口
 *
 * 约定：
 * - 所有 import.meta.env 读取必须经过本模块，业务代码禁止直接使用 import.meta.env
 * - API_BASE_URL 是 origin 前缀，**不含** /api；调用方请求路径自带 /api 前缀
 */

type Mode = 'development' | 'production' | 'test'

const readString = (value: string | undefined, fallback: string): string => {
  const trimmed = (value ?? '').trim()
  return trimmed !== '' ? trimmed : fallback
}

const readInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const readBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value.trim() === '' ? fallback : value.trim() === 'true'

const readList = (value: string | undefined, fallback: string[]): string[] => {
  const trimmed = (value ?? '').trim()
  if (trimmed === '') return fallback
  return trimmed.split(',').map(item => item.trim()).filter(Boolean)
}

/**
 * 规范化 API 基址：剥离尾部 `/api` 与尾部斜杠。
 *
 * 背景：代码中所有请求路径都自带 `/api` 前缀。若 VITE_API_BASE_URL 被误填为
 * `/api`，拼接会得到 `/api/api/auth/login` → 404（2026-09-15 线上故障根因）。
 */
export const normalizeApiBaseUrl = (raw: string | undefined): string => {
  const original = (raw ?? '').trim()
  if (original === '') return ''

  let normalized = original.replace(/\/+$/, '')
  if (normalized === '/api') {
    normalized = ''
  } else if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -'/api'.length).replace(/\/+$/, '')
  }

  if (normalized !== original) {
    console.warn(
      `[环境变量] VITE_API_BASE_URL 已被修正: "${original}" -> "${normalized || '(空)'}"。` +
        '该变量应为 origin 前缀且不含 /api（请求路径已自带 /api），请修正 .env。'
    )
  }
  return normalized
}

const mode = readString(import.meta.env.MODE, 'development') as Mode

export const env = {
  MODE: mode,
  isDevelopment: mode === 'development',
  isProduction: mode === 'production',
  isTest: mode === 'test',

  /** API origin 前缀（已归一化，不含 /api）。空 = 同源相对路径 */
  API_BASE_URL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  API_TIMEOUT: readInt(import.meta.env.VITE_API_TIMEOUT, 30000),

  MINIO_ENDPOINT: readString(import.meta.env.VITE_MINIO_ENDPOINT, 'localhost'),
  MINIO_PORT: readInt(import.meta.env.VITE_MINIO_PORT, 9100),
  MINIO_BUCKET: readString(import.meta.env.VITE_MINIO_BUCKET, 'green-tracker-minio'),
  MINIO_SECURE: readBool(import.meta.env.VITE_MINIO_SECURE, false),
  MINIO_PUBLIC_URL: readString(
    import.meta.env.VITE_MINIO_PUBLIC_URL,
    `/minio/${readString(import.meta.env.VITE_MINIO_BUCKET, 'green-tracker-minio')}`
  ),

  ALLOWED_HOSTS: readList(import.meta.env.VITE_ALLOWED_HOSTS, []),

  AMAP_KEY: readString(import.meta.env.VITE_AMAP_KEY, ''),
  AMAP_SERVICE_KEY: readString(import.meta.env.VITE_AMAP_SERVICE_KEY, ''),

  MAX_FILE_SIZE: readInt(import.meta.env.VITE_MAX_FILE_SIZE, 10 * 1024 * 1024),
  ALLOWED_IMAGE_FORMATS: readList(import.meta.env.VITE_ALLOWED_IMAGE_FORMATS, [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
  ]),
  THUMBNAIL_SIZE: readInt(import.meta.env.VITE_THUMBNAIL_SIZE, 150),
  THUMBNAIL_CACHE_TTL: readInt(import.meta.env.VITE_THUMBNAIL_CACHE_TTL, 3600),
  IMAGE_CACHE_LIMIT: readInt(import.meta.env.VITE_IMAGE_CACHE_LIMIT, 100),
  IMAGE_LAZY_LOADING: readBool(import.meta.env.VITE_IMAGE_LAZY_LOADING, true),

  ENABLE_VIRTUAL_SCROLL: readBool(import.meta.env.VITE_ENABLE_VIRTUAL_SCROLL, false),
  PAGE_SIZE: readInt(import.meta.env.VITE_PAGE_SIZE, 20),
  MAX_CONCURRENT_REQUESTS: readInt(import.meta.env.VITE_MAX_CONCURRENT_REQUESTS, 5),

  DEFAULT_USERNAME: readString(import.meta.env.VITE_DEFAULT_USERNAME, 'admin'),
  DEFAULT_PASSWORD: readString(import.meta.env.VITE_DEFAULT_PASSWORD, '123456'),
} as const

/** 拼接完整 API 地址。@param path 以 / 开头，如 '/api/auth/login' */
export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${env.API_BASE_URL}${normalizedPath}`
}

if (env.isDevelopment) {
  console.log('[环境变量] 加载完成:', {
    MODE: env.MODE,
    API_BASE_URL: env.API_BASE_URL,
    MINIO_PUBLIC_URL: env.MINIO_PUBLIC_URL,
  })
}

export default env
```

- [ ] **Step 2: 验证**：`npm run typecheck && npm run lint`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/config/env.ts
git commit -m "feat(frontend): 环境变量唯一出口 config/env.ts，含 API 基址归一化（根治 /api/api 双前缀）"
```

---

## Task 5: 合一 vite-env.d.ts 并补齐全部声明

**Files:**
- Modify: `frontend/src/vite-env.d.ts`（重写）
- Delete: `frontend/src/utils/vite-env.d.ts`
- Modify: `frontend/src/services/api.ts:1`（删 reference 行）

- [ ] **Step 1: 重写 `frontend/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_ALLOWED_HOSTS?: string
  readonly VITE_AMAP_KEY?: string
  readonly VITE_AMAP_SERVICE_KEY?: string
  readonly VITE_AMAP_SECURITY_CODE?: string
  readonly VITE_MINIO_ENDPOINT?: string
  readonly VITE_MINIO_PORT?: string
  readonly VITE_MINIO_BUCKET?: string
  readonly VITE_MINIO_SECURE?: string
  readonly VITE_MINIO_PUBLIC_URL?: string
  readonly VITE_MAX_FILE_SIZE?: string
  readonly VITE_ALLOWED_IMAGE_FORMATS?: string
  readonly VITE_ENABLE_VIRTUAL_SCROLL?: string
  readonly VITE_PAGE_SIZE?: string
  readonly VITE_MAX_CONCURRENT_REQUESTS?: string
  readonly VITE_IMAGE_CACHE_LIMIT?: string
  readonly VITE_THUMBNAIL_SIZE?: string
  readonly VITE_THUMBNAIL_CACHE_TTL?: string
  readonly VITE_IMAGE_LAZY_LOADING?: string
  readonly VITE_DEFAULT_USERNAME?: string
  readonly VITE_DEFAULT_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 2: 删除重复副本；api.ts 第 1 行 `/// <reference path="../utils/vite-env.d.ts" />` 删除**

```bash
git rm frontend/src/utils/vite-env.d.ts
```

- [ ] **Step 3: 验证**：`npm run typecheck && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/vite-env.d.ts frontend/src/services/api.ts
git commit -m "refactor(frontend): vite-env.d.ts 合一并补齐全部 VITE_* 声明"
```

---

## Task 6: 拆解 config/environment.js，迁移纯工具并删除死代码

**Files:**
- Create: `frontend/src/config/minio.ts`、`frontend/src/utils/format.ts`
- Modify: `frontend/src/components/ui/ImageThumbnail.jsx:2`
- Delete: `frontend/src/config/environment.js`、`frontend/src/utils/env.ts`

**Interfaces:**
- `minio.ts`: `getMinioUrl(objectPath: string | null | undefined, forcePreview?: boolean): string`
- `format.ts`: `isImageFormatSupported(filename: string | undefined): boolean`、`formatFileSize(bytes: number): string`

- [ ] **Step 1: 写入 `frontend/src/config/minio.ts`**

```ts
import { env } from './env'

/**
 * 获取 MinIO 完整访问 URL
 * @param objectPath 对象路径
 * @param forcePreview 是否追加 inline 参数（强制预览而非下载）
 */
export const getMinioUrl = (
  objectPath: string | null | undefined,
  forcePreview = true
): string => {
  if (!objectPath) return ''

  const baseUrl = env.MINIO_PUBLIC_URL
  const url = baseUrl.endsWith('/')
    ? `${baseUrl}${objectPath}`
    : `${baseUrl}/${objectPath}`

  if (forcePreview) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}response-content-disposition=inline`
  }
  return url
}
```

- [ ] **Step 2: 写入 `frontend/src/utils/format.ts`**

```ts
import { env } from '@/config/env'

export const isImageFormatSupported = (filename: string | undefined): boolean => {
  if (!filename) return false
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return env.ALLOWED_IMAGE_FORMATS.includes(extension)
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
```

- [ ] **Step 3: 更新唯一消费者**

`ImageThumbnail.jsx:2`：`import { getMinioUrl } from '@/config/environment'` → `import { getMinioUrl } from '@/config/minio'`

- [ ] **Step 4: 删除死文件（先验证零引用）**

```bash
cd frontend
grep -rn "config/environment\|@/utils/env" src/ | grep -v 'src/config/env.ts' || echo "无残留引用"
git rm frontend/src/config/environment.js frontend/src/utils/env.ts
```

预期「无残留引用」；若有引用先迁移再删。

- [ ] **Step 5: 验证**：`npm run typecheck && npm run lint && bash ../scripts/smoke_test.sh`；浏览器确认数据视图页图片链接可打开。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config/minio.ts frontend/src/utils/format.ts frontend/src/components/ui/ImageThumbnail.jsx
git commit -m "refactor(frontend): 拆解 environment.js 为 minio.ts/format.ts，删除死代码 utils/env.ts"
```

---

## Task 7: api.ts 接入归一化基址

**Files:** Modify: `frontend/src/services/api.ts`

**Interfaces:** 保持 `export default api`、`export function getApiUrl(): string`（imageUploadService 依赖）

- [ ] **Step 1: 文件头部（原 1–25 行）替换为**

```ts
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { env } from '@/config/env'

// API 基址来自唯一出口 config/env.ts（已归一化：不含尾部 /api）
const apiBaseUrl = env.API_BASE_URL

const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: env.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

- [ ] **Step 2: 请求拦截器删除这行（安全：曾把明文密码打进控制台）**

```ts
    console.log('[前端API] 请求数据:', config.data);
```

保留 method/url 与响应日志。

- [ ] **Step 3: 验证**：`npm run typecheck && npm run lint && bash ../scripts/smoke_test.sh`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "refactor(frontend): api.ts 接入归一化 API 基址；拦截器不再打印请求体（防密码泄漏）"
```

---

## Task 8: AlgorithmSquare / AlgorithmUse 接入归一化基址

**Files:**
- Modify: `frontend/src/pages/Dashboard/AlgorithmUse/AlgorithmUse.jsx:8-9`
- Modify: `frontend/src/pages/Dashboard/AlgorithmSquare/AlgorithmSquare.jsx:10-11`

- [ ] **Step 1: 两文件同样替换**（import 并入顶部 import 区；13 处模板用法不动）

```jsx
import { env } from '@/config/env'
// API 基址：来自唯一出口 config/env.ts（已归一化，不含 /api）
const API_BASE_URL = env.API_BASE_URL
```

- [ ] **Step 2: 验证**：`npm run typecheck && npm run lint && bash ../scripts/smoke_test.sh`

- [ ] **Step 3: 双前缀防护端到端验收（关键）**

```bash
# 注：以下路径为执行当时的本机环境实录，请在你的环境里替换为实际项目根目录。
cd <PROJECT_DIR>
sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/api|' .env
sleep 5   # 等 Vite 重启重注入
curl -s "http://localhost:3010/src/config/env.ts" | head -5   # 确认模块已更新
# 浏览器/控制台应出现 [环境变量] VITE_API_BASE_URL 已被修正 的 warn，请求仍为 /api/...
sed -i 's|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=|' .env   # 还原！
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard/AlgorithmSquare/AlgorithmSquare.jsx frontend/src/pages/Dashboard/AlgorithmUse/AlgorithmUse.jsx
git commit -m "refactor(frontend): 算法页接入唯一环境出口（双前缀防护覆盖全部调用方）"
```

---

## Task 9: 根目录 mqtt/ → mqtt-broker/

**Files:**
- Rename: `mqtt/` → `mqtt-broker/`
- Modify: `Makefile:197,201,204,207`、`.gitignore:133-135`

- [ ] **Step 1:**

```bash
git mv mqtt mqtt-broker
```

- [ ] **Step 2: Makefile 四处** `cd mqtt &&` → `cd mqtt-broker &&`（mqtt-start/stop/status/logs）

- [ ] **Step 3: .gitignore 改为**

```
# MQTT Broker 运行时数据目录
mqtt-broker/mosquitto/data/
mqtt-broker/mosquitto/log/
mqtt-broker/mosquitto/config/passwd
```

- [ ] **Step 4: 残留检查**

```bash
grep -rn '[^a-zA-Z-]mqtt/' --include='*.sh' --include='Makefile' --include='*.md' --include='*.yml' . \
  | grep -v node_modules | grep -v 'mqtt-broker/' | grep -v 'backend/mqtt' || echo "无残留"
```

- [ ] **Step 5: 验证**：`make mqtt-status`（不报脚本路径错误即可）+ `bash scripts/smoke_test.sh`

- [ ] **Step 6: Commit**

```bash
git add Makefile .gitignore mqtt-broker/
git commit -m "refactor: 根目录 mqtt/ 更名 mqtt-broker/，消除与 backend/mqtt 应用模块同名歧义"
```

---

## Task 10: imageUploadService 转 .ts（删除重复方法）

**Files:** Rename: `frontend/src/services/imageUploadService.js` → `.ts`

**Interfaces:** 新增导出类型 `UploadOptions`、`BatchItemResult`、`BatchUploadResult`、`SupportedFormatsResponse`、`ValidationOutcome`

- [ ] **Step 1:** `git mv frontend/src/services/imageUploadService.js frontend/src/services/imageUploadService.ts`

- [ ] **Step 2: import 之后追加**

```ts
export interface UploadOptions {
  session_id: string
  data_subtype?: string
  description?: string
  location_geom?: string
  altitude_m?: number
  heading?: number
}

export interface BatchItemResult {
  file: string
  success: boolean
  data?: unknown
  error?: string
}

export interface BatchUploadResult {
  total: number
  success_count: number
  failed_count: number
  results: BatchItemResult[]
  errors: { file: string; error: string }[]
}

export interface SupportedFormatsResponse {
  code: number
  message: string
  data: {
    supported_formats: Record<string, {
      extensions: string[]
      mime_types: string[]
      description: string
    }>
    max_file_size_mb: number
    max_batch_size: number
  }
}

export interface ValidationOutcome {
  isValid: boolean
  errors: string[]
  warnings: string[]
}
```

- [ ] **Step 3: 类型标注（函数体一律原样）**

- `getAuthToken(): string | null`、`createAuthHeaders(): Record<string, string>`、`this.baseUrl: string`
- `async uploadFile(file: File, options: UploadOptions = {}): Promise<unknown>`
- `async uploadBatchFiles(files: FileList | File[], options: UploadOptions = {}): Promise<BatchUploadResult>`
- `async uploadImage(file: File, options: UploadOptions = {}): Promise<unknown>`
- `async uploadBatchImages(files: FileList | File[], options: UploadOptions = {}): Promise<BatchUploadResult>`
- `async getSupportedFormats(): Promise<SupportedFormatsResponse>`
- `validateImageFile(file: File, limits: { maxSizeMB?: number } = {}): ValidationOutcome`
- `createPreviewUrl(file: File): Promise<string>`（`resolve(e.target.result as string)`）
- `formatFileSize(bytes: number): string`、`getFileExtension(filename: string): string`、`isSupportedImageFormat(filename: string): boolean`

- [ ] **Step 4: 删除死代码** —— 原 `.js` 146–170 行（第一个 `getSupportedFormats`，请求的后端端点不存在且被第二个同名定义覆盖，从未生效）整块删除；保留第二个定义并在其 doc 注释追加：

```ts
     * 注：后端暂无对应端点，此处返回静态清单（原文件存在两个同名方法，
     * JS 类中后者覆盖前者、网络版从未生效，已于结构规范化时删除）。
```

- [ ] **Step 5: 验证**：`npm run typecheck && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/imageUploadService.ts
git commit -m "refactor(frontend): imageUploadService 统一为 .ts 并补类型；删除被覆盖的重复 getSupportedFormats"
```

---

## Task 11: apiKeyService 转 .ts

**Files:** Rename: `frontend/src/services/apiKeyService.js` → `.ts`（消费方均为无扩展名导入，零改动）

- [ ] **Step 1: 整体重写为**

```ts
import api from './api'

export interface ApiKey {
  id: number | string
  [key: string]: unknown
}

export interface ApiKeyListParams {
  page?: number
  page_size?: number
  [key: string]: unknown
}

type ApiErrorShape = { response?: { data?: { detail?: string } } }

const toMessage = (error: unknown, fallback: string): string => {
  const detail = (error as ApiErrorShape)?.response?.data?.detail
  return detail || fallback
}

const apiKeyService = {
  async getApiKeys(params: ApiKeyListParams = {}): Promise<ApiKey[]> {
    try {
      const response = await api.get('/api/api-keys', { params })
      return response.data.data
    } catch (error) {
      console.error('获取API密钥列表失败:', error)
      throw new Error(toMessage(error, '获取API密钥列表失败'))
    }
  },

  async createApiKey(keyData: Record<string, unknown>): Promise<ApiKey> {
    try {
      const response = await api.post('/api/api-keys', keyData)
      return response.data.data
    } catch (error) {
      console.error('创建API密钥失败:', error)
      throw new Error(toMessage(error, '创建API密钥失败'))
    }
  },

  async getApiKeyDetail(keyId: number | string): Promise<ApiKey> {
    try {
      const response = await api.get(`/api/api-keys/${keyId}`)
      return response.data.data
    } catch (error) {
      console.error('获取API密钥详情失败:', error)
      throw new Error(toMessage(error, '获取API密钥详情失败'))
    }
  },

  async updateApiKey(keyId: number | string, updateData: Record<string, unknown>): Promise<ApiKey> {
    try {
      const response = await api.put(`/api/api-keys/${keyId}`, updateData)
      return response.data.data
    } catch (error) {
      console.error('更新API密钥失败:', error)
      throw new Error(toMessage(error, '更新API密钥失败'))
    }
  },

  async deleteApiKey(keyId: number | string): Promise<boolean> {
    try {
      await api.delete(`/api/api-keys/${keyId}`)
      return true
    } catch (error) {
      console.error('删除API密钥失败:', error)
      throw new Error(toMessage(error, '删除API密钥失败'))
    }
  },

  async validateApiKeyPermissions(apiKey: string): Promise<ApiKey> {
    try {
      const response = await api.get('/api/api-keys/validate/permissions', {
        headers: { 'X-API-Key': apiKey },
      })
      return response.data.data
    } catch (error) {
      console.error('验证API密钥权限失败:', error)
      throw new Error(toMessage(error, '验证API密钥权限失败'))
    }
  },
}

export default apiKeyService
```

- [ ] **Step 2: 验证**：`npm run typecheck && npm run lint && bash ../scripts/smoke_test.sh`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/apiKeyService.ts
git commit -m "refactor(frontend): apiKeyService 统一为 .ts 并补类型"
```

---

## Task 12: hooks/common 与 useToast 转 .ts

**Files:** Rename: `hooks/common/{useModal,useForm,useDataList}.js`、`hooks/useToast.js` → `.ts`

**Interfaces:** 各 hook 返回结构不变（消费方零改动）

- [ ] **Step 1: `useModal.ts` 全文**

```ts
import { useState, useCallback } from 'react'

const useModal = <T = unknown,>() => {
  const [isOpen, setIsOpen] = useState(false)
  const [modalData, setModalData] = useState<T | null>(null)

  const openModal = useCallback((data: T | null = null) => {
    setModalData(data)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalData(null)
    setIsOpen(false)
  }, [])

  const toggleModal = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return { isOpen, modalData, openModal, closeModal, toggleModal, setModalData }
}

export default useModal
```

- [ ] **Step 2: `useToast.ts` 全文**

```ts
import { useToastContext } from '@/contexts/ToastContext'

/** Toast 消息便捷 hook（详见 ToastContext.tsx） */
const useToast = () => useToastContext()

export default useToast
```

- [ ] **Step 3: `useForm.ts`** —— `git mv` 后：文件顶部加类型并标注签名（**函数体逐行保留原 9–96 行**，`confirm` 分支 `values[schema.confirm]` 补 `?? ''`）：

```ts
import { useState, useCallback } from 'react'

export interface FieldSchema {
  required?: boolean
  requiredMessage?: string
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  patternMessage?: string
  custom?: (value: string, values: Record<string, string>) => boolean
  customMessage?: string
  confirm?: string
  confirmMessage?: string
}

const useForm = (
  initialValues: Record<string, string>,
  validationSchema: Record<string, FieldSchema> = {}
) => {
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback((name: string, value: string): string | null => { /* 原 8–40 行 */ }, [validationSchema, values])
  const validateAll = useCallback((): boolean => { /* 原 42–56 行 */ }, [validationSchema, values, validateField])
  const handleChange = useCallback((e: { target: { name: string; value: string } }) => { /* 原 58–68 行 */ }, [validateField])
  const handleBlur = useCallback((e: { target: { name: string; value: string } }) => { /* 原 70–79 行 */ }, [validateField])
  const setFieldValue = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])
  const setFieldError = useCallback((name: string, error: string | null) => {
    setErrors(prev => ({ ...prev, [name]: error }))
  }, [])
  const resetForm = useCallback(() => {
    setValues(initialValues); setErrors({}); setTouched({})
  }, [initialValues])

  const isValid = Object.keys(errors).every(key => !errors[key])

  return { values, errors, touched, isValid, handleChange, handleBlur, setFieldValue, setFieldError, resetForm, validateAll }
}

export default useForm
```

（`/* 原 N–M 行 */` = 把原文件对应行原样搬入，逻辑零改动。）

- [ ] **Step 4: `useDataList.ts`** —— `git mv` 后：顶部加类型，其余按下列标注（**原 33–152 行逻辑逐行保留**）：

```ts
import { useState, useCallback, useEffect } from 'react'

export interface DataListItem {
  id: string | number
  [key: string]: unknown
}

export interface FetchParams {
  page: number
  pageSize: number
  [key: string]: unknown
}

export type FetchResult =
  | DataListItem[]
  | { data?: DataListItem[]; items?: DataListItem[]; total?: number; count?: number }
  | null

export type FetchFunction = ((params: FetchParams) => Promise<FetchResult>) | null

export interface UseDataListOptions {
  pageSize?: number
  defaultFilters?: Record<string, unknown>
  autoFetch?: boolean
  onSuccess?: (result: FetchResult) => void
  onError?: (error: unknown) => void
}

const debounce = (func: (...args: unknown[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return (...args: unknown[]): void => {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const useDataList = (fetchFunction: FetchFunction, options: UseDataListOptions = {}) => {
  const { pageSize = 10, defaultFilters = {}, autoFetch = true, onSuccess, onError } = options

  const [data, setData] = useState<DataListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, unknown>>(defaultFilters)

  // 原 33–152 行逐行保留，仅以下标注变化：
  // - fetchData 内 err.message → (err as Error).message
  // - updateItem(id: string | number, updates: Partial<DataListItem>)
  // - deleteItem(id: string | number)、addItem(newItem: DataListItem)
  // - handlePageChange(page: number)、handleFilterChange(newFilters: Record<string, unknown>)
  // ...原实现...

  return { data, loading, initialLoading, error, currentPage, total, pageSize, filters, fetchData, refresh, handlePageChange, handleFilterChange, handleResetFilters, updateItem, deleteItem, addItem }
}

export default useDataList
```

- [ ] **Step 5: 验证**：`npm run typecheck && npm run lint`；浏览器点验地块/设备/会话列表加载与翻页。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/
git commit -m "refactor(frontend): hooks/common 与 useToast 统一为 .ts 并补类型"
```

---

## Task 13: ToastContext 转 .tsx 并消除陷阱契约

**Files:**
- Rename: `frontend/src/contexts/ToastContext.jsx` → `.tsx`
- Modify: `frontend/src/components/ui/ToastContainer.jsx`
- Modify: 6 个调用点（`Login.jsx:551`、`Register.jsx:129`、`ForgotPassword.jsx:125`、`FieldForm.jsx:130`、`SessionForm.jsx:131`、`DeviceForm.jsx:148`）

**背景（已核实）**：6 个页面传入的 `toasts`/`onRemove` 均来自 `useToast()` Context，`ToastContainer` 忽略它们后自行读 Context——渲染结果**完全一致**，删除冗余 props 是零行为变更。

- [ ] **Step 1: `ToastContext.tsx` 全文**

```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  duration: number
}

export interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 3000

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback(
    (message: string, type: ToastType = 'error', duration: number = DEFAULT_DURATION) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, message, type, duration }])
    },
    []
  )

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => addToast(message, 'success', duration ?? DEFAULT_DURATION), [addToast])
  const error = useCallback((message: string, duration?: number) => addToast(message, 'error', duration ?? DEFAULT_DURATION), [addToast])
  const warning = useCallback((message: string, duration?: number) => addToast(message, 'warning', duration ?? DEFAULT_DURATION), [addToast])
  const info = useCallback((message: string, duration?: number) => addToast(message, 'info', duration ?? DEFAULT_DURATION), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToastContext = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }
  return context
}

export default ToastContext
```

- [ ] **Step 2: `ToastContainer.jsx` 头部加契约说明（组件本体不变）**

```jsx
/**
 * Toast 容器 —— 无 props，纯 Context 驱动。
 * 请勿传入 toasts/onRemove（历史误用已清理）；消息通过 useToast() 写入 Context。
 */
```

- [ ] **Step 3: 6 个调用点统一改为 `<ToastContainer />`，并把解构中不再使用的 `toasts, removeToast` 删除**（保留 `showError/showSuccess` 等仍在用的），如 `Login.jsx:22`：

```jsx
const { error: showError, success: showSuccess } = useToast()
```

- [ ] **Step 4: 验证**：`npm run typecheck && npm run lint`；浏览器触发一次登录失败，确认 Toast 弹出（App.jsx:64 的全局容器）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/ToastContext.tsx frontend/src/components/ui/ToastContainer.jsx frontend/src/pages/
git commit -m "refactor(frontend): ToastContext 转 .tsx 补类型；清理 6 处冗余 ToastContainer props（零行为变更）"
```

---

## Task 14: 桶文件策略 + App.jsx 具名导入

**Files:**
- Modify: `frontend/src/pages/index.js`、`frontend/src/pages/Dashboard/index.js:14`
- Create: `frontend/src/pages/Dashboard/MQTT/index.js`
- Delete: `frontend/src/pages/Dashboard/components/index.js`
- Modify: `frontend/src/pages/Dashboard/Fields/index.js`（删 `export * from './components'`）
- Delete: `frontend/src/hooks/auth/index.ts`
- Modify: `frontend/src/App.jsx:4,8-9`

- [ ] **Step 1: `pages/index.js` 末行替换**

```js
// Dashboard 子页面统一导出（具名，供 App.jsx 直接导入；漏导出会被 ESLint no-undef 拦截）
export {
  Overview, Fields, Devices, Sessions, DataUpload, DataView, DataAnalyze,
  System, Logs, AlgorithmSquare, AlgorithmUse, KeyManagement, MQTT,
} from './Dashboard'
```

- [ ] **Step 2: 补齐缺失 barrel，消除特例**

创建 `frontend/src/pages/Dashboard/MQTT/index.js`：

```js
export { default } from './MQTT'
```

`pages/Dashboard/index.js:14`：`export { default as MQTT } from './MQTT/MQTT'` → `export { default as MQTT } from './MQTT'`

- [ ] **Step 3: 删除 3 个零引用死 barrel**

```bash
cd frontend
grep -rn "Dashboard/components'" src/ | grep -v "Dashboard/components/index" || echo "无引用1"
grep -rn "auth'" src/hooks | grep -v "hooks/auth/index" || echo "无引用2"
grep -rn "from './components'" src/pages/Dashboard/Fields/ || echo "无引用3"
git rm src/pages/Dashboard/components/index.js src/hooks/auth/index.ts
```

`Fields/index.js` 删除 `export * from './components'` 行（保留 default 转发）。三项 grep 均「无引用」方可删除。

- [ ] **Step 4: `App.jsx` 具名导入**

第 4 行改为：

```jsx
import {
  Home, About, Contact, Login, Register, ForgotPassword, Dashboard, Feedback, NotFound,
  Overview, Fields, Devices, Sessions, DataUpload, DataView, DataAnalyze,
  System, Logs, AlgorithmSquare, AlgorithmUse, KeyManagement, MQTT,
} from './pages'
```

第 8–9 行（注释 + 解构）删除。

- [ ] **Step 5: 验证**：`npm run typecheck && npm run lint`（漏导出会立即报 `no-undef`/TS 错误——这正是本次改造目的）；浏览器点验 Dashboard 各子路由可渲染，含 `/dashboard/mqtt`。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ frontend/src/hooks/ frontend/src/App.jsx
git commit -m "refactor(frontend): 桶文件策略落地；App.jsx 改具名导入（缺失导出可被门禁拦截）"
```

---

## Task 15: 新增 frontend/README.md 目录约定

**Files:** Create: `frontend/README.md`

- [ ] **Step 1: 写入**

````markdown
# Frontend — Green Tracker

React 18 + Vite 5 + TypeScript。

## 常用命令

```bash
npm run dev        # 开发服务器（端口 3010，API 经 Vite proxy / Nginx 反代）
npm run build      # 生产构建到 dist/
npm run typecheck  # tsc --noEmit（提交前必须通过）
npm run lint       # ESLint（提交前必须通过）
```

## 目录与导入约定

| 目录 | 内容 | 扩展名 |
|---|---|---|
| `src/config/` | 环境变量唯一出口（`env.ts`）、MinIO URL（`minio.ts`） | `.ts` |
| `src/services/` | 后端 API 封装（一个领域一个文件） | `.ts` |
| `src/hooks/` | 自定义 hooks | `.ts` / `.tsx`（含 JSX 时） |
| `src/contexts/` | React Context | `.tsx` |
| `src/components/` | 组件（`ui/` 通用、`business/` 业务、`map/` 地图） | `.jsx` |
| `src/pages/` | 路由页面 | `.jsx` |
| `src/utils/` | 纯函数工具 | `.ts` |

### 规则

1. **环境变量**：`import.meta.env` 只允许出现在 `src/config/env.ts` 与 `src/vite-env.d.ts`。业务代码一律 `import { env } from '@/config/env'`。
2. **API 路径**：请求路径自带 `/api` 前缀（如 `/api/auth/login`）；`env.API_BASE_URL` 是不含 `/api` 的 origin 前缀（默认空=同源）。新增拼接请用 `buildApiUrl('/api/...')`。
3. **桶文件（index.js）**：页面目录的 `index.js` 只做单行 `export { default } from './X'` 转发；上层 `pages/index.js`、`components/*/index.js` 聚合具名导出。**新增页面必须同步加入 `pages/Dashboard/index.js`**，否则 App.jsx 的具名导入会在 lint/typecheck 阶段报错。
4. **组件导入**：从桶文件具名导入（`import { Card } from '@/components/ui'`），禁止 `export * as Namespace` + 运行时解构（曾因此漏解构 KeyManagement 导致白屏）。
5. **Toast**：`ToastContainer` 无 props、由 Context 驱动；写消息用 `useToast()` 的 `success/error/warning/info`。
6. **别名**：`@/` = `src/`。

## 质量门禁

提交前本地必须通过：`npm run typecheck && npm run lint`。仓库级冒烟：项目根 `bash scripts/smoke_test.sh`。
````

- [ ] **Step 2: Commit**

```bash
git add frontend/README.md
git commit -m "docs(frontend): 目录/导入/桶文件约定"
```

---

## Task 16: Nginx 废弃产物清理与 mode 检测对齐

**Files:**
- Delete: `nginx/green-tracker.conf.rendered`（废弃残留，.gitignore:141 自述）
- Modify: `.gitignore:137-141`、`nginx/green-tracker.conf.template:4`、`scripts/nginx.sh`（mode 检测）

- [ ] **Step 1: 删除废弃产物与对应 ignore 条目**

```bash
rm nginx/green-tracker.conf.rendered   # 未跟踪文件，直接删
```

`.gitignore` 的 Nginx 段改为：

```
# Nginx 渲染产物（由 scripts/render_nginx.sh 生成到 nginx/build/）
/nginx/build/
/nginx/.current-mode
```

- [ ] **Step 2: 修正模板错误注释**

`nginx/green-tracker.conf.template:4`「由 scripts/setup_https.sh 自动渲染」→「由 scripts/render_nginx.sh 渲染（make setup-https / serve-dev / serve-prod 触发）」

- [ ] **Step 3: `nginx.sh` 的 mode 检测对齐真实安装物**

先确认实际安装路径：

```bash
grep -n 'sites-available\|sites-enabled\|snippets' scripts/render_nginx.sh scripts/nginx.sh | head -20
```

将 `nginx.sh` 中 mode 的检测逻辑改为**基于已安装站点文件的内容判断**（替换原「检测 /etc/nginx/snippets/green-tracker-frontend.conf 是否存在」的分支）：

```bash
  if [ -f /etc/nginx/sites-enabled/green-tracker ]; then
    if grep -q 'frontend/dist' /etc/nginx/sites-enabled/green-tracker 2>/dev/null; then
      echo "当前前端模式: prod（静态成品 frontend/dist）"
    elif grep -q '3010' /etc/nginx/sites-enabled/green-tracker 2>/dev/null; then
      echo "当前前端模式: dev（Vite 热加载 :3010）"
    else
      echo "当前前端模式: unknown（安装的配置未含已知标记）"
    fi
  else
    echo "[WARN] 未安装站点配置（请先 make setup-https 或 serve-dev / serve-prod）"
  fi
```

（保留函数对外调用方式不变；若 grep 到 render_nginx.sh 实际把片段安装到 `/etc/nginx/snippets/`，则把检测目标改为该真实路径并同样按内容判断。）

- [ ] **Step 4: 验证**

```bash
bash scripts/nginx.sh mode
bash scripts/nginx.sh test 2>&1 | tail -2
bash scripts/smoke_test.sh
```

`mode` 必须输出 prod/dev/unknown 之一，不再输出「尚未记录前端模式」。

- [ ] **Step 5: Commit**

```bash
git add .gitignore nginx/green-tracker.conf.template scripts/nginx.sh
git commit -m "fix(nginx): 删除废弃渲染产物；mode 检测对齐真实安装配置；修正模板注释"
```

---

## Task 17: 脚本缺陷修复 + shell 纪律统一

**Files:**
- Modify: `scripts/stop-services.sh`、`scripts/start-services.sh`、`scripts/minio.sh`、`scripts/postgres-install.sh`、`scripts/grant_db_permissions.sh`

- [ ] **Step 1: `stop-services.sh`（2 处）**

头部（set 行之后）加：

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YELLOW='\033[1;33m'
```

（原 16 行 `bash "$SCRIPT_DIR/minio.sh" stop` 因此修复——此前 `$SCRIPT_DIR` 为空导致执行 `bash "/minio.sh"`，MinIO 实际停不掉。）

- [ ] **Step 2: `start-services.sh`**：头部加 `RED='\033[0;31m'`（修复 61 行 `${RED}` 未定义）

- [ ] **Step 3: `minio.sh`（3 处）**

- 397 行附近：`install_binary "$FORCE_INSTALL"` → `install_binary "${FORCE_INSTALL:-}"`
- 414–418 行 `restart)` 分支：裸命令 `stop` / `start` 改为与主 `stop)` / `start)` 分支**完全相同**的函数调用（读主分支确认，通常形如 `stop_docker || stop_binary` / `start_docker || start_binary`）
- 342–346 行 `test)` 分支：删除对不存在文件 `storage/check_minio.py`、`storage/test_storage.py` 的引用，替换为：

```bash
        echo "暂无内置测试脚本；请运行仓库根目录 scripts/smoke_test.sh"
```

- [ ] **Step 4: `postgres-install.sh`（2 处）**

- 40 行：`postgresql-16-postgis-3` → `"${PG_POSTGIS_PKG:-postgresql-16-postgis-3}"`（并在脚本头部说明可用环境变量覆盖）
- 128 行：`${DB_PORT}` → `${DB_PORT:-5432}`

- [ ] **Step 5: `grant_db_permissions.sh`**：142 行删除「请运行 scripts/init_new_architecture.sh」的提示（该脚本不存在），改为「如需重建数据库，请参考 docs/README.md」

- [ ] **Step 6: 五个脚本统一加 `set -euo pipefail`**（`stop-services.sh`、`start-services.sh`、`postgres-install.sh`、`grant_db_permissions.sh`、`docker-install.sh`，置于 shebang 之后第一行）

- [ ] **Step 7: 语法与功能验证**

```bash
for f in scripts/*.sh; do bash -n "$f" && echo "OK  $f"; done
bash scripts/stop-services.sh && bash scripts/start-services.sh   # 实跑（MinIO 容器启停）
bash scripts/smoke_test.sh
```

- [ ] **Step 8: Commit**

```bash
git add scripts/
git commit -m "fix(scripts): 修复 SCRIPT_DIR/颜色变量未定义、minio restart 不可用、失效引用；统一 set -euo pipefail"
```

---

## Task 18: 后端依赖单一来源

**Files:** Modify: `backend/pyproject.toml`、`backend/requirements.txt`

- [ ] **Step 1: `pyproject.toml` 的 `dependencies` 补齐至与 requirements 一致（21 条，删冗余的 `dotenv==0.9.9`）**

```toml
dependencies = [
    "fastapi==0.124.4",
    "python-dotenv==1.2.1",
    "uvicorn==0.38.0",
    "greenlet==3.3.0",
    "sqlalchemy==2.0.45",
    "psycopg2-binary==2.9.11",
    "passlib==1.7.4",
    "python-jose[cryptography]==3.3.0",
    "email-validator==2.3.0",
    "dnspython==2.8.0",
    "geoalchemy2==0.18.1",
    "minio==7.2.20",
    "python-magic==0.4.27",
    "python-multipart==0.0.22",
    "Pillow==12.1.1",
    "redis==5.0.1",
    "httpx==0.28.1",
    "pyyaml==6.0.3",
    "paho-mqtt>=1.6.1",
]
```

- [ ] **Step 2: 修复 pyproject 其余两处**

- 删除非法入口 `[project.scripts]` 的 `green-tracker = "main:app"`（`main:app` 不是可调用入口，安装时会破坏 `pip install -e .`）
- `packages.find` 改为覆盖全部包：`include = ["api*", "database*", "mqtt*", "storage*", "utils*", "main"]`

- [ ] **Step 3: `requirements.txt` 头部加注**（内容保持与 pyproject 同步）：

```
# 依赖唯一来源为 pyproject.toml（make install 使用 pip install -e .）
# 本文件仅为兼容直接 pip install -r 的场景，新增依赖时两处必须同步修改
```

- [ ] **Step 4: 验证**

```bash
cd backend && pip install -e . 2>&1 | tail -3
python -c "import minio, paho.mqtt.client, PIL, redis, httpx, yaml, multipart; print('ALL_IMPORTS_OK')"
cd .. && bash scripts/smoke_test.sh
```

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/requirements.txt
git commit -m "fix(backend): pyproject 补齐 8 个缺失运行期依赖，成为唯一来源；修非法入口与 packages.find"
```

---

## Task 19: 文档分层重组

**Files:**
- Move: `docs/HTTPS_SETUP.md`、根 `ENV_CONFIG.md` → `docs/setup/`；`docs/database_redesign_v2.md`、`docs/minio_documentation.md` → `docs/architecture/`；`docs/thumbnail_feature_guide.md`、`docs/algorithm_development_guide.md` → `docs/features/`；根 `screen_guide.md` → `docs/ops/`
- Modify: 根 `README.md`（移除 ENV_CONFIG/screen_guide 的旧路径引用）

- [ ] **Step 1: 移动**

```bash
mkdir -p docs/setup docs/architecture docs/features docs/ops
git mv docs/HTTPS_SETUP.md docs/setup/
git mv ENV_CONFIG.md docs/setup/
git mv docs/database_redesign_v2.md docs/architecture/
git mv docs/minio_documentation.md docs/architecture/
git mv docs/thumbnail_feature_guide.md docs/features/
git mv docs/algorithm_development_guide.md docs/features/
git mv screen_guide.md docs/ops/
```

- [ ] **Step 2: 重写 `docs/README.md` 索引**（移除 3 个失效链接：`migration_plan.md`、`registration_flow_testing.md`、`cleanup_report_2026-01-27.md`；新增 plans/ 目录说明）

```markdown
# Green Tracker 文档索引

## 快速开始
- [项目总览 / 架构 / Makefile 命令](../README.md)
- [环境变量配置说明](setup/ENV_CONFIG.md)
- [HTTPS 一键部署](setup/HTTPS_SETUP.md)

## 架构与设计
- [数据库 v2 设计](architecture/database_redesign_v2.md)
- [MinIO 对象存储](architecture/minio_documentation.md)

## 功能指南
- [算法包开发规范](features/algorithm_development_guide.md)
- [缩略图功能](features/thumbnail_feature_guide.md)

## 运维
- [GNU screen 使用指南](ops/screen_guide.md)

## 设计与实施计划
- [结构规范化设计（2026-09-15）](plans/2026-09-15-structure-normalization-design.md)
- [结构规范化实施计划](plans/2026-09-15-structure-normalization-plan.md)
```

- [ ] **Step 3: 修失效引用**

- `README.md:9,467`：删除 `LICENSE` 引用（仓库无此文件）
- `docs/architecture/database_redesign_v2.md:786`：`backend/scripts/migrate_to_v2.py` 引用改为说明文字「（迁移脚本尚未入库）」
- 根 `README.md` 内 `ENV_CONFIG.md` / `screen_guide.md` 的引用改为 `docs/setup/ENV_CONFIG.md` / `docs/ops/screen_guide.md`
- `docs/setup/ENV_CONFIG.md:192` 与 `docs/setup/HTTPS_SETUP.md:210-222`：删除/改写「本项目不区分开发与生产」的过时表述，替换为「dev（Vite 热加载）/ prod（静态成品）双模式，经 `make serve-dev` / `make serve-prod` 切换」
- `docs/setup/ENV_CONFIG.md`：补记 `VITE_DEFAULT_USERNAME` / `VITE_DEFAULT_PASSWORD`；给 `SERVER_PORT` 标注「（当前代码未使用）」
- `docs/setup/HTTPS_SETUP.md` 第 8 节配置速查表补 `scripts/render_nginx.sh` 与 `nginx/snippets/*`

- [ ] **Step 4: 验证**

```bash
# 校验 docs 内相对链接均指向存在的文件
cd docs && grep -rhoE '\]\(([^)#]+\.md)' --include='*.md' . .. \
  | sed 's/](//' | sort -u | while read -r f; do [ -f "$f" ] || echo "BROKEN: $f"; done; echo LINK_CHECK_DONE
```

预期无 `BROKEN` 行。

- [ ] **Step 5: Commit**

```bash
git add docs/ ENV_CONFIG.md screen_guide.md README.md
git commit -m "docs: 分层重组（setup/architecture/features/ops/plans），重建索引并修复全部失效引用"
```

---

## Task 20: 全量回归与收尾

**Files:** 无新增（仅验证与清理）

- [ ] **Step 1: 三门禁 + 构建**

```bash
cd frontend && npm run typecheck && npm run lint && npm run build
cd .. && bash scripts/smoke_test.sh
```

- [ ] **Step 2: 残留全局检查（对照设计验收标准）**

```bash
# 验收3：VITE_API_BASE_URL 读取点收敛为 1 处
grep -rn 'VITE_API_BASE_URL' frontend/src/ | grep -v 'config/env.ts' | grep -v 'vite-env.d.ts' || echo "验收3 OK"
# 验收4：services/hooks/contexts 无 .js
ls frontend/src/services/*.js frontend/src/hooks/*.js frontend/src/hooks/common/*.js frontend/src/contexts/*.jsx 2>/dev/null || echo "验收4 OK"
# 验收5：死 barrel 已移除
ls frontend/src/pages/Dashboard/components/index.js frontend/src/hooks/auth/index.ts 2>/dev/null || echo "验收5 OK"
# import.meta.env 收敛
grep -rn 'import\.meta\.env' frontend/src/ | grep -v 'config/env.ts' | grep -v 'vite-env.d.ts' | grep -v 'components/map/' || echo "收敛 OK（map 组件的 VITE_AMAP_* 见 Step 3）"
```

- [ ] **Step 3: map 组件收尾（如上一步有输出）**

`components/map/FieldMapPicker.jsx:4-6`、`MapDisplay.jsx:4` 的 `VITE_AMAP_KEY/SERVICE_KEY/SECURITY_CODE` 改为 `import { env } from '@/config/env'` 后读取 `env.AMAP_KEY` / `env.AMAP_SERVICE_KEY`（`SECURITY_CODE` 在 `vite-env.d.ts` 已声明，可在 env.ts 补 `AMAP_SECURITY_CODE` 字段后同样迁移）。完成后重跑 Step 2 直至全部 OK。

- [ ] **Step 4: 重启服务实测**

```bash
make stop >/dev/null 2>&1; make dev &   # 或按用户现有 screen 方式重启
sleep 8 && bash scripts/smoke_test.sh
```

浏览器实测：登录 → Dashboard 各子页（含 `/dashboard/mqtt`、`/dashboard/api-keys`）→ 数据视图图片 → 触发一次 Toast。

- [ ] **Step 5: 清理临时文件**

```bash
rm -f /tmp/tsc-baseline.txt /tmp/lint-baseline.txt /tmp/gt_diag.txt /tmp/gt_diag2.txt
```

- [ ] **Step 6: 收尾提交（如有 Step 3 改动）**

```bash
git add frontend/src/components/map/ frontend/src/config/env.ts
git commit -m "refactor(frontend): map 组件接入唯一环境出口，完成全仓收敛"
```

---

## 任务依赖

- Task 0 → Task 1 → Task 2 → Task 3（护栏链，严格顺序）
- Task 4 → 5 → 6 → 7 → 8（环境变量收敛链，严格顺序）
- Task 9、10、11、12、13、14、15 相互独立（可并行，但 12→13 有软依赖：useToast.ts 引用 ToastContext 的路径不变，先后皆可）
- Task 16、17、18 相互独立
- Task 19 独立
- Task 20 最后执行
