# 算法部署流程重构 Spec**

日期：2026-09-16
作者：controller（基于与用户的 brainstorming）
状态：设计已敲定，待 writing-plans

## 背景与现状

算法上传部署与推理当前存在以下结构性问题：

1. **容器名撞名 bug**：`backend/storage/container_manager.py:43` 使用 `green_tracker_algorithm_{uuid[:8]}` 作为容器名，但 `start_container` 在 `docker run --name` 前**没有清理同名旧容器**，重建算法时直接报错：
   ```
   docker: Error response from daemon: Conflict. The container name "/green_tracker_algorithm_xxxx" is already in use...
   ```

2. **镜像多份 + 无版本控制**：`image_build_service.py:112` 用 `algorithm_{uuid}:latest` 作为构建 tag，重建时 `docker build -t algorithm_{uuid}:latest .` 复用同一 tag，旧镜像成为 `<none>` dangling，逐渐堆积占盘。

3. **端口未真正动态分配**：`port` 由调用方（`algorithm.py:737`）传入；`container_manager._find_available_port` 仅在传入端口冲突时才兜底找新端口；不是自管。

4. **同步阻塞部署**：`trigger_build` 端点同步执行 `download → build → start → health-check`，单次最长可挂 10 分钟。期间前端用 `window.confirm` 弹窗阻塞 + `axios.post timeout: 600000` 等一次性响应——用户既无法切走也无法看到进度。

5. **无流式日志**：`_build_docker_image` 用 `process.communicate()` 一次性等待；前端只能看到「正在构建镜像，请稍候」静态文本。

6. **前端组件本地 state**：`buildingAlgorithm` 存在 `AlgorithmSquare.jsx` 组件本地 state 中，路由切换后丢失，用户切走再回来不知道当前是否在构建。

## 目标

- 把算法部署从「同步阻塞」改为「异步后台任务 + 流式日志」
- 容器和镜像保持**至多一份**（同时只存在一个 running container + 一个 current image tag）
- 容器启动端口**真动态分配**（由 manager 内部统一管理 8001–9999 端口池）
- 前端提供**全局悬浮进度卡片**，路由切换、组件 unmount 都不消失
- 用户可以同时跟踪多个算法的并行构建
- 不引入 WebSocket、sse-starlette、Redis 等额外依赖，仅用 FastAPI `StreamingResponse`

## 非目标

- **不做镜像版本回滚**：每次构建前清理该 uuid 的所有旧 tag，不再保留 build_no 历史
- **不做实时健康检查主动中断**：构建完成后只做一次就绪探针；后续健康检查仍由 `predict` 调用链路自行处理
- **不持久化构建任务到数据库**：in-memory 字典足够；后端崩溃后客户端看见 404 即视作放弃
- **不做流式断线后的手动重连按钮**：浏览器 `fetch` 默认重试，用户无感

## 设计概要

### 架构三层

```
┌─────────────────────────────┐
│  前端：全局悬浮卡片 + zustand store │
└──────────────┬──────────────┘
               │ fetch (NDJSON)
┌──────────────▼──────────────┐
│  FastAPI 路由层（替换 trigger_build）│
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  AlgorithmDeployService（任务调度）│
└──────┬───────────┬───────────┘
       │           │
┌──────▼─────┐ ┌──▼───────────────┐
│ImageBuildSvc│ │ContainerManager │
└──────┬─────┘ └──┬───────────────┘
       │           │
┌──────▼───────────▼───────────────┐
│           docker CLI 子进程     │
└─────────────────────────────┘
```

### Section A：容器管理原子化

#### 命名规范
```python
def container_name(uuid: str) -> str:
    return f"green_tracker_algorithm_{uuid.replace('-', '')}"   # 完整 uuid，零碰撞

def image_tag(uuid: str) -> str:
    return f"algorithm_{uuid.replace('-', '')}:latest"           # 单 tag，无版本号
```

