# Green Tracker 前端结构与约定

## 技术栈

React 18 + Vite 5 + JavaScript/TypeScript 混合（迁移中：新代码一律 `.ts/.tsx`）。

## 目录结构

```
src/
├── config/        # 环境变量唯一出口（env.ts）、MinIO 地址（minio.ts）
├── contexts/      # React Context（ToastContext.tsx）
├── hooks/         # 自定义 hooks（.ts）
├── services/      # API 服务层（统一 .ts，含 DTO 类型）
├── utils/         # 纯函数工具（format.ts 等）
├── components/    # ui / business / map 三层
├── pages/         # 页面（Dashboard 子页面经 Dashboard/index.js 桶透传）
└── styles/        # 样式
```

## 硬性约定

### 1. 环境变量：唯一出口 `config/env.ts`

- **禁止**在业务代码中直接读 `import.meta.env`（`components/map/*` 为存量豁免，逐步收敛）。
- 所有 `VITE_*` 读取经 `env.ts`，类型声明补在 `src/vite-env.d.ts`。
- `VITE_API_BASE_URL` 是 **origin 前缀，不含 `/api`**。请求路径自带 `/api`（如 `api.get('/api/auth/login')`）。误填 `/api` 会被 `normalizeApiBaseUrl` 剥离并告警。

### 2. TypeScript 门禁

- `npm run typecheck`（tsc --noEmit）必须零错误；提交前自跑。
- 新文件一律 `.ts/.tsx`；改到旧 `.js/.jsx` 文件时顺手转 TS。

### 3. Lint

- `npm run lint` 零 error（warning 基线逐步消化）。
- `no-undef` 是关键规则——曾拦截"漏解构导致整页白屏"类事故。

### 4. 桶文件（barrel）策略

- `pages/index.js`、`pages/Dashboard/index.js`、`components/{ui,business,map}/index.js` 为**活桶**，可被外部 import。
- 组件级局部桶仅当有两个以上消费者时保留；单文件 re-export 的桶一律不建。
- `App.jsx` 使用**具名导入**（`import { Home, ... } from './pages'`），拼写错误在编译期暴露，不再用命名空间解构。

### 5. Toast 契约

`<ToastContainer />` 无 props，自取上下文；调用方仅 `useToast()` 的 `success/error/warning/info`，展示时长经第二参数控制。

## 验证命令

```bash
npm run typecheck   # TS 类型检查
npm run lint        # ESLint
npm run build       # 生产构建
cd .. && bash scripts/smoke_test.sh   # 接口层冒烟（健康/登录/双前缀反例/鉴权/前端入口）
```
