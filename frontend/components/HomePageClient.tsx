"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AnalysisDrawer } from "@/components/AnalysisDrawer";
import { CompareWorkspace } from "@/components/CompareWorkspace";
import { ResearchWorkspace } from "@/components/ResearchWorkspace";
import { RecommendationsWorkspace } from "@/components/RecommendationsWorkspace";
import {
  deleteWatchlistItem,
  getCompare,
  getQuote,
  getRecentViews,
  getRecommendations,
  getWatchlist,
  saveRecentView,
  saveWatchlistItem,
} from "@/lib/api";
import { DEFAULT_RECOMMENDATIONS } from "@/lib/default-recommendations";
import {
  getOrCreateClientId,
  loadRecentViews,
  loadWatchlist,
  mergeRecentViews,
  mergeWatchlists,
  removeWatchlistItem as removeWatchlistItemLocal,
  saveRecentViews,
  saveWatchlist,
  setWatchlistStatus,
  upsertRecentViewedItem,
  upsertWatchlistItem,
} from "@/lib/research-tracker";
import type {
  AsyncSection,
  CompareResponse,
  Quote,
  RecentViewedItem,
  RecommendationsResponse,
  ResearchStatus,
  WatchlistItem,
} from "@/lib/types";

const createSection = <T,>(status: AsyncSection<T>["status"] = "idle"): AsyncSection<T> => ({
  status,
  data: null,
  error: null,
});

type RecommendationQuoteMap = Record<string, AsyncSection<Quote>>;
const RECOMMENDATION_QUOTE_CONCURRENCY = 4;
const MAX_COMPARE_SYMBOLS = 4;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function parseCompareSymbols(rawValue: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  const values = rawValue
    .split(",")
    .map((item) => normalizeSymbol(item))
    .filter(Boolean);

  return Array.from(new Set(values)).slice(0, MAX_COMPARE_SYMBOLS);
}

function buildQuoteHydrationSymbols(
  data: RecommendationsResponse,
  selectedCategory: string,
  selectedStyle: string,
  activeSymbol: string,
  watchlist: WatchlistItem[],
  recentViews: RecentViewedItem[]
): string[] {
  const symbols: string[] = [];

  if (activeSymbol) {
    symbols.push(activeSymbol);
  }

  for (const group of data.groups) {
    if (selectedCategory !== "全部" && group.category !== selectedCategory) {
      continue;
    }

    for (const stock of group.stocks) {
      if (selectedStyle !== "全部" && !stock.styles.includes(selectedStyle)) {
        continue;
      }
      symbols.push(stock.symbol.toUpperCase());
    }
  }

  for (const item of watchlist) {
    symbols.push(item.symbol.toUpperCase());
  }

  for (const item of recentViews) {
    symbols.push(item.symbol.toUpperCase());
  }

  return Array.from(new Set(symbols));
}

async function hydrateQuotesWithConcurrency(
  symbols: string[],
  workerCount: number,
  worker: (symbol: string) => Promise<void>
): Promise<void> {
  const queue = [...symbols];
  const totalWorkers = Math.min(workerCount, queue.length);

  await Promise.all(
    Array.from({ length: totalWorkers }, async () => {
      while (queue.length > 0) {
        const symbol = queue.shift();
        if (!symbol) {
          return;
        }
        await worker(symbol);
      }
    })
  );
}