#### 端口池自管（替代旧 `assigned_port` 参数）
```python
class ContainerManager:
    def __init__(self):
        self._port_pool_lock = asyncio.Lock()
        self._allocated_ports: set[int] = set()

    async def allocate_port(self) -> int:
        async with self._port_pool_lock:
            used = self._allocated_ports | await self._scan_docker_used_ports()
            for p in range(8001, 10000):
                if p not in used:
                    self._allocated_ports.add(p)
                    return p
            raise PortExhaustedError

    async def release_port(self, port: int):
        async with self._port_pool_lock:
            self._allocated_ports.discard(port)
```

#### 启动前强前置清理（修撞名 bug）
```python
async def start_container(self, uuid, image, env=None) -> Result:
    name = self.container_name(uuid)
    await self._exec(['docker', 'rm', '-f', name], check=False)   # ★ 关键
    port = await self.allocate_port()
    # ... docker run ...
```

启动失败立刻 `release_port`。

#### 镜像单一实例
```python
# ImageBuildService.build_image 启动前：
old_tags = await self._list_image_tags(uuid)  # 同一 uuid 前缀的所有 tag
for t in old_tags:
    await self._exec(['docker', 'rmi', t], check=False)
# 然后 docker build -t newtag，docker tag newtag :latest
```

`_list_image_tags` 通过 `docker images --format '{{.Repository}}:{{.Tag}}' --filter reference='algorithm_<uuid>'` 实现。

### Section B：异步构建 + NDJSON 流式端点

#### 新建 `algorithm_deploy_service.py`

```python
@dataclass
class BuildTask:
    task_id: str
    algorithm_id: int
    algorithm_uuid: str
    status: str          # queued / building / starting / running / failed / cancelled
    log_lines: list[str]
    result: dict | None
    error: str | None
    _subscribers: list[asyncio.Queue]
    _finished: asyncio.Event

class AlgorithmDeployService:
    _tasks: dict[str, BuildTask]
    _tasks_by_algorithm: dict[int, set[str]]
    _build_locks: dict[int, asyncio.Lock]   # ★ 同一 algorithm 并发构建拒绝（D）

    async def submit_build(self, algorithm_id, algorithm_uuid, *, actor) -> BuildTask:
        lock = self._build_locks.setdefault(algorithm_id, asyncio.Lock())
        if lock.locked():
            raise BuildInProgressError(f"算法 {algorithm_id} 正在构建中")
        await lock.acquire()
        task = BuildTask(task_id=uuid4().hex[:12], ...)
        self._tasks[task.task_id] = task
        asyncio.create_task(self._run(task))
        return task

    async def _run(self, task: BuildTask):
        try:
            # build_image (流式日志) → remove_container → allocate_port
            # → start_container → wait_healthy → finish(running)
            pass
        finally:
            self._build_locks[task.algorithm_id].release()
```

#### 流式日志订阅
`BuildTask.subscribe()` 返回 `asyncio.Queue`，订阅时**先把历史日志灌进队列**（这样新连接的客户端能立即看到之前的内容），然后继续接收实时新行。`finish()` 时往所有 queue 推 `None` 作为终止信号。

#### 端点（替换旧的 `POST /build` 同步端点）
```
POST /api/algorithms/{id}/build
  → 202 {task_id, stream_url}
  → 409 if algorithm 正在构建

GET /api/algorithms/{id}/build/stream?task_id=X
  → 200 application/x-ndjson
  → 404 if task 不存在（后端崩溃语义）

GET /api/algorithms/{id}/build?task_id=X   （可选：一次性查终态）
```

NDJSON 行格式：
```json
{"type": "log",    "line": "[build] 正在下载算法包..."}
{"type": "status", "status": "running", "result": {"port": 8123, "image": "algorithm_xxx:latest", "container_id": "abc123"}}
{"type": "status", "status": "failed", "error": "Dockerfile 语法错误..."}
```

#### 流式改造（关键点）
`ImageBuildService._build_docker_image` 旧实现：
```python
process.communicate()  # 一次性等完成
```

