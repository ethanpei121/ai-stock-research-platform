# ai-stock-research-platform

AI Stock Research Platform 是一个面向 `Render + Vercel + Supabase` 的全栈 MVP，支持输入股票代码后快速查看最新行情、相关新闻、中文 AI 总结，以及一个基于真实价格历史、成交量、新闻热度和分析师一致预期动态打分的推荐股票模块。项目保持单一 monorepo 结构：`backend/` 为 FastAPI API 服务，`frontend/` 为 Next.js App Router 前端。

## 在线演示

- Frontend (Vercel): `https://ai-stock-research-platform.vercel.app`
- Backend (Render): `https://ai-stock-research-platform.onrender.com`

## 技术栈

- Frontend: Next.js 14, App Router, TypeScript, CSS
- Backend: FastAPI, Pydantic Settings, SQLAlchemy, psycopg2-binary
- Market Data: Yahoo Finance、Alpha Vantage（可选）、Finnhub（可选）
- News Data: Yahoo Finance News、Google News RSS、Alpha Vantage News（可选）
- Database: Supabase Postgres
- AI Summary: OpenAI SDK + DashScope OpenAI 兼容模式，支持 OpenAI 与阿里云 Qwen
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

运行测试：

```powershell
cd backend
pytest -q
```

后端接口示例：

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/v1/health/db`
- `GET http://localhost:8000/api/v1/quote?symbol=AAPL`
- `GET http://localhost:8000/api/v1/quote?symbol=300750`
- `GET http://localhost:8000/api/v1/news?symbol=AAPL&limit=5`
- `GET http://localhost:8000/api/v1/recommendations`
- `POST http://localhost:8000/api/v1/summary`

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
OPENAI_BASE_URL=
DASHSCOPE_API_KEY=
DASHSCOPE_MODEL=qwen3-vl-8b-thinking
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
ALPHA_VANTAGE_API_KEY=
FINNHUB_API_KEY=
```

说明：

- `CORS_ALLOW_ORIGINS` 同时支持两种格式：
  - JSON 数组字符串：`["http://localhost:3000","https://xxx.vercel.app"]`
  - 逗号分隔字符串：`http://localhost:3000,https://xxx.vercel.app`
- `OPENAI_API_KEY` 与 `DASHSCOPE_API_KEY` 都为空时，`/api/v1/summary` 会自动使用本地规则模板生成中文总结。
- 不配置额外行情 key 时，默认会使用 `Yahoo Finance` 获取行情，并使用 `Yahoo Finance News + Google News RSS` 聚合新闻。
- 如果你配置了 `ALPHA_VANTAGE_API_KEY` 或 `FINNHUB_API_KEY`，后端会在默认源之外自动启用更多 fallback。
- 如果使用阿里云百炼，请设置 `DASHSCOPE_API_KEY`、`DASHSCOPE_MODEL=qwen3-vl-8b-thinking` 和 `DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`。

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

- `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY`
- `OPENAI_MODEL=gpt-4o-mini` 或 `DASHSCOPE_MODEL=qwen3-vl-8b-thinking`
- `OPENAI_BASE_URL` / `DASHSCOPE_BASE_URL`
- `ALPHA_VANTAGE_API_KEY`
- `FINNHUB_API_KEY`

说明：

- 不配置 `ALPHA_VANTAGE_API_KEY` / `FINNHUB_API_KEY` 也能跑，只是会主要依赖 Yahoo Finance。
- 配置这些 key 后，`/api/v1/quote` 和 `/api/v1/news` 会有更多兜底渠道，线上稳定性更好。

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
  "market_time": "2026-03-30T15:59:00-04:00",
  "provider": "Yahoo Finance"
}
```

说明：

- 默认优先使用 `Yahoo Finance`
- 若你配置了 `ALPHA_VANTAGE_API_KEY` / `FINNHUB_API_KEY`，会自动启用额外 fallback
- 输入 `300750` 时，后端会自动兼容成 `300750.SZ`

### `GET /api/v1/news?symbol=AAPL&limit=5`

成功示例：

```json
{
  "symbol": "AAPL",
  "count": 5,
  "providers": ["Yahoo Finance", "Google News RSS"],
  "items": [
    {
      "title": "Apple suppliers prepare for AI device cycle",
      "url": "https://example.com/news/apple-ai",
      "published_at": "2026-03-30T14:30:00+00:00",
      "source": "Yahoo Finance / Reuters"
    }
  ]
}
```

说明：优先聚合 `Yahoo Finance News`，同时会尝试 `Google News RSS`；如果配置了 `ALPHA_VANTAGE_API_KEY`，也会自动加入新闻聚合。外部新闻都失败时，系统会回退到 `mock:fallback` 演示数据。

### `GET /api/v1/recommendations`

成功示例：

```json
{
  "updated_at": "2026-03-30T12:00:00+00:00",
  "categories": ["科技", "制造", "医药", "金融", "消费", "能源", "原材料", "基建与公用事业"],
  "groups": [
    {
      "id": "tech-ai-infra",
      "category": "科技",
      "subcategory": "AI算力与云基础设施",
      "description": "聚焦算力资本开支、企业级 AI 部署和云平台定价权。",
      "stocks": [
        {
          "symbol": "NVDA",
          "company_name": "英伟达",
          "market": "US",
          "region": "美国",
          "rationale": "GPU 与 AI 训练生态护城河最强。",
          "tags": ["AI", "GPU", "龙头"]
        }
      ]
    }
  ]
}
```

说明：返回按行业与细分赛道分组的推荐股票清单，前端可直接点击任意标的进入单票分析。

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
  },
  "meta": {
    "provider": "dashscope",
    "model": "qwen3-vl-8b-thinking",
    "is_fallback": false
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

- `Yahoo Finance`、`Google News RSS` 等免费源可能存在延迟、频率限制或结构变化。
- 未配置 `ALPHA_VANTAGE_API_KEY` / `FINNHUB_API_KEY` 时，行情兜底能力会弱一些。
- Render 与 Vercel 免费实例可能存在冷启动，首次请求会稍慢。
- 本项目适合 Demo、研究入口和部署验证，不建议直接作为高频交易决策系统。



