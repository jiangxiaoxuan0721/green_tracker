# 🤝 贡献指南

感谢你愿意为 Green Tracker 出力。本文说明分支、提交、评审与文档约定。
上手开发请先读 [`DEVELOPMENT.md`](DEVELOPMENT.md)，理解系统先看 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

---

## 1. 整体流程

1. Fork 仓库并克隆到本地
2. 从 `master` 切出特性分支
3. 编码 + 自测（过质量门禁）
4. 提交（Conventional Commits）
5. 推送并发起 Pull Request，填写变更说明
6. 通过评审后合并

---

## 2. 分支命名

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat/` | 新功能 | `feat/algorithm-stream-log` |
| `fix/` | 缺陷修复 | `fix/login-404` |
| `refactor/` | 重构、结构优化 | `refactor/structure-normalization` |
| `docs/` | 仅文档改动 | `docs/rewrite-readme` |
| `test/` | 测试补齐 | `test/deploy-tasks-fab` |
| `chore/` | 依赖、脚本、构建 | `chore/bump-vitest` |

---

## 3. 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>(<scope>): <subject>

<body>
```

- `type`：`feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `perf` / `style`
- `scope` 可选，建议用模块名，如 `auth`、`algorithm`、`field`、`nginx`
- `subject` 用祈使句、中文即可，结尾不加句号

示例：

```
fix(auth): 修正 VITE_API_BASE_URL 重复拼接 /api 前缀

环境变量误填会导致请求路径变为 /api/api/...，改为同源相对路径。
```

**提交粒度**：一个提交做一件事，便于单独回滚。大型改动请拆分为多个提交。

---

## 4. 质量门禁

发起 PR 前请确认：

```bash
cd frontend && npm run typecheck && npm run lint && npm run test && npm run build
cd backend && pytest
make check-deps          # 依赖声明与运行环境一致性
bash scripts/smoke_test.sh
```

规则：

- 新增后端依赖**只改** `backend/pyproject.toml`，并同步镜像到 `backend/requirements.txt`
- 新增前端能力请补 `frontend/src/**/*.test.{ts,tsx}` 用例
- 涉及 Nginx / 部署的改动，需在 dev 与 prod 两种模式下各验证一次
- 结构性改动以 `typecheck` + `lint` + 冒烟三道门禁验证

---

## 5. PR 要求

- 标题遵循 Conventional Commits 格式
- 描述说明**动机**、**方案**、**影响范围**与**验证方式**
- 关联相关 Issue
- 涉及 UI 变化请附截图
- 保持 PR 聚焦，避免混入无关改动

---

## 6. 代码约定

| 层 | 约定 |
|----|------|
| 后端 | 路由只做校验与响应组装，业务逻辑放 `db_services`；统一错误模板 |
| 后端 | 响应模型统一构造，避免在多处重复拼装同一响应 |
| 前端 | 提示统一走 `useToast`，不使用 `alert()` |
| 前端 | 请求统一走 `src/services`，路径自带 `/api` 前缀 |
| 环境变量 | 只写在仓库根目录 `.env`；新增变量需同步 `.env.example` 与 [`DEVELOPMENT.md`](DEVELOPMENT.md) 表格 |
| 文档 | 路径一律用「仓库根目录/…」相对路径，禁止绝对路径与本机用户名 |

---

## 7. 文档约定

- 根目录只放 5 篇入口文档：`README.md`、`ARCHITECTURE.md`、`DEVELOPMENT.md`、`CONTRIBUTING.md`、`CHANGELOG.md`
- 专题文档放 `docs/` 下按类型分层：`architecture/`、`features/`、`ops/`、`setup/`
- **改文档请同步 [`docs/README.md`](docs/README.md) 索引**，避免出现孤儿文档
- 版本徽章号取自 `frontend/package.json` 与 `backend/pyproject.toml`，请勿手写
- 更新日志请追加到 [`CHANGELOG.md`](CHANGELOG.md) 的「未发布」段落

---

## 8. 报告问题

提 Issue 请包含：环境（OS / Python / Node / PostgreSQL 版本）、复现步骤、期望与实际结果、相关日志。
涉及敏感信息（密钥、域名、账号）请先脱敏。