新实现：
```python
async def _build_docker_image(self, context, dockerfile, image_name, log_sink):
    process = await asyncio.create_subprocess_exec(
        'docker', 'build', ...,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    async for line in process.stdout:
        log_sink(line.decode().rstrip())
    rc = await process.wait()
    return rc == 0
```

`start_container` 不再内嵌 `for i in range(30): sleep(1)` 健康检查循环——移到 `wait_healthy(actual_port, timeout=30)` 单独方法，由 deploy_service 在 task 中调用，避免阻塞 stream。

#### 旧端点处理
- `POST /algorithms/{id}/build` → 删除，路由到新端点
- `POST /{id}/stop`、`POST /{id}/restart`、`GET /{id}/status` → 保留并接入新 task_id 概念
- `restart` 内部调用 `submit_build`，复用流程

### Section C：前端全局悬浮卡片

#### 1. zustand store（带 persist）

```ts
// frontend/src/store/useDeployTasksStore.ts
interface DeployTask {
  taskId: string
  algorithmId: number
  algorithmName: string
  status: 'queued' | 'building' | 'starting' | 'running' | 'failed' | 'cancelled' | 'lost'
  logLines: string[]
  result?: { port: number; image: string; containerId: string }
  error?: string
  startedAt: number
  finishedAt?: number
  controller?: AbortController
}

interface DeployTasksState {
  tasks: Record<string, DeployTask>
  collapsed: boolean
  submit: (algorithmId, algorithmName, headers) => Promise<DeployTask>
  cancelStream: (taskId: string) => void
  removeTask: (taskId: string) => void
  toggleCollapsed: () => void
}
```

持久化策略：
- `persist` 中间件 `name: 'deploy_tasks_v1'`
- `partialize` 只持久化 `tasks`，去掉 transient 字段（controller / _subscribers）
- `onRehydrateStorage` 中对每个未 finished 的 task 自动重订阅；后端 404 时标记 `lost`
- throttle 500ms 写 sessionStorage，避免每行日志触发写盘

#### 2. NDJSON 解析器

```ts
// frontend/src/utils/ndjsonStream.ts
export async function* parseNDJSON<T>(response: Response, signal?: AbortSignal) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    if (signal?.aborted) { reader.cancel(); return }
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) yield JSON.parse(line) as T
    }
  }
}
```

#### 3. `<DeployTasksFab />`（顶部条）

- 挂载点：`frontend/src/App.jsx` 在 `<BrowserRouter>` 之内、`<Routes>` 之外 → 路由切换不影响
- 位置：**顶部条**（页面顶部 fixed 半透明横条），**不是**右下角 / 左侧
- 无任务时 `return null`，彻底不渲染
- 折叠态显示 `构建任务 (N 进行中) [Spinner]`；展开后是任务列表
- 单行 `<DeployTaskRow />`：
  - 圆点 + 算法名 + 状态徽章 + 端口（成功后）
  - 点击展开/收起日志（`logLines.join('\n')`，最多保留 500 行）
  - finished 后显示 × 关闭按钮

视觉与项目现有 `Toast`/`PageHeader` 系统保持一致。

#### 4. 生命周期

| 事件 | 行为 |
|---|---|
| 用户点 × | `controller.abort()` + `removeTask(taskId)`（同步从 sessionStorage 移除） |
| 用户切路由 | store 保留 task，订阅继续 |
| 用户浏览器刷新 | sessionStorage hydrate → finished task 直接显示历史；running task 自动重订阅 |
| 后端崩溃 | 订阅收到 404 → task.status = 'lost' |
| 流中断自动重连 | 浏览器默认 fetch 重试，store 重新订阅同一 task_id（H 决策：不需要手动按钮） |

#### 5. 现有 `AlgorithmSquare.jsx` 改造

删除：
- `buildingAlgorithm` 本地 state
- `buildStatus` 文本 state
- `window.confirm` 阻塞弹窗
- `await axios.post(...timeout: 600000)` 同步等

