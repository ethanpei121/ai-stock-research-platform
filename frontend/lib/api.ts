import type {
  CompareResponse,
  CompareStockResponse,
  AnnouncementsResponse,
  ApiErrorResponse,
  FundamentalsResponse,
  NewsResponse,
  Quote,
  RecentViewedItem,
  RecentViewsResponse,
  RecommendationEvidence,
  RecommendationGroup,
  RecommendationScorecard,
  RecommendationsResponse,
  ResearchStatus,
  SummaryResponse,
  WatchlistItem,
  WatchlistResponse,
} from "@/lib/types";

export const API_TARGET = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

type FreshOptions = {
  fresh?: boolean;
};

type SummaryOptions = FreshOptions & {
  quote?: Quote | null;
  news?: NewsResponse | null;
  includeSupplemental?: boolean;
};

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return normalizedPath;
  }
  return `${API_TARGET}${normalizedPath}`;
}

async function parseError(response: Response): Promise<Error> {
  const fallbackMessage = `Request failed with status ${response.status}`;
  const rawText = await response.text();

  if (!rawText) {
    return new Error(fallbackMessage);
  }

  try {
    const payload = JSON.parse(rawText) as ApiErrorResponse;
    const message = payload.error?.message;
    return new Error(message || rawText || fallbackMessage);
  } catch {
    return new Error(rawText || fallbackMessage);
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 35_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw await parseError(response);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，后端响应时间过长，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeQuote(payload: unknown): Quote {
  const data = (payload ?? {}) as Record<string, unknown>;
  return {
    symbol: asString(data.symbol),
    price: asNumber(data.price),
    change: asNumber(data.change),
    change_percent: asNumber(data.change_percent),
    currency: asString(data.currency, "USD"),
    market_time: asString(data.market_time, new Date().toISOString()),
    provider: asString(data.provider, "Yahoo Finance"),
  };
}

function normalizeNews(payload: unknown): NewsResponse {
  const data = (payload ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items)
    ? data.items.map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
          title: asString(record.title, "Untitled"),
          url: asString(record.url, "#"),
          published_at: asString(record.published_at, new Date().toISOString()),
          source: asString(record.source, "Unknown"),
        };
      })
    : [];

  const derivedProviders = Array.from(
    new Set(
      items
        .map((item) => item.source.split(" / ", 1)[0]?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const providers = Array.isArray(data.providers)
    ? data.providers.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : derivedProviders;

  return {
    symbol: asString(data.symbol),
    count: typeof data.count === "number" ? data.count : items.length,
    items,
    providers,
  };
}

function normalizeAnnouncements(payload: unknown): AnnouncementsResponse {
  const data = (payload ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items)
    ? data.items.map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
          title: asString(record.title, "Untitled"),
          url: asString(record.url, "#"),
          published_at: asString(record.published_at, new Date().toISOString()),
          source: asString(record.source, "Unknown"),
          category: asNullableString(record.category),
        };
      })
    : [];

  return {
    symbol: asString(data.symbol),
    count: typeof data.count === "number" ? data.count : items.length,
    items,
    providers: asStringArray(data.providers),
  };
}

function normalizeFundamentals(payload: unknown): FundamentalsResponse {
  const data = (payload ?? {}) as Record<string, unknown>;

  return {
    symbol: asString(data.symbol),
    as_of: asString(data.as_of, new Date().toISOString()),
    providers: asStringArray(data.providers),
    company_name: asNullableString(data.company_name),
    industry: asNullableString(data.industry),
    listed_date: asNullableString(data.listed_date),
    market_cap: asNullableNumber(data.market_cap),
    float_market_cap: asNullableNumber(data.float_market_cap),
    pe_ratio: asNullableNumber(data.pe_ratio),
    pb_ratio: asNullableNumber(data.pb_ratio),
    roe: asNullableNumber(data.roe),
    gross_margin: asNullableNumber(data.gross_margin),
    net_margin: asNullableNumber(data.net_margin),
    debt_to_asset: asNullableNumber(data.debt_to_asset),
    revenue_growth: asNullableNumber(data.revenue_growth),
    net_profit_growth: asNullableNumber(data.net_profit_growth),
    source_note: asNullableString(data.source_note),
  };
}

