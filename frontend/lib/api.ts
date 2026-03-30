import type { ApiErrorResponse, NewsResponse, Quote, SummaryResponse } from "@/lib/types";


export const API_TARGET = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");
const CLIENT_API_BASE = "";


function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${CLIENT_API_BASE}${normalizedPath}`;
}


async function parseError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    const message = payload.error?.message;
    return new Error(message || `Request failed with status ${response.status}`);
  } catch {
    const text = await response.text();
    return new Error(text || `Request failed with status ${response.status}`);
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
    },
  };
}


export async function getQuote(symbol: string): Promise<Quote> {
  return normalizeQuote(await request<unknown>(`/api/v1/quote?symbol=${encodeURIComponent(symbol)}`));
}


export async function getNews(symbol: string, limit = 5): Promise<NewsResponse> {
  return normalizeNews(await request<unknown>(`/api/v1/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`));
}


export async function getSummary(symbol: string): Promise<SummaryResponse> {
  return normalizeSummary(
    await request<unknown>("/api/v1/summary", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    })
  );
}