新增：
```tsx
const submit = useDeployTasksStore(s => s.submit)
const handleBuild = async (algorithm) => {
  try {
    await submit(algorithm.id, algorithm.name, getAuthHeaders())
  } catch (e) {
    if (/正在构建/.test(e.message)) {
      toast.warning('该算法正在构建中，请到顶部条查看进度')
    } else {
      toast.error(`提交失败：${e.message}`)
    }
  }
}
```

按钮文案 `构建部署` → `提交构建`；`重新部署` 走同一 submit（后端幂等：先 stop + remove 再 build）。

### Section D：基础设施

#### nginx 模板

在 `nginx/green-tracker.conf.template`（dev + prod snippets 同步）的 `/api` location 块加：
```nginx
proxy_buffering off;        # 关键：让流式响应不被缓冲成块
proxy_cache off;
proxy_read_timeout 600s;    # 构建最长 10 min
proxy_send_timeout 600s;
```

#### 删除 `dockerfile_generator.get_next_port`

端口分配统一归 ContainerManager；`get_next_port` 删除（K 决策）。

## API 契约

| 端点 | 方法 | 请求 | 响应 | 错误码 |
|---|---|---|---|---|
| `/api/algorithms/{id}/build` | POST | `{}` | `202 {task_id, stream_url}` | 404 / 409 / 500 |
| `/api/algorithms/{id}/build/stream` | GET | `?task_id=X` | `200 NDJSON` | 404 |
| `/api/algorithms/{id}/build` | GET | `?task_id=X` | `200 {status, result, error}` | 404 |
| `/api/algorithms/{id}/stop` | POST | `{}` | `200 {status, container_id}` | 404 |
| `/api/algorithms/{id}/restart` | POST | `{}` | `202`（转发到 submit_build） | 404 / 409 |
| `/api/algorithms/{id}/status` | GET | - | `200`（不变） | 404 |

NDJSON 行类型：`{type: "log"}` `{type: "status"}`

## 数据流（一次完整构建）

```
[AlgorithmSquare 卡片] 提交构建
  → useDeployTasksStore.submit(algorithmId, name, headers)
    → POST /api/algorithms/{id}/build
      → AlgorithmDeployService.submit_build
        → 拿 build_lock（已持有则 409）
        → 创建 BuildTask{status: queued}
        → asyncio.create_task(_run)
        → return task
    ← 202 {task_id, stream_url}
    → 注册 task 到 store
    → 后台 subscribeStream(task, headers)  ← fire-and-forget
      → fetch stream_url
      → parseNDJSON
      → 每行 {type:"log"} → store.publish(line)
      → 每行 {type:"status"} → store.setStatus + finish
  ← 返回给 caller（立即返回，不阻塞）

[_run 后台任务]
  → build_image (流式) → remove_container → allocate_port
  → start_container → wait_healthy → finish(running)
  → release build_lock

[DeployTasksFab 顶部条]
  → zustand 订阅 tasks
  → 渲染列表
  → 用户切路由 / 刷新：卡片仍在（顶部条 fixed）
  → finished 任务自动折叠，可点击 × 清理
```

## 错误处理

| 层 | 异常 | 处理 |
|---|---|---|
| 容器清理失败 | `_exec` rc≠0 | warn log + 继续；本次成功优先 |
| 端口耗尽 | `PortExhaustedError` | 503 + "无可用端口" |
| docker 不在 PATH | `FileNotFoundError` | 503 + "请检查 Docker 是否安装" |
| 健康检查超时 | 容器已起但服务未就绪 | status=running + 日志警告；不阻塞 |
| 算法包损坏 | yaml解析失败等 | status=failed + 日志堆栈 |
| 同 algorithm 并发构建 | `build_lock` 已持有 | 409 + toast "已在构建" |
| 流客户端 abort | reader.cancel() | task 仍跑，publish None → no-op |
| 后端崩溃 | 客户端收到 404 | task 标 'lost'，卡片显示"后端已丢失此任务" |

