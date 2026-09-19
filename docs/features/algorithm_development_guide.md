# 算法包开发指南

面向算法开发者：如何打包一个能被 Green Tracker 自动构建为容器、并在算法广场上提供在线推理的算法包。

---

## 目录

1. [部署流程总览](#1-部署流程总览)
2. [算法包结构](#2-算法包结构)
3. [algorithm.yaml 规范](#3-algorithmyaml-规范)
4. [src/predict.py 服务入口](#4-srcpredictpy-服务入口)
5. [requirements.txt 规范](#5-requirementstxt-规范)
6. [性能边界](#6-性能边界)
7. [部署状态机与构建日志](#7-部署状态机与构建日志)
8. [完整示例](#8-完整示例)
9. [排错清单](#9-排错清单)
10. [发布检查清单](#10-发布检查清单)

---

## 1. 部署流程总览

上传一个 ZIP，其余由平台完成：

| 阶段 | 平台行为 | 你的代码在此阶段做什么 |
|------|----------|------------------------|
| 1. 上传 | 校验 `.zip` 后缀与大小，流式写入 MinIO（`{算法UUID}/{文件名}`），建库记录 `status=pending` | — |
| 2. 提交构建 | 立即异步创建 build task（同一算法并发提交返回 409） | — |
| 3. 构建镜像 | 下载并解压算法包 → 递归查找 `algorithm.yaml` → 生成 Dockerfile → 清理同前缀旧镜像 → `docker build` → 打 `:latest` 别名 | `framework` 决定基础镜像；`requirements.txt` 决定装什么 |
| 4. 启动容器 | 清理同名旧容器 → 从端口池分配空闲主机端口 → `docker run -p {主机端口}:8000 --memory 4g` | 容器内**固定监听 8000** |
| 5. 健康检查 | 轮询 `http://localhost:{端口}/health`，等待就绪 | `/health` 必须返回 200 |
| 6. 上线 | 写回 `container_port` 与 `docker_image`，`status=running` | 通过 `POST /api/algorithms/{id}/predict` 被调用 |

关键点：**你不需要（也不能）自己指定端口**。容器内部固定 8000，宿主机端口由平台在 8001–9999 之间动态分配并映射进来。

---

## 2. 算法包结构

### 2.1 标准结构

```
my-algorithm.zip
├── algorithm.yaml        # 【必需】元数据（至少要有 framework）
├── requirements.txt      # 【必需】依赖（见第 5 节：镜像不含 fastapi/uvicorn）
└── src/
    ├── predict.py        # 【必需】FastAPI 入口，必须导出 app
    ├── __init__.py       # 【建议】空文件，规避包解析差异
    ├── model.pth         # 【可选】随包分发的模型权重
    └── utils.py          # 【可选】其他代码
```

### 2.2 结构与路径约束

> **规则 1：ZIP 必须在根目录直接包含 `algorithm.yaml`、`requirements.txt`、`src/`，不能多包一层目录。**

打包时请进入目录内部打包：

```bash
cd my-algorithm && zip -r ../my-algorithm.zip .
```

原因：Dockerfile 生成在解压根，`COPY . /app/`，启动命令固定为 `src.predict:app`。若多一层 `my-algorithm/`，`algorithm.yaml` 仍能被递归找到（构建阶段不会报错），但容器启动时 `/app/src/predict.py` 不存在 —— 表现为**构建成功、健康检查超时**。

> **规则 2：`requirements.txt` 必须在解压根，不能放在 `src/` 下。**

Dockerfile 中是 `if [ -f /app/requirements.txt ]`，放在别处会被静默跳过，运行时报 `ModuleNotFoundError`。

> **规则 3：加载随包资源一律用 `__file__` 相对定位。**

```python
from pathlib import Path
MODEL_PATH = Path(__file__).parent / "model.pth"
```

容器工作目录为 `/app`，进程不以 `src/` 为 cwd，硬编码相对路径会失败。

---

## 3. algorithm.yaml 规范

### 3.1 最小可用配置

```yaml
framework: "pytorch"
```

构建阶段**只消费 `framework` 这一个字段**。它决定基础镜像，写错会直接导致依赖装不上或 CUDA 版本不匹配。

### 3.2 完整字段

```yaml
name: "水稻病害识别"        # 记录用途；展示用的名称以上传表单为准
version: "1.0.0"           # 记录用途；展示用的版本以上传表单为准
description: "基于 YOLOv8 的水稻病害识别"
framework: "pytorch"       # ★ 唯一被构建流程消费的字段

input:
  type: "image"            # 记录用途（image / json / file）
  formats: ["jpg", "png"]
  max_size: 10485760       # 记录用途：平台当前不校验推理输入大小
  description: "上传水稻叶片图片"

output:
  type: "json"             # 记录用途（json / file / image）
  description: "病害类型、坐标、置信度"

metadata:
  author: "张三"
  license: "MIT"
  tags: ["农业", "病害检测", "YOLOv8"]
  accuracy: "96.5%"
```

### 3.3 framework 取值与基础镜像

| framework | 基础镜像 | 适用 |
|-----------|----------|------|
| `pytorch` | `pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime` | PyTorch 模型 |
| `tensorflow` | `tensorflow/tensorflow:2.13.0-gpu` | TensorFlow / Keras 模型 |
| `onnx` | `onnx/onnxruntime:latest` | ONNX Runtime 推理（注意 `latest` 为浮动标签） |
| `opencv` | `python:3.9-slim` | 传统图像处理 |
| `python` | `python:3.9-slim` | 纯 Python（**缺省值**） |

未填写或填写未知值时回退到 `python`（`python:3.9-slim`）。

> **注意：`framework` 必须与上传表单中选的框架一致。** 表单值写库、yaml 值选镜像，二者不一致时构建按 yaml 走，算法广场上展示的却是表单值。

> **注意：容器不挂载 GPU**（见 [6.2 计算资源](#62-计算资源)）。带 CUDA 的基础镜像只是让 CUDA 版预编译包可安装，推理仍跑在 CPU 上。

---

## 4. src/predict.py 服务入口

容器启动命令固定为：

```bash
python -m uvicorn src.predict:app --host 0.0.0.0 --port 8000
```

因此 `src/predict.py` 必须存在，且模块级导出名为 `app` 的 FastAPI 实例。

### 4.1 必须实现的接口

| 接口 | 方法 | 说明 | 不实现的后果 |
|------|------|------|--------------|
| `/health` | GET | 返回 200 即视为就绪 | 平台判定启动失败/不健康，`/status` 显示 unreachable |
| `/predict` | POST | `multipart/form-data`，字段名固定为 `file` | 在线推理不可用 |

响应结构与字段由算法自定，平台只透传。`/predict` 非 200 时，平台把状态码与响应体原样返回给调用方。

### 4.2 并发与阻塞（重要）

uvicorn 以**单进程单 worker** 启动：

- 用 `async def` 写 CPU 密集推理会**阻塞事件循环**，导致 `/health` 也无响应，容器被判为 unhealthy；
- 推荐用**同步 `def`**，uvicorn 会自动放到线程池执行，事件循环不被占死。

```python
@app.post("/predict")
def predict(file: UploadFile = File(...)):   # 同步 def，不阻塞事件循环
    ...
```

- 单 worker 意味着**并发请求串行处理**，超出处理能力的请求排队（受 60 s 超时约束，见 [6.3 时间边界](#63-时间边界)）。

### 4.3 最小模板

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import io

app = FastAPI()

ALLOWED = {"image/jpeg", "image/png"}
MAX_BYTES = 10 * 1024 * 1024  # 平台不校验输入大小，需算法自行限制


@app.get("/health")
def health():
    """健康检查：必须返回 200"""
    return {"status": "ok"}


@app.post("/predict")
def predict(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="只支持 JPEG / PNG")

    data = file.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="图片超过 10 MB")

    image = Image.open(io.BytesIO(data)).convert("RGB")

    return {
        "success": True,
        "result": {"class": "rice_blast", "confidence": 0.95},
    }
```

### 4.4 模型加载约定

- 在启动阶段加载模型（`@app.on_event("startup")` 或 lifespan），**不要**在首次请求时懒加载 —— 首请求会撞上 60 s 超时；
- 启动后有 **40 s 健康宽限期**（Docker `start-period`），加载再久也不会立即被判 unhealthy，但会拖长"等待服务就绪"的时间；
- `print()` 可实时输出（`PYTHONUNBUFFERED=1`），经 `docker logs` 与构建日志流可见，是主要的排错手段。

---

## 5. requirements.txt 规范

### 5.1 它实际是必需的

Dockerfile 中的安装是条件式（文件缺失不报错），但启动命令依赖 `uvicorn`、代码依赖 `fastapi` 与 `python-multipart`，而**所有基础镜像都不含这三个包**。不提供 `requirements.txt` 的后果是容器起不来。

最小集合：

```
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
```

### 5.2 写法要求

- 用 `==` 锁定版本，保证可复现；
- **不要重复安装基础镜像已有的框架**（`torch` / `tensorflow` 及其 CUDA 版），既拖慢构建又可能与镜像内置版本冲突。只装镜像没有的、算法真正需要的包；
- 大体积依赖需计入包体与构建耗时预算（见 [6.1 容量边界](#61-容量边界)）。

```txt
# Web 框架（必须）
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6

# 业务依赖（按需，示例）
Pillow==10.0.0
numpy==1.24.3
opencv-python-headless==4.8.1.78
ultralytics==8.0.200
```

> 无头环境请用 `opencv-python-headless`，避免与镜像系统库冲突。

---

## 6. 性能边界

### 6.1 容量边界

| 项目 | 上限 | 生效位置 | 超限后果 |
|------|------|----------|----------|
| 算法包大小 | **1 GB**（1073741824 字节） | 后端 `MAX_ALGORITHM_PACKAGE_SIZE`（应用层兜底）；前端 `env.MAX_FILE_SIZE` | 前端直接拦截；后端返回 **413** |
| 构建期宿主内存占用 | ≈ 算法包大小 | 构建时整体读入内存再落盘 | 包越大，构建期内存峰值越高，存在 OOM 风险 |
| 包内文件数 / 解压体积 | 无硬性限制 | — | 计入构建时间与镜像体积 |

> 实践建议：包体尽量控制在数百 MB 内。1 GB 是"能传"的上限，不是"推荐"值 —— 它既决定构建期内存峰值，也决定镜像体积与后续启动速度。

### 6.2 计算资源

| 资源 | 限额 | 说明 |
|------|------|------|
| 容器内存 | **4 GB**（`--memory 4g --memory-swap 4g`） | memory 与 swap 相等即**无额外 swap 缓冲**，超用直接 OOM 终止；因 `--restart unless-stopped` 会自动重启，表现为"推理到一半就重来" |
| CPU | **不限制** | 未设置 `--cpus`，可打满宿主机 CPU；请主动控制 batch / 线程数 |
| GPU | **不可用** | 启动命令未带 `--gpus`，容器内 `torch.cuda.is_available()` 为 `False`。请勿依赖 CUDA 推理；镜像带 CUDA 仅保证可安装 CUDA 版预编译包 |

### 6.3 时间边界

| 项目 | 数值 | 超限后果 |
|------|------|----------|
| 单次推理 | **60 s**（后端代理 `httpx timeout=60.0`；前端 `axios timeout=60000`） | 后端返回 **504**；前端请求超时 |
| 启动后等待就绪 | 轮询 30 次 × 1 s，单次探测 5 s 超时（常规 ≈30 s，探测挂起时最坏 ≈180 s） | 仅打印告警，状态仍置为 running，但服务可能尚未可用 |
| Docker 健康检查 | `start-period 40s` / `interval 30s` / `timeout 10s` / `retries 3` | 连续 3 次失败标记 `unhealthy` |
| 状态探测 | 5 s（`GET /{id}/status`） | 探测失败返回 `container_status=unreachable` |
| 镜像构建 | **无超时限制** | 依赖装不完会一直构建，任务长期停留在 `building` |

### 6.4 并发与容量池

| 项目 | 边界 | 说明 |
|------|------|------|
| 构建并发 | 同一算法同时仅 1 个构建任务 | 重复提交返回 **409**；不同算法可并行 |
| 主机端口池 | **8001–9999** 动态分配，容器内固定 8000 | 耗尽抛 `PortExhaustedError`，构建失败 |
| 推理并发 | 单 worker 串行 | 请求排队，队列过长触发 60 s 超时 |
| 构建日志缓冲 | 订阅队列 200 行、历史上限 500 行 | 刷屏（如 pip 全量输出）会丢弃中间日志，不影响构建结果 |
| 推理输入大小 | **平台不校验** | 由算法自行限制，否则大文件会吃满 4 GB 内存 |

---

## 7. 部署状态机与构建日志

### 7.1 状态流转

```
pending ──提交构建──> building ──成功──> running
                         │                │
                         └──失败──> error  ├──stop──> stopped
                                          └──restart──> running / error
```

| 状态 | 含义 | 可在线推理 |
|------|------|------------|
| `pending` | 已上传，尚未构建 | 否 |
| `building` | 构建/启动中（上传后自动进入） | 否 |
| `running` | 容器已就绪，端口已写回 | 是 |
| `error` | 构建或启动失败 | 否 |
| `stopped` | 手动停止 | 否 |

`status != running` 时调用推理接口返回 **400**。

### 7.2 构建日志

上传响应返回 `task_id` 与 `stream_url`，订阅 `stream_url` 得到 NDJSON 流：

```jsonc
{"type": "log", "line": "[build] 下载算法包并生成 Dockerfile..."}
{"type": "status", "status": "running", "result": {"port": 8013}, "error": null}
```

- 每行一个 JSON；`type=log` 为日志行，`type=status` 为状态帧（阶段变化时补发，终态必发）；
- 后端重启后任务丢失，可用 `GET /api/algorithms/{id}/build?task_id=...` 回查，任务不存在返回 404；
- 失败时的 `[error]` 行与最近 50 行日志会写入 `build_log`。

---

## 8. 完整示例

### 8.1 目录

```
rice-disease-detection/
├── algorithm.yaml
├── requirements.txt
└── src/
    ├── __init__.py
    ├── predict.py
    └── model.pt
```

### 8.2 algorithm.yaml

```yaml
name: "水稻病害识别"
version: "1.0.0"
description: "基于 YOLOv8 的水稻病害识别，支持稻瘟病、白叶枯病、纹枯病检测"
framework: "pytorch"

input:
  type: "image"
  formats: ["jpg", "png", "jpeg"]
  max_size: 10485760
  description: "上传水稻叶片图片"

output:
  type: "json"
  description: "病害类型、坐标、置信度"

metadata:
  author: "张三"
  license: "MIT"
  tags: ["农业", "病害检测", "YOLOv8", "水稻"]
  accuracy: "96.5%"
```

### 8.3 requirements.txt

```txt
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
Pillow==10.0.0
numpy==1.24.3
```

`torch` / `torchvision` / `ultralytics` 由 `pytorch` 基础镜像与算法自行决定，此处不重复声明镜像已提供的框架。

### 8.4 src/predict.py

```python
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import io
import torch

app = FastAPI()
model = None
MODEL_PATH = Path(__file__).parent / "model.pt"


@app.on_event("startup")
def load_model():
    """启动阶段加载模型，避免首请求撞上 60 s 超时"""
    global model
    if MODEL_PATH.exists():
        model = torch.load(MODEL_PATH, map_location="cpu")
        model.eval()
        print(f"模型加载成功: {MODEL_PATH}")
    else:
        print(f"警告: 未找到模型文件 {MODEL_PATH}")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict")
def predict(file: UploadFile = File(...)):
    """同步 def：CPU 密集推理不阻塞事件循环"""
    if file.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=400, detail="只支持 JPEG / PNG")

    data = file.file.read()
    image = Image.open(io.BytesIO(data)).convert("RGB")

    if model is None:
        raise HTTPException(status_code=503, detail="模型未加载")

    with torch.no_grad():
        output = model(image)

    return {"success": True, "result": {"output": str(output)}}
```

### 8.5 打包与上传

```bash
cd rice-disease-detection
zip -r ../rice-disease-detection.zip .   # 在目录内部打包，不含外层目录
```

算法广场 → 分享算法 → 填写名称/版本/框架（**与 `algorithm.yaml` 的 `framework` 一致**）→ 上传 ZIP。上传成功即自动开始构建，可在顶部任务入口查看实时日志。

---

## 9. 排错清单

| 现象 | 原因 | 处理 |
|------|------|------|
| 构建日志：`算法包缺少 algorithm.yaml` | ZIP 根没有该文件 | 确认在目录内部打包 |
| 构建成功，但健康检查超时 / 容器反复重启 | ZIP 多包了一层目录（`src/` 不在 `/app` 根） | 重新在目录内部打包 |
| `ModuleNotFoundError` | 依赖未声明，或 `requirements.txt` 放在了 `src/` 下 | 移到 ZIP 根并补全依赖 |
| 容器起不来，日志报找不到 `uvicorn` | `requirements.txt` 缺失 | 补 `fastapi` / `uvicorn` / `python-multipart` |
| `Could not import module "src.predict"` | 入口文件路径或 `app` 名称不对 | 确认 `src/predict.py` 且导出 `app` |
| 在线推理返回 504 | 单次推理超过 60 s | 优化模型/输入，或在启动阶段完成加载 |
| 推理中容器被杀、自动重启 | 内存超过 4 GB | 降低 batch、缩小输入、换更轻量模型 |
| `torch.cuda.is_available()` 为 `False` | 容器未挂载 GPU（预期行为） | 改用 CPU 推理 |
| `/status` 显示 `unreachable` | 5 s 内 `/health` 未响应 | 检查推理是否阻塞了事件循环（`async def` 改同步 `def`） |
| 提交构建返回 409 | 该算法已有构建在跑 | 等待当前构建结束 |
| 构建长时间停在 `building` | 依赖安装过慢；构建无超时限制 | 精简依赖，避免在构建期下载大模型 |
| 构建日志缺失中间部分 | 日志缓冲上限（队列 200 / 历史 500 行） | 仅影响展示，可查 `docker logs` |

---

## 10. 发布检查清单

- [ ] ZIP 在目录内部打包，根层直接是 `algorithm.yaml` / `requirements.txt` / `src/`
- [ ] `algorithm.yaml` 的 `framework` 与上传表单选择一致
- [ ] `src/predict.py` 存在且导出 `app`
- [ ] 实现 `GET /health`（返回 200）与 `POST /predict`（字段名 `file`）
- [ ] 推理用同步 `def`，不在 `async def` 中做 CPU 密集计算
- [ ] 模型/资源用 `__file__` 定位，在启动阶段完成加载
- [ ] `requirements.txt` 含 `fastapi` / `uvicorn` / `python-multipart`，版本已锁定，未重复安装基础镜像已有框架
- [ ] 包体 ≤ 1 GB，且远小于此值更佳
- [ ] 峰值内存 < 4 GB，单次推理 < 60 s（实测）
- [ ] 无 CUDA 依赖（`torch.cuda.is_available()` 为 `False` 时仍可运行）
- [ ] 已用 `docker logs` 确认启动日志无异常

---

*最后更新: 2026-09-18*
