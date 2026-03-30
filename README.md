# ai-stock-research-platform

一个面向 `Render + Vercel + Supabase` 的可部署 monorepo：

- `backend/`：FastAPI API 服务，部署到 Render
- `frontend/`：Next.js App Router + TypeScript，部署到 Vercel
- `docs/`：项目文档预留
- `.github/workflows/`：CI 工作流预留

## 目录结构

```text
ai-stock-research-platform/
├─ .github/
│  └─ workflows/
├─ backend/
│  ├─ app/
│  │  ├─ api/v1/
│  │  ├─ core/
│  │  └─ db/
│  ├─ .env.example
│  └─ requirements.txt
├─ docs/
├─ frontend/
│  ├─ app/
│  ├─ lib/
│  └─ .env.example
├─ .gitignore
├─ README.md
└─ render.yaml
```

## 本地启动

### 1. 启动后端

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS / Linux:

```bash
source .venv/bin/activate
```

安装依赖并启动：

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端本地地址：

- 健康检查：`http://localhost:8000/health`
- 数据库检查：`http://localhost:8000/api/v1/health/db`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端本地地址：

- 首页：`http://localhost:3000`

## 环境变量

### Render 后端变量

在 Render 的 Web Service 中配置：

- `DATABASE_URL`：Supabase Postgres 连接串
- `APP_ENV`：建议 `production`
- `CORS_ALLOW_ORIGINS`：例如 `https://YOUR-VERCEL-DOMAIN.vercel.app,http://localhost:3000`

Render 推荐设置：

- Runtime: `Python 3`
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

如果你使用 Render Blueprint，可以直接参考仓库根目录的 `render.yaml`。

### Vercel 前端变量

在 Vercel 项目中配置：

- `NEXT_PUBLIC_API_BASE`：例如 `https://YOUR-RENDER-SERVICE.onrender.com`

Vercel 推荐设置：

- Framework Preset: `Next.js`
- Root Directory: `frontend`
- Install Command: `npm install`
- Build Command: `npm run build`

## Supabase 获取连接串方法

1. 打开 Supabase 控制台。
2. 进入 `Project Settings` -> `Database`。
3. 找到 `Connection string` 或 `Connection pooling`。
4. 复制 `URI` 格式的连接串。
5. 将其填入 Render 的 `DATABASE_URL`。

建议：

- 生产环境优先使用 Supabase 提供的连接池 URI。
- 如果连接串里没有 `sslmode=require`，本项目会在代码里为 PostgreSQL 连接默认补上 `sslmode=require`。
- 如果你使用本地非 SSL PostgreSQL，可以在 `DATABASE_URL` 中显式附加 `?sslmode=disable` 覆盖默认行为。

## 后端说明

- `GET /health`：返回 `{"status":"ok"}`
- `GET /api/v1/health/db`：执行 `select 1` 检查数据库连通性
- 通过 `DATABASE_URL` 连接 Supabase Postgres
- 已内置 CORS 配置，允许前端从 `CORS_ALLOW_ORIGINS` 中声明的域名访问

## 前端说明

- 首页展示 `AI Stock Research Platform`
- 点击“检查后端健康”按钮后，会调用 `${NEXT_PUBLIC_API_BASE}/health`
- 所有请求统一由 `frontend/lib/api.ts` 管理
