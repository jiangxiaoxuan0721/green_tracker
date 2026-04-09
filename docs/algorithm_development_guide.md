# 算法开发规范指南

本文档指导算法开发者如何打包符合 Green Tracker 算法广场要求的算法包，使其能够被自动构建为容器服务并对外提供 API。

---

## 目录

1. [算法包结构](#1-算法包结构)
2. [algorithm.yaml 配置详解](#2-algorithmyaml-配置详解)
3. [predict.py 服务入口](#3-predictpy-服务入口)
4. [requirements.txt 依赖管理](#4-requirementstxt-依赖管理)
5. [完整示例](#5-完整示例)
6. [常见问题](#6-常见问题)

---

## 1. 算法包结构

算法必须打包为 ZIP 文件，包含以下目录结构：

```
algorithm.zip
├── algorithm.yaml      # 【必需】算法配置文件
├── requirements.txt    # 【可选】Python 依赖
└── src/                # 【必需】源代码目录
    ├── predict.py      # 【必需】FastAPI 服务入口
    └── your_code.py    # 【可选】其他代码文件
```

### 目录结构说明

| 文件/目录 | 必须 | 说明 |
|-----------|------|------|
| `algorithm.yaml` | ✅ | 算法元数据配置 |
| `src/predict.py` | ✅ | FastAPI 服务入口，必须导出 `app` 对象 |
| `requirements.txt` | ❌ | Python 依赖，不提供则使用默认基础镜像 |
| `src/*.py` | ❌ | 其他算法代码文件 |

---

## 2. algorithm.yaml 配置详解

`algorithm.yaml` 是算法的元数据配置文件，用于描述算法基本信息、输入输出规范等。

### 完整配置示例

```yaml
# 算法基本信息
name: "水稻病害识别模型"        # 算法名称（必填）
version: "1.0.0"              # 版本号（必填）
description: "基于YOLOv8的水稻病害识别，可检测稻瘟病、白叶枯病等"  # 算法描述
framework: "pytorch"          # 框架类型（必填）

# 输入配置
input:
  type: "image"                # 输入类型：image | json | file
  formats: ["jpg", "png"]      # 支持的格式（可选）
  max_size: 10485760          # 最大文件大小（字节，默认10MB）
  description: "上传待检测的图片"  # 输入描述

# 输出配置
output:
  type: "json"                 # 输出类型：json | file | image
  description: "返回检测结果，包含病害类型、位置、置信度"

# 算法元数据
metadata:
  author: "张三"               # 作者
  license: "MIT"               # 许可证
  tags:                        # 标签
    - "农业"
    - "病害检测"
    - "YOLOv8"
  dataset: "水稻病害数据集v2"    # 训练数据集
  accuracy: "95.6%"            # 准确率指标
```

### 字段说明

#### 必需字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 算法名称 |
| `version` | string | 版本号，格式：X.Y.Z |
| `framework` | string | 框架类型，见下方列表 |

#### framework 可选值

| 值 | 说明 | 基础镜像 |
|---|------|----------|
| `pytorch` | PyTorch 深度学习框架 | pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime |
| `tensorflow` | TensorFlow 框架 | tensorflow/tensorflow:2.13.0-gpu |
| `onnx` | ONNX 运行时 | onnx/onnxruntime:latest |
| `opencv` | OpenCV 图像处理 | python:3.9-slim |
| `python` | 纯 Python | python:3.9-slim |

#### input 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 输入类型：image / json / file |
| `formats` | array | 支持的文件格式（type=image 时） |
| `max_size` | int | 最大文件大小（字节） |
| `description` | string | 输入描述 |

#### output 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 输出类型：json / file / image |
| `description` | string | 输出描述 |

---

## 3. predict.py 服务入口

`src/predict.py` 是 FastAPI 服务的入口文件，必须包含以下内容：

### 重要：端口配置

**必须读取 `PORT` 环境变量来设置服务端口！**

```python
import os

# 获取端口（重要！）
PORT = int(os.getenv("PORT", "8000"))

# ... 其他代码 ...
```

容器启动时会通过环境变量 `PORT` 传递端口号，必须使用这个端口，否则外部无法访问。

### 必须的接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/predict` | POST | 推理接口，接收输入返回结果 |
| `/health` | GET | 健康检查接口 |

### 最小可用示例

```python
from fastapi import FastAPI, UploadFile, File
from PIL import Image
import io

app = FastAPI()

# ==================== 必须实现 ====================

@app.get("/health")
async def health():
    """健康检查接口 - 用于容器健康监控"""
    return {"status": "ok"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    推理接口

    Args:
        file: 上传的图片文件

    Returns:
        dict: 推理结果
    """
    # 读取图片
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    # TODO: 在此处添加你的推理逻辑
    result = {
        "class": "rice_blast",  # 病害类别
        "confidence": 0.95,      # 置信度
        "bbox": [100, 100, 200, 200]  # 边界框
    }

    return {"success": True, "result": result}

# ==================== 可选实现 ====================

@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "My Algorithm",
        "version": "1.0.0",
        "endpoints": ["/predict", "/health"]
    }
```

### 进阶示例（带模型加载）

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import torch
import torchvision.transforms as transforms
from PIL import Image
import io
import os

app = FastAPI()

# 全局变量存储模型
model = None
transform = None

# ==================== 启动时加载模型 ====================

@app.on_event("startup")
async def load_model():
    """启动时加载模型"""
    global model, transform

    # 加载模型权重（假设模型文件在 src 目录下）
    model_path = os.path.join(os.path.dirname(__file__), "model.pth")

    if os.path.exists(model_path):
        # 加载 PyTorch 模型
        model = torch.load(model_path, map_location='cpu')
        model.eval()

        # 定义图片预处理
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        print("模型加载成功")
    else:
        print("警告: 模型文件不存在，使用模拟结果")

# ==================== 必须接口 ====================

@app.get("/health")
async def health():
    """健康检查接口"""
    return {
        "status": "ok",
        "model_loaded": model is not None
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    图像分类推理接口

    支持的图片格式: JPEG, PNG
    """
    # 验证文件类型
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="只支持 JPEG 或 PNG 格式")

    # 读取并处理图片
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    # 预处理
    if transform:
        image_tensor = transform(image).unsqueeze(0)
    else:
        # 模拟处理（模型不存在时）
        return {
            "success": True,
            "result": {
                "class": "rice_blast",
                "confidence": 0.85,
                "disease": "稻瘟病"
            }
        }

    # 推理
    with torch.no_grad():
        output = model(image_tensor)
        probs = torch.softmax(output, dim=1)
        top_prob, top_class = torch.max(probs, dim=1)

    # 类别映射（根据你的模型调整）
    class_names = {
        0: "健康",
        1: "稻瘟病",
        2: "白叶枯病",
        3: "纹枯病"
    }

    return {
        "success": True,
        "result": {
            "class_id": int(top_class.item()),
            "class_name": class_names.get(int(top_class.item()), "未知"),
            "confidence": float(top_prob.item())
        }
    }

# ==================== 自定义接口示例 ====================

class BatchPredictRequest(BaseModel):
    """批量预测请求"""
    image_urls: list[str]

@app.post("/predict/batch")
async def predict_batch(request: BatchPredictRequest):
    """批量预测接口"""
    results = []
    for url in request.image_urls:
        # TODO: 从 URL 下载图片并推理
        results.append({
            "url": url,
            "result": {"class": "rice_blast", "confidence": 0.9}
        })

    return {"success": True, "results": results}
```

### 接口规范

#### POST /predict

**请求：**
- Content-Type: `multipart/form-data`
- Body: `file` (UploadFile)

**响应：**
```json
{
  "success": true,
  "result": {
    "class": "disease_name",
    "confidence": 0.95,
    ...
  }
}
```

#### GET /health

**响应：**
```json
{
  "status": "ok"
}
```

---

## 4. requirements.txt 依赖管理

`requirements.txt` 用于声明算法运行所需的 Python 依赖。

### 写法规范

```
# 格式：包名==版本号
# 推荐指定版本以确保可复现性

# 核心依赖
torch==2.0.1
torchvision==0.15.2
Pillow==10.0.0
numpy==1.24.3

# Web 框架（通常已包含在基础镜像）
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6

# 数据处理
pandas==2.0.3
opencv-python==4.8.1.78

# 其他工具
requests==2.31.0
Pillow-SIMD==10.0.0
```

### 注意事项

1. **避免安装 CPU/GPU 特定版本**：基础镜像已包含对应版本
2. **控制依赖数量**：只安装必需的包，减小镜像体积
3. **版本锁定**：使用 `==` 精确指定版本

---

## 5. 完整示例

### 示例项目：水稻病害识别

#### 文件结构

```
rice-disease-detection.zip
├── algorithm.yaml
├── requirements.txt
└── src/
    ├── predict.py
    ├── model.pth
    ├── utils.py
    └── config.py
```

#### algorithm.yaml

```yaml
name: "水稻病害识别"
version: "1.0.0"
description: "基于改进YOLOv8的水稻病害识别模型，支持稻瘟病、白叶枯病、纹枯病检测"
framework: "pytorch"

input:
  type: "image"
  formats: ["jpg", "png", "jpeg"]
  max_size: 10485760
  description: "上传水稻叶片图片"

output:
  type: "json"
  description: "返回病害类型、位置坐标、置信度"

metadata:
  author: "张三"
  license: "MIT"
  tags: ["农业", "病害检测", "YOLOv8", "水稻"]
  accuracy: "96.5%"
```

#### requirements.txt

```
torch==2.0.1
torchvision==0.15.2
Pillow==10.0.0
opencv-python==4.8.1.78
ultralytics==8.0.200
numpy==1.24.3
```

#### src/predict.py

```python
from fastapi import FastAPI, UploadFile, File
from PIL import Image
import io
import torch
from ultralytics import YOLO

app = FastAPI()
model = None

@app.on_event("startup")
async def startup_event():
    global model
    model = YOLO("yolov8n.pt")  # 加载预训练模型

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    # 运行检测
    results = model(image)

    # 解析结果
    detections = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            detections.append({
                "class": result.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": box.xyxy[0].tolist()
            })

    return {
        "success": True,
        "count": len(detections),
        "detections": detections
    }
```

---

## 6. 常见问题

### Q1: 上传后构建失败怎么办？

**检查清单：**
1. ✅ `algorithm.yaml` 是否存在且格式正确
2. ✅ `src/predict.py` 是否导出了 `app` 对象
3. ✅ `/predict` 和 `/health` 接口是否实现
4. ✅ `requirements.txt` 中的依赖是否可正常安装

### Q2: 容器启动成功但推理失败？

**可能原因：**
1. 模型文件未正确打包
2. 路径引用错误（应使用 `os.path.dirname(__file__)`）
3. GPU 内存不足

### Q3: 支持 GPU 推理吗？

支持。基础镜像已包含 CUDA 环境：
- `pytorch`: CUDA 11.7 + cuDNN 8
- `tensorflow`: CUDA 11.8 + TensorRT

### Q4: 如何调试？

在 `predict.py` 中使用 `print()` 语句，日志会输出到容器日志。

```python
@app.on_event("startup")
async def startup_event():
    print("========== 容器启动 ==========")
    print("加载模型中...")
    # ...
```

### Q5: 镜像大小有限制吗？

单个镜像建议控制在 5GB 以内，过大的镜像会导致构建超时。

---

## 快速开始

1. **创建目录结构**
   ```bash
   mkdir -p my-algorithm/src
   ```

2. **编写 algorithm.yaml**
   ```bash
   vim my-algorithm/algorithm.yaml
   ```

3. **编写 predict.py**
   ```bash
   vim my-algorithm/src/predict.py
   ```

4. **打包上传**
   ```bash
   cd my-algorithm && zip -r ../my-algorithm.zip .
   ```

5. **上传到算法广场**
   - 访问算法广场页面
   - 点击"分享算法"按钮
   - 填写信息并上传 ZIP 包

---

*最后更新: 2026-04-08*