function normalizeWatchlistItem(payload: unknown): WatchlistItem {
  const data = (payload ?? {}) as Record<string, unknown>;

  return {
    symbol: asString(data.symbol),
    company_name: asString(data.company_name, asString(data.symbol)),
    market: asNullableString(data.market),
    region: asNullableString(data.region),
    tags: asStringArray(data.tags),
    status:
      data.status === "持续跟踪" || data.status === "观察结束"
        ? data.status
        : "待研究",
    added_at: asString(data.added_at, new Date().toISOString()),
    updated_at: asString(data.updated_at, new Date().toISOString()),
  };
}

function normalizeWatchlist(payload: unknown): WatchlistResponse {
  const data = (payload ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items) ? data.items.map(normalizeWatchlistItem) : [];

  return {
    client_id: asString(data.client_id),
    count: typeof data.count === "number" ? data.count : items.length,
    items,
  };
}

function normalizeRecentViewedItem(payload: unknown): RecentViewedItem {
  const data = (payload ?? {}) as Record<string, unknown>;

  return {
    symbol: asString(data.symbol),
    company_name: asString(data.company_name, asString(data.symbol)),
    viewed_at: asString(data.viewed_at, new Date().toISOString()),
  };
}

function normalizeRecentViews(payload: unknown): RecentViewsResponse {
  const data = (payload ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items) ? data.items.map(normalizeRecentViewedItem) : [];

  return {
    client_id: asString(data.client_id),
    count: typeof data.count === "number" ? data.count : items.length,
    items,
  };
}

function normalizeCompareStock(payload: unknown): CompareStockResponse {
  const data = (payload ?? {}) as Record<string, unknown>;

  return {
    symbol: asString(data.symbol),
    company_name: asNullableString(data.company_name),
    quote: normalizeQuote(data.quote),
    fundamentals: data.fundamentals ? normalizeFundamentals(data.fundamentals) : null,
    news_count: asNumber(data.news_count),
    latest_news_time: asNullableString(data.latest_news_time),
    announcement_count: asNumber(data.announcement_count),
    latest_announcement_time: asNullableString(data.latest_announcement_time),
    highlights: asStringArray(data.highlights),
    data_sources: asStringArray(data.data_sources),
  };
}

function normalizeCompare(payload: unknown): CompareResponse {
  const data = (payload ?? {}) as Record<string, unknown>;

  return {
    generated_at: asString(data.generated_at, new Date().toISOString()),
    items: Array.isArray(data.items) ? data.items.map(normalizeCompareStock) : [],
  };
}

