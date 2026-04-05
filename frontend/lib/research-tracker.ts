import type { RecentViewedItem, ResearchStatus, WatchlistItem } from "@/lib/types";
import { normalizeSymbolInput } from "@/lib/symbols";

export const WATCHLIST_STORAGE_KEY = "ai-stock-research.watchlist.v1";
export const RECENT_VIEWS_STORAGE_KEY = "ai-stock-research.recent-views.v1";
export const CLIENT_ID_STORAGE_KEY = "ai-stock-research.client-id.v1";
export const RESEARCH_STATUSES: ResearchStatus[] = ["待研究", "持续跟踪", "观察结束"];
const MAX_RECENT_VIEWS = 8;

type StockReference = {
  symbol: string;
  company_name?: string | null;
  market?: string | null;
  region?: string | null;
  tags?: string[] | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isResearchStatus(value: unknown): value is ResearchStatus {
  return value === "待研究" || value === "持续跟踪" || value === "观察结束";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getOrCreateClientId(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const existing = asString(window.localStorage.getItem(CLIENT_ID_STORAGE_KEY));
  if (existing) {
    return existing;
  }

  const nextId =
    typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `client-${Date.now()}`;

  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, nextId);
  return nextId;
}

function normalizeWatchlistItem(value: unknown): WatchlistItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const symbol = asString(record.symbol);
  if (!symbol) {
    return null;
  }

  const companyName = asString(record.company_name) ?? symbol;
  const addedAt = asString(record.added_at) ?? new Date().toISOString();
  const updatedAt = asString(record.updated_at) ?? addedAt;
  const status = isResearchStatus(record.status) ? record.status : "待研究";

  return {
    symbol: normalizeSymbolInput(symbol),
    company_name: companyName,
    market: asString(record.market),
    region: asString(record.region),
    tags: asStringArray(record.tags).slice(0, 6),
    status,
    added_at: addedAt,
    updated_at: updatedAt,
  };
}

function normalizeRecentViewedItem(value: unknown): RecentViewedItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const symbol = asString(record.symbol);
  if (!symbol) {
    return null;
  }

  return {
    symbol: normalizeSymbolInput(symbol),
    company_name: asString(record.company_name) ?? normalizeSymbolInput(symbol),
    viewed_at: asString(record.viewed_at) ?? new Date().toISOString(),
  };
}

export function loadWatchlist(): WatchlistItem[] {
  if (!canUseStorage()) {
    return [];
  }

  const parsed = safeParse<unknown>(window.localStorage.getItem(WATCHLIST_STORAGE_KEY), []);
  const values = Array.isArray(parsed) ? parsed : [];
  return values
    .map(normalizeWatchlistItem)
    .filter((item): item is WatchlistItem => Boolean(item))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function saveWatchlist(items: WatchlistItem[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
}

export function loadRecentViews(): RecentViewedItem[] {
  if (!canUseStorage()) {
    return [];
  }

  const parsed = safeParse<unknown>(window.localStorage.getItem(RECENT_VIEWS_STORAGE_KEY), []);
  const values = Array.isArray(parsed) ? parsed : [];
  return values
    .map(normalizeRecentViewedItem)
    .filter((item): item is RecentViewedItem => Boolean(item))
    .sort((left, right) => right.viewed_at.localeCompare(left.viewed_at))
    .slice(0, MAX_RECENT_VIEWS);
}

export function saveRecentViews(items: RecentViewedItem[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(RECENT_VIEWS_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_VIEWS)));
}

export function isInWatchlist(items: WatchlistItem[], symbol: string): boolean {
  const normalizedSymbol = normalizeSymbolInput(symbol);
  return items.some((item) => item.symbol === normalizedSymbol);
}

export function upsertWatchlistItem(items: WatchlistItem[], stock: StockReference): WatchlistItem[] {
  const symbol = normalizeSymbolInput(stock.symbol);
  const now = new Date().toISOString();
  const existing = items.find((item) => item.symbol === symbol);

  if (existing) {
    return items
      .map((item) =>
        item.symbol === symbol
          ? {
              ...item,
              company_name: stock.company_name?.trim() || item.company_name,
              market: stock.market?.trim() || item.market,
              region: stock.region?.trim() || item.region,
              tags: stock.tags?.length ? stock.tags.slice(0, 6) : item.tags,
              updated_at: now,
            }
          : item
      )
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  }

  const nextItem: WatchlistItem = {
    symbol,
    company_name: stock.company_name?.trim() || symbol,
    market: stock.market?.trim() || null,
    region: stock.region?.trim() || null,
    tags: stock.tags?.slice(0, 6) ?? [],
    status: "待研究",
    added_at: now,
    updated_at: now,
  };

  return [nextItem, ...items].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function removeWatchlistItem(items: WatchlistItem[], symbol: string): WatchlistItem[] {
  const normalizedSymbol = normalizeSymbolInput(symbol);
  return items.filter((item) => item.symbol !== normalizedSymbol);
}

export function setWatchlistStatus(
  items: WatchlistItem[],
  symbol: string,
  status: ResearchStatus
): WatchlistItem[] {
  const normalizedSymbol = normalizeSymbolInput(symbol);
  const now = new Date().toISOString();

  return items
    .map((item) =>
      item.symbol === normalizedSymbol
        ? {
            ...item,
            status,
            updated_at: now,
          }
        : item
    )
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function upsertRecentViewedItem(items: RecentViewedItem[], stock: StockReference): RecentViewedItem[] {
  const symbol = normalizeSymbolInput(stock.symbol);
  const nextItem: RecentViewedItem = {
    symbol,
    company_name: stock.company_name?.trim() || symbol,
    viewed_at: new Date().toISOString(),
  };

  return [nextItem, ...items.filter((item) => item.symbol !== symbol)].slice(0, MAX_RECENT_VIEWS);
}

export function mergeWatchlists(localItems: WatchlistItem[], remoteItems: WatchlistItem[]): WatchlistItem[] {
  const itemMap = new Map<string, WatchlistItem>();

  for (const item of [...localItems, ...remoteItems]) {
    const existing = itemMap.get(item.symbol);
    if (!existing || item.updated_at > existing.updated_at) {
      itemMap.set(item.symbol, item);
    }
  }

  return [...itemMap.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function mergeRecentViews(localItems: RecentViewedItem[], remoteItems: RecentViewedItem[]): RecentViewedItem[] {
  const itemMap = new Map<string, RecentViewedItem>();

  for (const item of [...localItems, ...remoteItems]) {
    const existing = itemMap.get(item.symbol);
    if (!existing || item.viewed_at > existing.viewed_at) {
      itemMap.set(item.symbol, item);
    }
  }

  return [...itemMap.values()]
    .sort((left, right) => right.viewed_at.localeCompare(left.viewed_at))
    .slice(0, MAX_RECENT_VIEWS);
}
