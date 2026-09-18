# Green Tracker Nginx 配置目录

本目录包含 `green-tracker` 站点的 Nginx 反向代理模板与「前端访问模式」片段。

## 文件说明

| 文件 | 作用 |
|------|------|
| `green-tracker.conf.template` | 主站配置模板（包含 `${...}` 占位符），由 `scripts/render_nginx.sh` 渲染后安装到 `/etc/nginx/sites-available/green-tracker` |
| `snippets/frontend-dev.conf` | **开发模式**片段：`location /` 反代到本地 Vite dev server（HMR 热加载） |
| `snippets/frontend-static.conf` | **生产模式**片段：`location /` 由 Nginx 直接服务 `frontend/dist` 静态成品（含 SPA 回退） |
| `ssl-params.conf` | 通用 SSL/TLS 配置（协议版本、加密套件、安全响应头），安装到 `/etc/nginx/snippets/green-tracker-ssl-params.conf` |

主站配置通过 `include /etc/nginx/snippets/green-tracker-frontend.conf;` 引入当前生效的前端片段。
`render_nginx.sh` 会把 `dev` 或 `prod` 片段安装为 `green-tracker-frontend.conf`，从而**一份主配置支持两种运行模式**。

## 架构

```
开发模式   浏览器 → Nginx (:80/:443, 终止 HTTPS)
                     ├── /              → Vite dev server (127.0.0.1:3010)  [HMR]
                     └── /api/, /health → FastAPI 后端   (127.0.0.1:6130)

生产模式   浏览器 → Nginx (:80/:443, 终止 HTTPS)
                     ├── /              → 静态文件 frontend/dist          [成品]
                     └── /api/, /health → FastAPI 后端   (127.0.0.1:6130)
```

## 使用方式

```bash
# 1. 首次配置 HTTPS 证书（自动选择 Let's Encrypt 或自签名）
make setup-https

# 2. 选择前端模式
make serve-dev      # 开发：反代 Vite（热加载）
make deploy         # 生产：make build + 切到静态成品
make mode           # 查看当前模式

# 3. 启动 / 重载 Nginx
sudo make nginx-start
sudo make nginx-reload
sudo make nginx-stop

# 4. 启动应用
make start
make dev
```

### 离线渲染（不安装到系统 Nginx）

```bash
bash scripts/render_nginx.sh prod --render-only
# 产物位于 nginx/build/ 下，便于检查或做语法校验
```

详细说明见 `docs/setup/https-setup.md` 与项目根目录 `README.md` 的「开发环境 vs 生产部署」章节。
