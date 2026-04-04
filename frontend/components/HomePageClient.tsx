"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AnalysisDrawer } from "@/components/AnalysisDrawer";
import { RecommendationsWorkspace } from "@/components/RecommendationsWorkspace";
import { getQuote, getRecommendations } from "@/lib/api";
import { DEFAULT_RECOMMENDATIONS } from "@/lib/default-recommendations";
import type { AsyncSection, Quote, RecommendationsResponse } from "@/lib/types";

const createSection = <T,>(status: AsyncSection<T>["status"] = "idle"): AsyncSection<T> => ({
  status,
  data: null,
  error: null,
});

type RecommendationQuoteMap = Record<string, AsyncSection<Quote>>;
const RECOMMENDATION_QUOTE_CONCURRENCY = 4;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function buildQuoteHydrationSymbols(
  data: RecommendationsResponse,
  selectedCategory: string,
  selectedStyle: string,
  activeSymbol: string
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

  const activeSymbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();
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

  useEffect(() => {
    recommendationQuoteSnapshotsRef.current = recommendationQuoteSnapshots;
  }, [recommendationQuoteSnapshots]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const symbols = buildQuoteHydrationSymbols(
      data,
      selectedRecommendationCategory,
      selectedRecommendationStyle,
      activeSymbol
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
  }, [activeSymbol, data, selectedRecommendationCategory, selectedRecommendationStyle]);

  const updateDrawerSymbol = (symbol: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (symbol) {
      params.set("symbol", symbol.trim().toUpperCase());
    } else {
      params.delete("symbol");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
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
        {/* Left: Recommendations */}
        <div
          className={`space-y-4 transition-[max-width] duration-300 xl:h-full xl:overflow-y-auto xl:pr-2 ${
            isPanelOpen ? "" : "mx-auto w-full max-w-6xl"
          }`}
        >
          <RecommendationsWorkspace
            section={recommendationSection}
            quoteSnapshots={recommendationQuoteSnapshots}
            activeSymbol={activeSymbol}
            selectedCategory={selectedRecommendationCategory}
            selectedStyle={selectedRecommendationStyle}
            isRefreshing={isRecommendationRefreshing}
            refreshError={recommendationRefreshError}
            onCategoryChange={setSelectedRecommendationCategory}
            onStyleChange={setSelectedRecommendationStyle}
            onOpenSymbol={updateDrawerSymbol}
            onRefresh={refreshRecommendations}
          />
        </div>

        {/* Right: Analysis drawer */}
        <AnalysisDrawer
          symbol={activeSymbol || null}
          companyName={activeCompanyName}
          open={isPanelOpen}
          onClose={() => updateDrawerSymbol(null)}
        />
      </div>
    </div>
  );
}
