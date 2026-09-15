# HTTPS 一键部署指南

本文介绍如何为 Green Tracker 项目快速部署 HTTPS 反向代理，让用户通过 `https://green-tracker.cn` 访问网站（**URL 中不出现端口号**）。

---

## 1. 设计目标

| 目标 | 实现方式 |
|------|---------|
| 访问地址不出现端口号 | 用 Nginx 监听 80/443，对外只暴露标准端口 |
| 默认主页就是 `https://green-tracker.cn` | HTTP 80 自动 301 跳到 HTTPS 443 |
| 不区分开发/部署 | 开发与生产使用同一套 Nginx + 域名配置 |
| 安全性 | HTTPS 加密 + 安全响应头 + 后端只监听 127.0.0.1 |

---

## 2. 整体架构

```
浏览器（用户）
   │
   │  https://green-tracker.cn（80 自动跳转 443）
   ▼
┌──────────────────────┐
│   Nginx (80/443)     │   ← HTTPS 终止
│   • TLSv1.2/1.3      │
│   • HTTP/2           │
└─────────┬────────────┘
          │
          ├── /               → 127.0.0.1:3010  (Vite dev server / 静态文件)
          ├── /api/*          → 127.0.0.1:6130  (FastAPI 后端)
          ├── /health         → 127.0.0.1:6130/health
          └── /.well-known/   → 用于 Let's Encrypt 验证
```

> **后端只监听 127.0.0.1**，公网无法直接访问 6130，只能通过 Nginx 转发，安全更高。

---

## 3. 一键部署

### 3.1 配置域名解析

在你的域名服务商（如阿里云 / 腾讯云 / Cloudflare）把：

| 记录名 | 类型 | 值 |
|--------|------|------|
| `@` / `green-tracker.cn` | A | 云服务器公网 IP |
| `www`（可选） | A | 云服务器公网 IP |

DNS 生效后，用以下命令验证：

```bash
dig +short green-tracker.cn @8.8.8.8
# 应输出你的服务器公网 IP
```

### 3.2 准备环境

```bash
# 1. 复制环境变量模板
cp .env.example .env
# 编辑 .env，至少确保 DOMAIN=green-tracker.cn

# 2. 安装项目依赖
make install
```

### 3.3 一键配置 HTTPS

```bash
make setup-https
```

该命令会自动：
1. 检测本机是否安装 Nginx，没有就 `apt install nginx`
2. 获取本机公网 IP，DNS 解析是否一致
3. **如果 DNS 已正确解析** → 安装 certbot → 申请 Let's Encrypt 正式证书（90 天自动续期）
4. **否则** → 生成自签名证书（3650 天有效，浏览器会显示警告，可继续访问）
5. 渲染 `nginx/green-tracker.conf.template` → 安装到 `/etc/nginx/sites-available/`
6. 验证配置语法 → reload Nginx

执行成功后，浏览器访问 `https://green-tracker.cn` 即可。

> 若首次拿到的只是自签名证书，等域名解析生效后再次执行 `make setup-https` 即可升级为正式证书。

---

## 4. 证书类型对比

| 特性 | Let's Encrypt | 自签名证书 |
|------|--------------|------------|
| 浏览器信任 | ✅ 完全信任 | ⚠️ 显示"不安全"，需手动确认 |
| 申请条件 | 域名解析到本机 + 80/443 可被外网访问 | 无 |
| 有效期 | 90 天（自动续期） | 3650 天 |
| 适用场景 | 生产环境、域名已解析 | 本地学习、内网测试 |
| 配置复杂度 | 需要 certbot + 公网可达 | 仅需 openssl |

> **本项目定位**：学习用途，自签名证书完全够用。
> 若想对公网开放或让手机访问体验更好，建议在域名解析生效后升级到 Let's Encrypt。

---

## 5. 日常运维命令

```bash
# Nginx 服务管理
make nginx-status       # 查看 Nginx 状态
make nginx-start        # 启动 Nginx（已运行则 reload）
make nginx-stop         # 停止 Nginx
make nginx-restart      # 重启 Nginx
make nginx-reload       # 热加载配置（不中断连接）
make nginx-test         # 验证配置语法

# 应用服务（仍走原有命令）
make dev                # 开发模式（前后端热加载）
make start              # 启动数据库 / MinIO / Nginx
make stop               # 停止所有服务

# HTTPS 重新配置
make setup-https        # 重新申请/更新证书
```