function normalizeSummary(payload: unknown): SummaryResponse {
  const data = (payload ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const meta = (data.meta ?? {}) as Record<string, unknown>;
  const dataPoints = (data.data_points ?? {}) as Record<string, unknown>;

  const bullish = Array.isArray(summary.bullish)
    ? summary.bullish.map((item) => String(item)).filter(Boolean)
    : [];
  const bearish = Array.isArray(summary.bearish)
    ? summary.bearish.map((item) => String(item)).filter(Boolean)
    : [];

  return {
    symbol: asString(data.symbol),
    generated_at: asString(data.generated_at, new Date().toISOString()),
    summary: {
      bullish,
      bearish,
      conclusion: asString(summary.conclusion, "当前暂无可用总结。"),
    },
    data_points: {
      price: asNumber(dataPoints.price),
      change_percent: asNumber(dataPoints.change_percent),
      news_count: asNumber(dataPoints.news_count),
    },
    meta: {
      provider: asString(meta.provider, "template"),
      model: typeof meta.model === "string" ? meta.model : null,
      is_fallback: typeof meta.is_fallback === "boolean" ? meta.is_fallback : true,
      force_refresh_used: typeof meta.force_refresh_used === "boolean" ? meta.force_refresh_used : false,
      quote_provider: asNullableString(meta.quote_provider),
      quote_market_time: asNullableString(meta.quote_market_time),
      latest_news_time: asNullableString(meta.latest_news_time),
      news_providers: asStringArray(meta.news_providers),
    },
  };
}

function normalizeRecommendationScorecard(payload: unknown): RecommendationScorecard {
  const data = (payload ?? {}) as Record<string, unknown>;
  return {
    prosperity: asNumber(data.prosperity, 3),
    valuation: asNumber(data.valuation, 3),
    fund_flow: asNumber(data.fund_flow, 3),
    catalyst: asNumber(data.catalyst, 3),
    total: asNumber(data.total, 3),
    label: asString(data.label, "保持观察"),
  };
}

function normalizeRecommendationEvidence(payload: unknown): RecommendationEvidence {
  const data = (payload ?? {}) as Record<string, unknown>;
  return {
    momentum_1m: asNullableNumber(data.momentum_1m),
    momentum_3m: asNullableNumber(data.momentum_3m),
    volume_ratio: asNullableNumber(data.volume_ratio),
    news_count_7d: asNumber(data.news_count_7d),
    analyst_target_upside: asNullableNumber(data.analyst_target_upside),
    analyst_consensus: typeof data.analyst_consensus === "string" ? data.analyst_consensus : null,
    analyst_opinion_count: asNullableNumber(data.analyst_opinion_count),
    revenue_growth: asNullableNumber(data.revenue_growth),
    earnings_growth: asNullableNumber(data.earnings_growth),
  };
}

function normalizeRecommendationGroups(value: unknown): RecommendationGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((group) => {
    const record = (group ?? {}) as Record<string, unknown>;
    const stocks = Array.isArray(record.stocks)
      ? record.stocks.map((stock) => {
          const stockRecord = (stock ?? {}) as Record<string, unknown>;
          return {
            symbol: asString(stockRecord.symbol),
            company_name: asString(stockRecord.company_name),
            market: asString(stockRecord.market),
            region: asString(stockRecord.region),
            rationale: asString(stockRecord.rationale),
            tags: asStringArray(stockRecord.tags),
            styles: asStringArray(stockRecord.styles),
            scorecard: stockRecord.scorecard ? normalizeRecommendationScorecard(stockRecord.scorecard) : null,
            evidence: stockRecord.evidence ? normalizeRecommendationEvidence(stockRecord.evidence) : null,
            data_sources: asStringArray(stockRecord.data_sources),
          };
        })
      : [];

    return {
      id: asString(record.id),
      category: asString(record.category),
      subcategory: asString(record.subcategory),
      description: asString(record.description),
      stocks,
    };
  });
}

function normalizeRecommendations(payload: unknown): RecommendationsResponse {
  const data = (payload ?? {}) as Record<string, unknown>;
  const groups = normalizeRecommendationGroups(data.groups);
  const derivedCategories = Array.from(
    new Set(groups.map((group) => group.category).filter((value) => value.length > 0))
  );

  return {
    mode: data.mode === "preset" ? "preset" : "live",
    updated_at: asString(data.updated_at, new Date().toISOString()),
    categories: Array.isArray(data.categories)
      ? data.categories.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : derivedCategories,
    style_filters: asStringArray(data.style_filters),
    methodology: asString(data.methodology, "推荐模块会基于真实公开数据动态生成结果。"),
    data_sources: asStringArray(data.data_sources),
    groups,
  };
}

export async function getQuote(symbol: string, options?: FreshOptions): Promise<Quote> {
  const fresh = options?.fresh ? "&fresh=true" : "";
  return normalizeQuote(await request<unknown>(`/api/v1/quote?symbol=${encodeURIComponent(symbol)}${fresh}`));
}

