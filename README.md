# 绿色追踪系统 (Green Tracker)

一个现代化的IoT环境监测仪表板，提供实时数据可视化、多主题切换和智能设备管理功能。

## 🌟 项目特色

- **实时数据监测**: 温度、湿度、空气质量等环境参数实时展示
- **多主题系统**: 6种精美主题，包括默认、明亮、深色、薄荷绿、日落橙、天空蓝
- **响应式设计**: 完美适配桌面和移动设备
- **可折叠面板**: 优化的用户界面，支持面板收起和展开
- **现代化技术栈**: React 18 + Vite + React Router

## 🚀 技术栈

### 前端
- **React 18.2.0** - 用户界面构建
- **Vite 5.0.8** - 现代化构建工具
- **React Router 6.8.0** - 路由管理
- **Axios 1.6.0** - HTTP请求处理
- **CSS3** - 自定义CSS变量实现主题系统

### 后端
- Node.js/Express (可扩展为其他后端技术)
- RESTful API设计
- 环境变量配置管理

## 📁 项目结构

```
green_tracker/
├── frontend/                 # React前端项目
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── Dashboard/   # 仪表板页面
│   │   │   ├── Home/        # 首页
│   │   │   ├── Login/       # 登录页面
│   │   │   ├── Register/    # 注册页面
│   │   │   ├── About/       # 关于页面
│   │   │   └── Contact/     # 联系页面
│   │   ├── styles/          # 主题样式文件
│   │   │   ├── light-theme.css
│   │   │   ├── dark-theme.css
│   │   │   ├── mint-green-theme.css
│   │   │   ├── sunset-theme.css
│   │   │   └── sky-blue-theme.css
│   │   └── components/      # 共用组件
│   └── package.json
├── backend/                 # 后端项目
└── README.md
```

## 🎨 主题系统

系统提供6种精心设计的主题：

| 主题名称 | 特点 | 适用场景 |
|---------|------|----------|
| 默认黑蓝 | 经典深色专业风格 | 企业环境、夜间使用 |
| 明亮模式 | 清爽浅色设计 | 日间办公、明亮环境 |
| 深色模式 | 纯黑极简风格 | 护眼模式、专注工作 |
| 薄荷绿 | 小清新绿色调 | 自然环保主题 |
| 日落橙 | 温暖橙色调 | 温馨舒适的视觉体验 |
| 天空蓝 | 清新蓝色调 | 科技感与清新并存 |

**主题特点：**
- 仅影响Dashboard页面，其他页面保持默认样式
- 使用CSS自定义属性实现流畅切换
- 支持localStorage持久化存储
- 完整的色彩变量覆盖

## 🛠️ 环境要求

- **Node.js**: v24.11.1+
- **npm**: v11.6.2+

## 📦 安装与运行

### 1. 克隆项目
```bash
git clone <repository-url>
cd green_tracker
```

### 2. 前端设置
```bash
cd frontend
npm install
```

### 3. 环境变量配置
```bash
# 复制环境变量文件
cp .env.example .env

# 编辑环境变量
nano .env
```

环境变量配置示例：
```bash
# 登录凭据
REACT_APP_DEFAULT_USERNAME=admin
REACT_APP_DEFAULT_PASSWORD=123456

# API地址
REACT_APP_API_BASE_URL=http://localhost:3001
```

### 4. 启动开发服务器
```bash
npm run dev
```

### 5. 构建生产版本
```bash
npm run build
```

## 🎯 核心功能

### Dashboard仪表板
- **实时数据展示**: 环境监测数据可视化
- **控制面板**: 可收起的侧边控制栏
- **快速操作**: 右侧快捷操作面板
- **主题切换**: 系统设置中的主题选择器

### 用户系统
- 用户登录/注册
- 登录状态持久化
- 受保护的路由

### 页面导航
- 首页介绍
- 关于我们
- 联系方式
- 仪表板主页面

## 🔧 开发指南

### 代码规范
- 使用ESLint进行代码检查
- 遵循React Hooks最佳实践
- CSS模块化管理

### 主题开发
如需添加新主题：
1. 在`src/styles/`目录创建新的主题CSS文件
2. 定义完整的CSS变量集合
3. 在`index.css`中导入新主题文件
4. 在`ThemeSelector.jsx`中添加主题选项

### API集成
- 使用Axios进行HTTP请求
- 支持环境变量配置API地址
- 错误处理和加载状态管理

## 📱 响应式设计

- **桌面端**: 完整功能的仪表板界面
- **平板端**: 适配的中等尺寸布局
- **移动端**: 简化的移动友好界面

## 🌐 浏览器支持

- Chrome/Edge (推荐)
- Firefox
- Safari
- 现代移动浏览器

## 📝 更新日志

### v1.0.0
- ✅ 基础Dashboard界面
- ✅ 6种主题系统
- ✅ 用户认证系统
- ✅ 响应式设计
- ✅ 可折叠面板功能

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 项目Issues: [GitHub Issues](link-to-issues)
- 邮箱: your-email@example.com

---

**Green Tracker** - 让环境监测更智能、更美观 🌱