---

## 6. 证书手动续期

### Let's Encrypt

由 `certbot.timer` systemd 定时任务自动续期，无需干预：

```bash
# 查看续期定时器
systemctl list-timers | grep certbot

# 手动测试续期（dry-run）
sudo certbot renew --dry-run

# 手动强制续期
sudo certbot renew
```

### 自签名证书

自签名证书长期有效，不需要续期。如需更换（比如升级为 Let's Encrypt），直接重跑 `make setup-https`。

---

## 7. 故障排查

### 7.1 浏览器提示"连接被拒绝"

- 检查 Nginx 是否运行：`make nginx-status`
- 检查 443 端口是否监听：`sudo ss -tlnp | grep :443`
- 检查云服务商**安全组**是否放行了 80/443（很多新人会忘）

### 7.2 浏览器提示"您的连接不是私密连接"

自签名证书的正常现象。点击 **「高级」** → **「继续前往 green-tracker.cn」** 即可。

> 注意：URL 栏不会显示绿色锁图标，要正式证书才会显示。

### 7.3 前端访问 API 报 CORS 错误

检查 `backend/main.py` 中 CORS 默认值是否包含 `https://${DOMAIN}`：

```python
cors_origins = os.getenv("CORS_ORIGINS",
    "...,http://green-tracker.cn,https://green-tracker.cn")
```

或检查 `.env` 中 `CORS_ORIGINS` 是否包含 HTTPS 域名。

### 7.4 前端访问 API 报 mixed content

HTTPS 页面调用 HTTP 接口导致。**必须**让 `VITE_API_BASE_URL` 留空（同源相对路径，默认值已经是），由 Nginx 反代 `/api`。

> 注意：该变量是 **origin 前缀，不含 `/api`**。代码中所有请求路径已自带 `/api` 前缀，若填成 `/api` 会拼成 `/api/api/...` 导致 404。

### 7.5 Let's Encrypt 申请失败

```
Domain: green-tracker.cn
Type:   unauthorized
Detail: Invalid response from http://green-tracker.cn/.well-known/acme-challenge/...
```

可能原因：
1. 域名没解析到本机 → 检查 DNS：`dig +short green-tracker.cn`
2. 80 端口被防火墙挡住 → 检查云服务商安全组
3. Nginx 没启动 → `make nginx-status`

---

## 8. 配置文件速查

| 文件 | 作用 |
|------|------|
| `.env` | 项目配置（域名、端口、数据库等） |
| `nginx/green-tracker.conf.template` | Nginx 站点模板 |
| `nginx/ssl-params.conf` | SSL 通用参数（TLS 版本 / 加密套件 / 安全响应头） |
| `scripts/setup_https.sh` | 一键申请证书并部署 |
| `scripts/nginx.sh` | Nginx 服务管理 |
| `/etc/nginx/sites-available/green-tracker` | 由脚本自动安装的实际配置 |
| `/etc/letsencrypt/live/<domain>/` | Let's Encrypt 证书存放目录 |

---

## 9. 开发与生产双模式

> 更新（2026-09-15）：早期"只维护一套配置"的设计已演进为 **dev/prod 双模式**——`make serve-dev` 将 Nginx 反代到本机 Vite dev server（HMR 热更新），`make serve-prod` 切换为托管 `frontend/dist` 构建产物。模式由 `scripts/render_nginx.sh` 渲染并记录在 `/nginx/.current-mode`。

| 阶段 | 启动方式 | 行为 |
|------|---------|------|
| 本地开发 | `make serve-dev` | Nginx 反代 Vite dev server，改码即热更新 |
| 部署上线 | `make serve-prod` | Nginx 托管静态构建产物 |
| 离线调试 | `make dev-frontend` + `make dev-backend` | 不经 Nginx，直连 `http://localhost:3010` / `http://localhost:6130` |

两种模式对外均为同一域名 + HTTPS，前端请求路径不变（同源 `/api/...` 反代）。