export async function getNews(symbol: string, limit = 5, options?: FreshOptions): Promise<NewsResponse> {
  const fresh = options?.fresh ? "&fresh=true" : "";
  return normalizeNews(await request<unknown>(`/api/v1/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}${fresh}`));
}

export async function getFundamentals(symbol: string): Promise<FundamentalsResponse> {
  return normalizeFundamentals(
    await request<unknown>(`/api/v1/fundamentals?symbol=${encodeURIComponent(symbol)}`, {
      timeoutMs: 45_000,
    })
  );
}

export async function getAnnouncements(symbol: string, limit = 5): Promise<AnnouncementsResponse> {
  return normalizeAnnouncements(
    await request<unknown>(`/api/v1/announcements?symbol=${encodeURIComponent(symbol)}&limit=${limit}`, {
      timeoutMs: 45_000,
    })
  );
}

export async function getCompare(symbols: string[], options?: FreshOptions): Promise<CompareResponse> {
  return normalizeCompare(
    await request<unknown>("/api/v1/compare", {
      method: "POST",
      timeoutMs: 65_000,
      body: JSON.stringify({
        symbols,
        fresh: options?.fresh ?? false,
      }),
    })
  );
}

export async function getWatchlist(clientId: string): Promise<WatchlistResponse> {
  return normalizeWatchlist(
    await request<unknown>(`/api/v1/watchlist?client_id=${encodeURIComponent(clientId)}`, {
      timeoutMs: 35_000,
    })
  );
}

export async function saveWatchlistItem(input: {
  clientId: string;
  symbol: string;
  companyName?: string | null;
  market?: string | null;
  region?: string | null;
  tags?: string[];
  status?: ResearchStatus;
}): Promise<WatchlistItem> {
  return normalizeWatchlistItem(
    await request<unknown>("/api/v1/watchlist", {
      method: "POST",
      timeoutMs: 35_000,
      body: JSON.stringify({
        client_id: input.clientId,
        symbol: input.symbol,
        company_name: input.companyName ?? undefined,
        market: input.market ?? undefined,
        region: input.region ?? undefined,
        tags: input.tags ?? [],
        status: input.status ?? "待研究",
      }),
    })
  );
}

export async function deleteWatchlistItem(clientId: string, symbol: string): Promise<void> {
  await request<unknown>(
    `/api/v1/watchlist/${encodeURIComponent(symbol)}?client_id=${encodeURIComponent(clientId)}`,
    {
      method: "DELETE",
      timeoutMs: 35_000,
    }
  );
}

export async function getRecentViews(clientId: string): Promise<RecentViewsResponse> {
  return normalizeRecentViews(
    await request<unknown>(`/api/v1/recent-views?client_id=${encodeURIComponent(clientId)}`, {
      timeoutMs: 35_000,
    })
  );
}

export async function saveRecentView(input: {
  clientId: string;
  symbol: string;
  companyName?: string | null;
}): Promise<RecentViewedItem> {
  return normalizeRecentViewedItem(
    await request<unknown>("/api/v1/recent-views", {
      method: "POST",
      timeoutMs: 35_000,
      body: JSON.stringify({
        client_id: input.clientId,
        symbol: input.symbol,
        company_name: input.companyName ?? undefined,
      }),
    })
  );
}

export async function getSummary(symbol: string, options?: SummaryOptions): Promise<SummaryResponse> {
  return normalizeSummary(
    await request<unknown>("/api/v1/summary", {
      method: "POST",
      timeoutMs: 50_000,
      body: JSON.stringify({
        symbol,
        fresh: options?.fresh ?? false,
        quote: options?.quote ?? undefined,
        news_items: options?.news?.items ?? [],
        news_providers: options?.news?.providers ?? [],
        include_supplemental: options?.includeSupplemental ?? false,
      }),
    })
  );
}

export async function getRecommendations(): Promise<RecommendationsResponse> {
  return normalizeRecommendations(
    await request<unknown>("/api/v1/recommendations", {
      timeoutMs: 65_000,
    })
  );
}
