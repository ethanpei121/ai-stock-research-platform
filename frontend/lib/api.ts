import type { ApiErrorResponse, NewsResponse, Quote, SummaryResponse } from "@/lib/types";


export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(
  /\/+$/,
  ""
);


function buildUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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


export function getQuote(symbol: string): Promise<Quote> {
  return request<Quote>(`/api/v1/quote?symbol=${encodeURIComponent(symbol)}`);
}


export function getNews(symbol: string, limit = 5): Promise<NewsResponse> {
  return request<NewsResponse>(`/api/v1/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
}


export function getSummary(symbol: string): Promise<SummaryResponse> {
  return request<SummaryResponse>("/api/v1/summary", {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });
}
