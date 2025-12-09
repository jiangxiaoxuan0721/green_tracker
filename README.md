# React + Vite 前后端分离项目

这是一个使用 React + Vite 构建的前后端分离项目模板。

## 环境要求

- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器

## 项目结构

```
demo/
├── frontend/         # React + Vite 前端项目
├── backend/          # 后端项目 (可以是 Node.js/Express, Java/Spring Boot 等)
└── README.md         # 项目说明文档
```

## 安装与运行

### 前端项目设置

1. 确保已安装 Node.js
2. 安装前端依赖：
   ```bash
   cd frontend
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 构建生产版本：
   ```bash
   npm run build
   ```

### 后端项目设置

1. 进入后端目录：
   ```bash
   cd backend
   ```

2. 初始化项目 (根据您选择的后端技术)：
   - Node.js/Express: `npm init -y && npm install express cors`
   - Java/Spring Boot: 使用 Spring Initializr
   - Python/FastAPI: `pip install fastapi uvicorn`

3. 启动后端服务器

## 环境变量配置

项目使用环境变量来配置一些关键信息，如默认登录凭据和API地址。

1. 进入前端目录：
   ```bash
   cd frontend
   ```

2. 复制环境变量示例文件：
   ```bash
   cp .env.example .env
   ```

3. 编辑 `.env` 文件，根据需要修改以下变量：
   ```bash
   # 登录凭据配置
   REACT_APP_DEFAULT_USERNAME=admin
   REACT_APP_DEFAULT_PASSWORD=123456

   # API配置
   REACT_APP_API_BASE_URL=http://localhost:3001
   ```

注意：
- 所有React环境变量必须以 `REACT_APP_` 为前缀
- 环境变量文件应位于 `frontend/` 目录下
- 修改环境变量后需要重启开发服务器才能生效
- 请勿将包含敏感信息的 `.env` 文件提交到版本控制系统

## 开发指南

- 前端使用 React + Vite
- 后端可以使用任何您喜欢的技术栈
- 前后端通过 API 进行通信
- 建议使用 RESTful API 设计原则
- 使用环境变量管理配置信息，提高安全性和灵活性