export function HomePageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlActiveSymbol = normalizeSymbol(searchParams.get("symbol") ?? "");
  const rawCompareParam = searchParams.get("compare");
  const urlCompareSymbols = parseCompareSymbols(rawCompareParam);
  const [selectedRecommendationCategory, setSelectedRecommendationCategory] = useState("全部");
  const [selectedRecommendationStyle, setSelectedRecommendationStyle] = useState("全部");
  const [recommendationSection, setRecommendationSection] = useState<AsyncSection<RecommendationsResponse>>({
    status: "success",
    data: DEFAULT_RECOMMENDATIONS,
    error: null,
  });
  const [isRecommendationRefreshing, setIsRecommendationRefreshing] = useState(false);
  const [recommendationRefreshError, setRecommendationRefreshError] = useState<string | null>(null);
  const [recommendationQuoteSnapshots, setRecommendationQuoteSnapshots] = useState<RecommendationQuoteMap>({});
  const recommendationQuoteSnapshotsRef = useRef<RecommendationQuoteMap>({});

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [recentViews, setRecentViews] = useState<RecentViewedItem[]>([]);
  const [researchClientId, setResearchClientId] = useState<string | null>(null);
  const [isResearchTrackerReady, setIsResearchTrackerReady] = useState(false);

  const [compareSection, setCompareSection] = useState<AsyncSection<CompareResponse>>(createSection());
  const [isCompareRefreshing, setIsCompareRefreshing] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState(urlActiveSymbol);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(urlCompareSymbols);
  const isPanelOpen = activeSymbol.length > 0;

  const data = recommendationSection.status === "success" ? recommendationSection.data : null;
  let activeCompanyName: string | null = null;

  if (data) {
    for (const group of data.groups) {
      const matched = group.stocks.find((stock) => stock.symbol.toUpperCase() === activeSymbol);
      if (matched) {
        activeCompanyName = matched.company_name;
        break;
      }
    }
  }

  if (!activeCompanyName) {
    activeCompanyName =
      watchlist.find((item) => item.symbol === activeSymbol)?.company_name ??
      recentViews.find((item) => item.symbol === activeSymbol)?.company_name ??
      compareSection.data?.items.find((item) => item.symbol === activeSymbol)?.company_name ??
      null;
  }

  const activeWatchlistItem = watchlist.find((item) => item.symbol === activeSymbol) ?? null;
  const activeCompareState = activeSymbol ? compareSymbols.includes(activeSymbol) : false;

  useEffect(() => {
    recommendationQuoteSnapshotsRef.current = recommendationQuoteSnapshots;
  }, [recommendationQuoteSnapshots]);

  useEffect(() => {
    setActiveSymbol(urlActiveSymbol);
  }, [urlActiveSymbol]);

  useEffect(() => {
    setCompareSymbols(parseCompareSymbols(rawCompareParam));
  }, [rawCompareParam]);

  useEffect(() => {
    const localWatchlist = loadWatchlist();
    const localRecentViews = loadRecentViews();
    const clientId = getOrCreateClientId();

    setWatchlist(localWatchlist);
    setRecentViews(localRecentViews);
    setResearchClientId(clientId);
    setIsResearchTrackerReady(true);

    if (!clientId) {
      return;
    }

    void Promise.allSettled([getWatchlist(clientId), getRecentViews(clientId)]).then(([watchlistResult, recentResult]) => {
      if (watchlistResult.status === "fulfilled") {
        setWatchlist((current) => mergeWatchlists(current, watchlistResult.value.items));
      }
      if (recentResult.status === "fulfilled") {
        setRecentViews((current) => mergeRecentViews(current, recentResult.value.items));
      }
    });
  }, []);

  useEffect(() => {
    if (!isResearchTrackerReady) {
      return;
    }
    saveWatchlist(watchlist);
  }, [isResearchTrackerReady, watchlist]);

  useEffect(() => {
    if (!isResearchTrackerReady) {
      return;
    }
    saveRecentViews(recentViews);
  }, [isResearchTrackerReady, recentViews]);

  useEffect(() => {
    if (!activeSymbol || !isPanelOpen || !isResearchTrackerReady) {
      return;
    }

    setRecentViews((current) =>
      upsertRecentViewedItem(current, {
        symbol: activeSymbol,
        company_name: activeCompanyName ?? activeSymbol,
      })
    );

    if (researchClientId) {
      void saveRecentView({
        clientId: researchClientId,
        symbol: activeSymbol,
        companyName: activeCompanyName ?? activeSymbol,
      }).catch(() => {
        // Keep local history even if cloud sync is temporarily unavailable.
      });
    }
  }, [activeCompanyName, activeSymbol, isPanelOpen, isResearchTrackerReady, researchClientId]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const symbols = buildQuoteHydrationSymbols(
      data,
      selectedRecommendationCategory,
      selectedRecommendationStyle,
      activeSymbol,
      watchlist,
      recentViews
    );

    if (symbols.length === 0) {
      return;
    }

    let cancelled = false;
    const pendingSymbols = symbols.filter(
      (symbol) => recommendationQuoteSnapshotsRef.current[symbol]?.status !== "success"
    );

    if (pendingSymbols.length === 0) {
      return;
    }

    setRecommendationQuoteSnapshots((current) => {
      const next: RecommendationQuoteMap = { ...current };
      for (const symbol of pendingSymbols) {
        next[symbol] = current[symbol]?.status === "success" ? current[symbol] : createSection("loading");
      }
      return next;
    });

    const hydrateQuotes = async () => {
      await hydrateQuotesWithConcurrency(pendingSymbols, RECOMMENDATION_QUOTE_CONCURRENCY, async (symbol) => {
        try {
          const quote = await getQuote(symbol);
          if (!cancelled) {
            setRecommendationQuoteSnapshots((current) => ({
              ...current,
              [symbol]: { status: "success", data: quote, error: null },
            }));
          }
        } catch (error) {
          if (!cancelled) {
            setRecommendationQuoteSnapshots((current) => ({
              ...current,
              [symbol]: { status: "error", data: null, error: toErrorMessage(error) },
            }));
          }
        }
      });
    };

    void hydrateQuotes();

    return () => {
      cancelled = true;
    };
  }, [activeSymbol, data, recentViews, selectedRecommendationCategory, selectedRecommendationStyle, watchlist]);

  useEffect(() => {
    if (compareSymbols.length < 2) {
      setCompareSection(createSection());
      return;
    }

    let cancelled = false;
    setCompareSection(createSection("loading"));

    void getCompare(compareSymbols)
      .then((response) => {
        if (!cancelled) {
          setCompareSection({ status: "success", data: response, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCompareSection({ status: "error", data: null, error: toErrorMessage(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compareSymbols]);

  const syncRouteParams = (nextSymbol: string, nextCompareSymbols: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSymbol) {
      params.set("symbol", nextSymbol);
    } else {
      params.delete("symbol");
    }

    if (nextCompareSymbols.length > 0) {
      params.set("compare", nextCompareSymbols.join(","));
    } else {
      params.delete("compare");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const updateDrawerSymbol = (symbol: string | null) => {
    const nextSymbol = symbol ? normalizeSymbol(symbol) : "";
    setActiveSymbol(nextSymbol);
    syncRouteParams(nextSymbol, compareSymbols);
  };

  const updateCompareSymbols = (symbols: string[]) => {
    const normalized = Array.from(new Set(symbols.map((item) => normalizeSymbol(item)).filter(Boolean))).slice(
      0,
      MAX_COMPARE_SYMBOLS
    );
    setCompareSymbols(normalized);
    syncRouteParams(activeSymbol, normalized);
  };

  const toggleCompareSymbol = (symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
      return;
    }

    if (compareSymbols.includes(normalized)) {
      updateCompareSymbols(compareSymbols.filter((item) => item !== normalized));
      return;
    }

    updateCompareSymbols([...compareSymbols, normalized].slice(-MAX_COMPARE_SYMBOLS));
  };

  const clearCompareSymbols = () => {
    updateCompareSymbols([]);
  };

  const refreshCompare = async () => {
    if (compareSymbols.length < 2) {
      return;
    }

    setIsCompareRefreshing(true);
    try {
      const response = await getCompare(compareSymbols, { fresh: true });
      setCompareSection({ status: "success", data: response, error: null });
    } catch (error) {
      setCompareSection({ status: "error", data: null, error: toErrorMessage(error) });
    } finally {
      setIsCompareRefreshing(false);
    }
  };

  const refreshRecommendations = async () => {
    setRecommendationRefreshError(null);
    setIsRecommendationRefreshing(true);

    try {
      const recommendations = await getRecommendations();
      setRecommendationSection({ status: "success", data: recommendations, error: null });
      setSelectedRecommendationCategory((current) => {
        if (current !== "全部" && !recommendations.categories.includes(current)) {
          return "全部";
        }
        return current;
      });
      setSelectedRecommendationStyle((current) => {
        if (current !== "全部" && !recommendations.style_filters.includes(current)) {
          return "全部";
        }
        return current;
      });
    } catch (error) {
      setRecommendationRefreshError(toErrorMessage(error));
    } finally {
      setIsRecommendationRefreshing(false);
    }
  };

  const toggleWatchlist = (input: {
    symbol: string;
    company_name?: string | null;
    market?: string | null;
    region?: string | null;
    tags?: string[] | null;
  }) => {
    setWatchlist((current) => {
      const normalizedSymbol = normalizeSymbol(input.symbol);
      const existing = current.find((item) => item.symbol === normalizedSymbol);

      if (existing) {
        if (researchClientId) {
          void deleteWatchlistItem(researchClientId, normalizedSymbol).catch(() => {
            // Keep local state if cloud sync fails.
          });
        }
        return removeWatchlistItemLocal(current, normalizedSymbol);
      }

      const next = upsertWatchlistItem(current, input);
      if (researchClientId) {
        void saveWatchlistItem({
          clientId: researchClientId,
          symbol: normalizedSymbol,
          companyName: input.company_name ?? normalizedSymbol,
          market: input.market ?? undefined,
          region: input.region ?? undefined,
          tags: input.tags ?? [],
          status: "待研究",
        }).catch(() => {
          // Keep local state if cloud sync fails.
        });
      }
      return next;
    });
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist((current) => removeWatchlistItemLocal(current, symbol));
    if (researchClientId) {
      void deleteWatchlistItem(researchClientId, symbol).catch(() => {
        // Keep local state if cloud sync fails.
      });
    }
  };

  const updateWatchlistStatus = (symbol: string, status: ResearchStatus) => {
    setWatchlist((current) => {
      const next = setWatchlistStatus(current, symbol, status);
      const updatedItem = next.find((item) => item.symbol === normalizeSymbol(symbol));
      if (researchClientId && updatedItem) {
        void saveWatchlistItem({
          clientId: researchClientId,
          symbol: updatedItem.symbol,
          companyName: updatedItem.company_name,
          market: updatedItem.market ?? undefined,
          region: updatedItem.region ?? undefined,
          tags: updatedItem.tags,
          status: updatedItem.status,
        }).catch(() => {
          // Keep local state if cloud sync fails.
        });
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-warning-border bg-warning-bg/70 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-warning-border bg-warning-bg text-warning">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">风险提示</p>
            <p className="mt-1 text-sm leading-6 text-terminal-text-secondary">
              本分析系统基于 AI 大模型结果与公开市场数据自动生成，仅供参考，不构成任何投资建议。请结合公司公告、财务信息与自身风险承受能力独立判断。
            </p>
          </div>
        </div>
      </div>

      <div
        className={`grid items-start gap-5 transition-[grid-template-columns] duration-300 ease-out ${
          isPanelOpen
            ? "xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,1fr)] xl:h-[calc(100vh-5rem)] xl:overflow-hidden"
            : "xl:grid-cols-1"
        }`}
      >
        <div
          className={`space-y-4 transition-[max-width] duration-300 xl:h-full xl:overflow-y-auto xl:pr-2 ${
            isPanelOpen ? "" : "mx-auto w-full max-w-6xl"
          }`}
        >
          <ResearchWorkspace
            watchlist={watchlist}
            recentViews={recentViews}
            quoteSnapshots={recommendationQuoteSnapshots}
            activeSymbol={activeSymbol}
            onOpenSymbol={updateDrawerSymbol}
            onToggleWatchlist={toggleWatchlist}
            onRemoveWatchlist={removeFromWatchlist}
            onStatusChange={updateWatchlistStatus}
          />

          <CompareWorkspace
            section={compareSection}
            selectedSymbols={compareSymbols}
            onOpenSymbol={updateDrawerSymbol}
            onRemoveSymbol={toggleCompareSymbol}
            onClear={clearCompareSymbols}
            onRefresh={refreshCompare}
            isRefreshing={isCompareRefreshing}
          />

          <RecommendationsWorkspace
            section={recommendationSection}
            quoteSnapshots={recommendationQuoteSnapshots}
            activeSymbol={activeSymbol}
            selectedCategory={selectedRecommendationCategory}
            selectedStyle={selectedRecommendationStyle}
            isRefreshing={isRecommendationRefreshing}
            refreshError={recommendationRefreshError}
            watchlistSymbols={watchlist.map((item) => item.symbol)}
            compareSymbols={compareSymbols}
            onToggleWatchlist={toggleWatchlist}
            onToggleCompare={toggleCompareSymbol}
            onCategoryChange={setSelectedRecommendationCategory}
            onStyleChange={setSelectedRecommendationStyle}
            onOpenSymbol={updateDrawerSymbol}
            onRefresh={refreshRecommendations}
          />
        </div>

        <AnalysisDrawer
          symbol={activeSymbol || null}
          companyName={activeCompanyName}
          isWatchlisted={Boolean(activeWatchlistItem)}
          onToggleWatchlist={
            activeSymbol
              ? () =>
                  toggleWatchlist({
                    symbol: activeSymbol,
                    company_name: activeCompanyName ?? activeSymbol,
                  })
              : undefined
          }
          isCompared={activeCompareState}
          onToggleCompare={activeSymbol ? () => toggleCompareSymbol(activeSymbol) : undefined}
          open={isPanelOpen}
          onClose={() => updateDrawerSymbol(null)}
        />
      </div>
    </div>
  );
}