## 测试覆盖

| 测试 | 文件 | 关键 case |
|---|---|---|
| ContainerManager 单元 | `backend/tests/storage/test_container_manager.py` | 命名唯一 / 端口唯一 / start 前 rm 同名 / release 回收 |
| ImageBuildService 单元 | `backend/tests/storage/test_image_build_service.py` | 流式日志 / build 前 rmi 旧 tag |
| AlgorithmDeployService 单元 | `backend/tests/storage/test_algorithm_deploy_service.py` | submit/race/subscribe/concurrent_lock |
| 流式端点集成 | `backend/tests/api/test_algorithm_build_stream.py` | NDJSON 格式 / status 流 / 404 |
| 并发构建拒绝 | 同上 | 第二次 submit 409 |
| store submit + 重连 | `frontend/src/store/useDeployTasksStore.test.ts` | 409 / stream 订阅 / 自动重连 / sessionStorage hydrate |
| NDJSON 解析 | `frontend/src/utils/ndjsonStream.test.ts` | 分块 / 最后一行 / abort |
| `<DeployTasksFab />` 渲染 | `frontend/src/components/deploy/DeployTasksFab.test.tsx` | 空态 / 单任务 / 折叠 / hydrate |

## 落地步骤

1. `backend/storage/container_manager.py`：命名 + 端口池 + 启动前清理 + 流式 + `wait_healthy` 拆出
2. `backend/storage/image_build_service.py`：流式 build + 旧 tag 清理
3. `backend/storage/algorithm_deploy_service.py`：新建（BuildTask + AlgorithmDeployService + build_lock）
4. `backend/api/routes/algorithm.py`：替换 `/build` 同步端点 + 新增 `/build/stream` + `/build` 查询
5. `backend/storage/dockerfile_generator.py`：删除 `get_next_port`
6. `nginx/green-tracker.conf.template` + dev/prod snippets：加 `proxy_buffering off` 等
7. `frontend/src/store/useDeployTasksStore.ts`：新建
8. `frontend/src/utils/ndjsonStream.ts`：新建
9. `frontend/src/components/deploy/DeployTasksFab.tsx` + CSS：新建
10. `frontend/src/App.jsx`：挂载 `<DeployTasksFab />`
11. `frontend/src/pages/Dashboard/AlgorithmSquare/AlgorithmSquare.jsx`：改造 handleBuild/handleRebuild
12. 测试 + `make check-deps` + 冒烟
13. 文档：`docs/features/algorithm.md` + `docs/setup/ENV_CONFIG.md` 加 nginx 段落

## 风险与回退

| 风险 | 影响 | 回退 |
|---|---|---|
| `proxy_buffering off` 影响其他 API 性能 | 极小 | 必要时降级到 `/api/algorithms/*/build/stream` 单独 location |
| in-memory task 状态丢 | 后端重启未完成 task 卡片显示"丢失" | 用户重提交即可 |
| zustand persist 版本演进 | sessionStorage 旧版本结构不兼容 | `name` 加 `_v1` 后缀，将来不兼容时升级到 `_v2` 并写迁移函数 |
| 容器清理失败留 stale state | 启动前全量过滤主动 `rm -f` | 不依赖调用方按顺序 |
| 大量构建任务挤占 sessionStorage | 限 20 个 finished 自动清理最老 | 任务超过上限自动 prune |

## 不在此次改动范围（明确列出）

- 不动用户工作区里未提交的 `.env.example` / `CHANGELOG.md` / `Makefile` / `backend/main.py` / `Dashboard.jsx` / `vite.config.js`（按上一轮约定保留用户控制权）
- 不动其他容器的部署逻辑（MQTT broker、MinIO 等）
- 不引入 Docker Compose / Kubernetes / Helm 等新编排层
- 不实现构建历史审计日志（要持久化时再考虑 DB 化）