# 全局颜色配置文档

## 概述
本项目使用CSS自定义属性（CSS Variables）来统一管理所有的颜色、间距、阴影等样式配置。这使得整个应用的主题更加一致，并且便于维护和修改。

## 文件结构
```
src/styles/
├── variables.css    # 全局变量定义
└── README.md       # 本文档
```

## 主要颜色变量

### 主色调（黑蓝色主题）
- `--primary-color`: 亮蓝色 `rgba(59, 130, 246, 1)`
- `--primary-light`: `rgba(59, 130, 246, 0.8)`
- `--primary-medium`: `rgba(59, 130, 246, 0.6)`
- `--primary-dark`: `rgba(59, 130, 246, 0.4)`
- `--primary-darker`: `rgba(59, 130, 246, 0.3)`
- `--primary-darkest`: `rgba(59, 130, 246, 0.2)`
- `--primary-subtle`: `rgba(59, 130, 246, 0.1)`

### 背景色
- `--bg-gradient-start`: `#0a0e27`
- `--bg-gradient-mid`: `#1a2347`
- `--bg-gradient-end`: `#0f1b3c`
- `--bg-main`: 主背景渐变
- `--bg-component`: 组件背景色 `#1a2347`
- `--bg-input`: 输入框背景 `rgba(10, 20, 40, 0.6)`
- `--bg-input-focus`: 输入框焦点背景 `rgba(10, 20, 40, 0.8)`
- `--bg-subtle`: 半透明背景 `rgba(26, 26, 46, 0.6)`
- `--bg-subtle-hover`: 悬停背景 `rgba(26, 26, 46, 0.4)`

### 文本颜色
- `--text-primary`: 主要文本 `rgba(255, 255, 255, 0.95)`
- `--text-secondary`: 次要文本 `rgba(255, 255, 255, 0.9)`
- `--text-medium`: 中等文本 `rgba(255, 255, 255, 0.8)`
- `--text-muted`: 弱化文本 `rgba(255, 255, 255, 0.7)`
- `--text-subtle`: 淡化文本 `rgba(255, 255, 255, 0.5)`

### 边框和分割线
- `--border-primary`: 主边框 `var(--primary-darkest)`
- `--border-medium`: 中等边框 `var(--primary-darker)`
- `--border-light`: 亮边框 `var(--primary-dark)`
- `--border-focus`: 焦点边框 `var(--primary-medium)`

### 阴影
- `--shadow-default`: 默认阴影 `0 4px 12px rgba(0, 0, 0, 0.3)`
- `--shadow-hover`: 悬停阴影 `0 8px 20px var(--primary-dark)`
- `--shadow-glow`: 发光效果 `0 0 0 2px var(--primary-darker)`

### 按钮颜色
- `--btn-default-bg`: 默认按钮背景 `#4a5568`
- `--btn-hover-bg`: 悬停按钮背景 `#5a6578`
- `--btn-text`: 按钮文本 `white`

### 状态颜色
- `--success-color`: 成功 `#4caf50`
- `--warning-color`: 警告 `#ff9800`
- `--error-color`: 错误 `#f44336`
- `--info-color`: 信息 `#2196f3`

### 动画过渡
- `--transition-fast`: `0.2s ease`
- `--transition-normal`: `0.3s ease`
- `--transition-slow`: `0.4s ease`

### 间距
- `--spacing-xs`: `0.25rem`
- `--spacing-sm`: `0.5rem`
- `--spacing-md`: `1rem`
- `--spacing-lg`: `1.5rem`
- `--spacing-xl`: `2rem`
- `--spacing-xxl`: `3rem`

### 圆角
- `--radius-sm`: `4px`
- `--radius-md`: `8px`
- `--radius-lg`: `12px`
- `--radius-full`: `50%`

## 使用方法

### 在CSS中使用
```css
.my-component {
  background-color: var(--bg-component);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
}

.my-component:hover {
  background-color: var(--bg-subtle-hover);
  border-color: var(--border-medium);
  box-shadow: var(--shadow-hover);
}
```

### 在JavaScript中动态修改变量
```javascript
// 动态修改主色调
document.documentElement.style.setProperty('--primary-color', '#ff6b6b');
document.documentElement.style.setProperty('--primary-light', 'rgba(255, 107, 107, 0.8)');
```

## 主题切换

通过修改CSS变量，可以轻松实现主题切换。例如，创建一个亮色主题：

```css
[data-theme="light"] {
  --bg-gradient-start: #f8f9fa;
  --bg-gradient-mid: #e9ecef;
  --bg-gradient-end: #dee2e6;
  --text-primary: rgba(33, 37, 41, 0.95);
  --text-secondary: rgba(33, 37, 41, 0.9);
  --primary-color: #0066cc;
  /* ... 其他变量 */
}
```

## 添加新变量

如果需要添加新的变量，请在 `variables.css` 文件的相应部分添加：

```css
:root {
  /* 在相应的类别下添加新变量 */
  --your-new-variable: value;
}
```

## 最佳实践

1. **始终使用变量**：避免在组件CSS中硬编码颜色值
2. **语义化命名**：使用有意义的变量名，如 `--text-primary` 而不是 `--white-95`
3. **保持一致性**：相似的功能使用相同的变量
4. **文档更新**：添加新变量时，记得更新本文档

## 文件引用

所有CSS文件都会通过 `index.css` 自动导入 `variables.css`，确保在所有页面中都可以使用这些变量。