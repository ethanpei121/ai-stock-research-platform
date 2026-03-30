# ai-stock-research-platform

AI Stock Research Platform 是一个面向 `Render + Vercel + Supabase` 的全栈 MVP，支持输入股票代码后快速查看最新行情、相关新闻，以及中文 AI 总结。项目保持单一 monorepo 结构：`backend/` 为 FastAPI API 服务，`frontend/` 为 Next.js App Router 前端。

## 在线演示

- Frontend (Vercel): `https://ai-stock-research-platform.vercel.app`
- Backend (Render): `https://ai-stock-research-platform.onrender.com`

## 技术栈

- Frontend: Next.js 14, App Router, TypeScript, CSS
- Backend: FastAPI, Pydantic Settings, SQLAlchemy, psycopg2-binary
- Data Sources: yfinance, Supabase Postgres
- AI Summary: OpenAI API (`OPENAI_API_KEY` 可选，不存在时自动回退本地模板总结)
- Testing: pytest, FastAPI TestClient
- Deployment: Render, Vercel, Supabase

## 目录结构

```text
ai-stock-research-platform/
├─ backend/
│  ├─ app/
│  │  ├─ api/v1/
│  │  ├─ core/
│  │  ├─ db/
│  │  ├─ schemas/
│  │  └─ services/
│  ├─ tests/
│  ├─ .env.example
│  ├─ pytest.ini
│  └─ requirements.txt
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  └─ .env.example
├─ docs/
├─ .github/workflows/
├─ render.yaml
└─ README.md
```

## 本地运行

### 1. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端接口示例：

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/v1/health/db`
- `GET http://localhost:8000/api/v1/quote?symbol=AAPL`
- `GET http://localhost:8000/api/v1/news?symbol=AAPL&limit=5`
- `POST http://localhost:8000/api/v1/summary`

运行测试：

```powershell
cd backend
pytest -q
```

### 2. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

前端本地地址：`http://localhost:3000`

## 环境变量示例

### backend/.env.example

```env
DATABASE_URL=
APP_ENV=development
CORS_ALLOW_ORIGINS=http://localhost:3000,https://YOUR-VERCEL-DOMAIN.vercel.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

说明：

- `CORS_ALLOW_ORIGINS` 同时支持两种格式：
  - JSON 数组字符串：`["http://localhost:3000","https://xxx.vercel.app"]`
  - 逗号分隔字符串：`http://localhost:3000,https://xxx.vercel.app`
- `OPENAI_API_KEY` 为空时，`/api/v1/summary` 会自动使用本地规则模板生成中文总结。

### frontend/.env.example

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

## 部署配置

### Render (backend)

推荐配置：

- Root Directory: `backend`
- Runtime: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

必填环境变量：

- `DATABASE_URL`
- `APP_ENV=production`
- `CORS_ALLOW_ORIGINS=https://ai-stock-research-platform.vercel.app,http://localhost:3000`

可选环境变量：

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4o-mini`

仓库根目录已附带 `render.yaml` 作为 Blueprint 示例。

### Vercel (frontend)

推荐配置：

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`

必填环境变量：

- `NEXT_PUBLIC_API_BASE=https://ai-stock-research-platform.onrender.com`

### Supabase

获取连接串路径：

1. 打开 Supabase 控制台。
2. 进入 `Project Settings -> Database`。
3. 找到 `Connection string` 或 `Connection pooling`。
4. 复制 `URI` 格式的连接串到 `DATABASE_URL`。

项目会自动为 PostgreSQL URL 补充 `sslmode=require`；如果你使用本地非 SSL Postgres，可手动在 `DATABASE_URL` 中显式加入 `?sslmode=disable` 覆盖默认值。

## API 文档简表

### `GET /health`

返回：

```json
{
  "status": "ok"
}
```

### `GET /api/v1/health/db`

说明：检查 Supabase Postgres 连通性，失败时统一返回错误结构。

成功示例：

```json
{
  "status": "ok",
  "database": "connected"
}
```

### `GET /api/v1/quote?symbol=AAPL`

成功示例：

```json
{
  "symbol": "AAPL",
  "price": 214.31,
  "change": 1.42,
  "change_percent": 0.67,
  "currency": "USD",
  "market_time": "2026-03-30T15:59:00-04:00"
}
```

错误示例：

```json
{
  "error": {
    "code": "INVALID_SYMBOL",
    "message": "股票代码不能为空，请输入类似 AAPL 的代码。",
    "details": null
  }
}
```

### `GET /api/v1/news?symbol=AAPL&limit=5`

成功示例：

```json
{
  "symbol": "AAPL",
  "count": 5,
  "items": [
    {
      "title": "Apple suppliers prepare for AI device cycle",
      "url": "https://example.com/news/apple-ai",
      "published_at": "2026-03-30T14:30:00+00:00",
      "source": "Yahoo Finance"
    }
  ]
}
```

说明：优先使用 yfinance 新闻；若外部新闻源失败，会自动回退到 `mock:fallback` 演示数据。

### `POST /api/v1/summary`

请求体：

```json
{
  "symbol": "AAPL"
}
```

成功示例：

```json
{
  "symbol": "AAPL",
  "generated_at": "2026-03-30T12:00:00+00:00",
  "summary": {
    "bullish": [
      "AAPL 最新报价稳定上行。",
      "最近新闻热度较高，市场关注度仍在。"
    ],
    "bearish": [
      "免费行情源可能存在延迟。",
      "仍需结合财报与估值进一步验证。"
    ],
    "conclusion": "当前更适合做演示和快速筛选，真实投资前建议补充更多基本面信息。"
  },
  "data_points": {
    "price": 214.31,
    "change_percent": 0.67,
    "news_count": 5
  }
}
```

## 统一错误响应格式

所有业务错误都遵循：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "可读错误信息",
    "details": null
  }
}
```

## 已知限制

- yfinance 免费行情和新闻源通常存在 15 到 20 分钟延迟。
- 免费新闻源结构偶尔会变化，因此项目内置了回退 mock，保证演示链路始终可用。
- Render 与 Vercel 免费实例可能存在冷启动，首次请求会稍慢。
- 本项目适合 Demo、研究入口和部署验证，不建议直接作为高频交易决策系统。
