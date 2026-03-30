import type {
  ApiErrorResponse,
  NewsResponse,
  Quote,
  RecommendationEvidence,
  RecommendationGroup,
  RecommendationScorecard,
  RecommendationsResponse,
  SummaryResponse,
} from "@/lib/types";

export const API_TARGET = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");
const CLIENT_API_BASE = "";

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
  return `${CLIENT_API_BASE}${normalizedPath}`;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
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

export async function getSummary(symbol: string, options?: SummaryOptions): Promise<SummaryResponse> {
  return normalizeSummary(
    await request<unknown>("/api/v1/summary", {
      method: "POST",
      body: JSON.stringify({
        symbol,
        fresh: options?.fresh ?? true,
        quote: options?.quote ?? undefined,
        news_items: options?.news?.items ?? [],
        news_providers: options?.news?.providers ?? [],
        include_supplemental: options?.includeSupplemental ?? false,
      }),
    })
  );
}

export async function getRecommendations(): Promise<RecommendationsResponse> {
  return normalizeRecommendations(await request<unknown>("/api/v1/recommendations"));
}
