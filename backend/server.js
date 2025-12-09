const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(helmet()); // 安全头
app.use(cors()); // 跨域资源共享
app.use(morgan('combined')); // 请求日志
app.use(express.json()); // 解析JSON请求体
app.use(express.urlencoded({ extended: true })); // 解析URL编码的请求体

// 基础路由
app.get('/', (req, res) => {
  res.json({ message: '后端API服务运行正常' });
});

// 示例API路由
app.get('/api/data', (req, res) => {
  res.json({
    title: '欢迎来到前后端分离项目',
    description: '这是一个使用 React + Vite 构建的前端应用',
    features: [
      'React 组件化开发',
      'Vite 快速构建工具',
      'React Router 路由管理',
      '前后端 API 通信'
    ]
  });
});

// 联系表单提交API
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  // 这里可以添加保存到数据库的逻辑
  console.log('收到联系表单:', { name, email, message });
  
  // 模拟处理延迟
  setTimeout(() => {
    res.json({ 
      success: true, 
      message: '消息已收到，我们会尽快回复!' 
    });
  }, 500);
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 http://localhost:${PORT}`);
});