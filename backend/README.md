# 后端 API 服务

这是一个基于 Express.js 的简单后端 API 服务，用于与前端应用进行通信。

## 功能特性

- RESTful API 设计
- CORS 支持，允许前端应用跨域请求
- 安全中间件 (Helmet)
- 请求日志记录 (Morgan)
- JSON 请求体解析

## API 端点

- `GET /` - 基础健康检查端点
- `GET /api/data` - 获取示例数据
- `POST /api/contact` - 处理联系表单提交

## 安装与运行

1. 进入后端目录:
   ```bash
   cd backend
   ```

2. 安装依赖:
   ```bash
   npm install
   ```

3. 启动服务器:
   ```bash
   npm start
   ```
   
   或者使用 nodemon 进行开发 (自动重启):
   ```bash
   npm run dev
   ```

服务器将运行在 http://localhost:5000

## 与前端集成

前端应用配置了代理，将 `/api` 路径的请求转发到后端服务器。因此，前端可以通过以下方式访问后端 API:

```javascript
// 获取数据
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data));

// 提交联系表单
fetch('/api/contact', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '用户名',
    email: 'user@example.com',
    message: '这是一条测试消息'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## 扩展

您可以基于这个简单的后端服务进行扩展:

1. 添加数据库连接 (MongoDB, MySQL, PostgreSQL 等)
2. 实现用户认证与授权 (JWT, Passport.js)
3. 添加更多 API 端点
4. 集成其他中间件和功能