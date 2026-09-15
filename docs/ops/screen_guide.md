# Screen 使用指南

## 快速开始

### 1. 创建开发环境
```bash
# 创建名为 "dev" 的会话
screen -S dev

# 在会话内启动服务
conda activate green
make dev
```

### 2. 后台运行（推荐）
```bash
# 一次性创建并启动（会自动分离）
screen -S green-dev -dm -L -Logfile screen_dev.log bash -c "cd /home/jiangxiaoxuan/workspace/green_tracker && source ~/miniconda3/etc/profile.d/conda.sh && conda activate green && make dev"
```

### 3. 常用命令
```bash
# 列出所有会话
screen -ls

# 重新连接会话
screen -r green-dev

# 分离当前会话（保持运行）
Ctrl+A 然后按 D

# 杀死会话
screen -X -S green-dev quit


## 高级用法

### 多会话管理
```bash
# 创建前端会话
screen -S frontend -dm bash -c "cd frontend && npm run dev"

# 创建后端会话  
screen -S backend -dm bash -c "cd backend && source ~/miniconda3/etc/profile.d/conda.sh && conda activate green && python -m uvicorn main:app --reload"

# 查看所有会话
screen -ls

# 分别连接到不同会话
screen -r frontend
screen -r backend
```

### 日志记录
```bash
# 自动记录会话日志
screen -S dev -L -Logfile development.log bash -c "make dev"

# 查看日志
tail -f development.log
```

## 常用快捷键（在 Screen 内）

```
Ctrl+A D     # 分离会话（保持运行）
Ctrl+A ?     # 显示帮助
Ctrl+A K     # 杀死当前窗口
Ctrl+A C     # 创建新窗口
Ctrl+A N     # 下一个窗口
Ctrl+A P     # 上一个窗口
Ctrl+A "     # 显示窗口列表
```

## 实用技巧

1. **持久化开发环境**: 创建 screen 会话后，即使断开 SSH，服务也会继续运行

2. **远程协作**: 多人可以连接到同一个 screen 会话（需要适当权限）

3. **故障恢复**: 如果网络中断，直接重新连接会话即可，无需重启服务

4. **会话清理**: 定期清理不再需要的会话
```bash
screen -wipe
```

## 当前项目会话

当前项目已创建的会话：
- `green-dev`: 开发环境会话，包含前后端服务

管理命令：
```bash
# 查看状态
screen -ls

# 重新连接
screen -r green-dev

# 停止服务
screen -X -S green-dev quit
```