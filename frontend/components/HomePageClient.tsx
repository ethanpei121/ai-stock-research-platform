"use client";

import { useEffect, useState } from "react";
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
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
    if (!data) {
      return;
    }

    const symbols = Array.from(
      new Set(data.groups.flatMap((group) => group.stocks.map((stock) => stock.symbol.toUpperCase())))
    );

    if (symbols.length === 0) {
      setRecommendationQuoteSnapshots({});
      return;
    }

    let cancelled = false;

    setRecommendationQuoteSnapshots((current) => {
      const next: RecommendationQuoteMap = {};
      for (const symbol of symbols) {
        next[symbol] = current[symbol]?.status === "success" ? current[symbol] : createSection("loading");
      }
      return next;
    });

    const hydrateQuotes = async () => {
      // Fire all requests concurrently for faster loading
      const promises = symbols.map(async (symbol) => {
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

      await Promise.allSettled(promises);
    };

    void hydrateQuotes();

    return () => {
      cancelled = true;
    };
  }, [data]);

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
  );
}
