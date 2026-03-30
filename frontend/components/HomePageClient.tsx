"use client";

import { Activity, Database, PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AnalysisDrawer } from "@/components/AnalysisDrawer";
import { RecommendationsWorkspace } from "@/components/RecommendationsWorkspace";
import { API_TARGET, getQuote, getRecommendations } from "@/lib/api";
import { DEFAULT_RECOMMENDATIONS } from "@/lib/default-recommendations";
import { formatDateTime } from "@/lib/formatters";
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
  const isDrawerOpen = activeSymbol.length > 0;

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

    void Promise.all(
      symbols.map(async (symbol) => {
        try {
          const quote = await getQuote(symbol);
          return { symbol, status: "success" as const, quote };
        } catch (error) {
          return { symbol, status: "error" as const, error: toErrorMessage(error) };
        }
      })
    ).then((results) => {
      if (cancelled) {
        return;
      }

      setRecommendationQuoteSnapshots((current) => {
        const next = { ...current };

        for (const result of results) {
          if (result.status === "success") {
            next[result.symbol] = { status: "success", data: result.quote, error: null };
          } else {
            next[result.symbol] = { status: "error", data: null, error: result.error };
          }
        }

        return next;
      });
    });

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
    <>
      <main className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Market Overview</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">首页只保留发现与推荐，个股分析改为右侧按需展开。</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              现在的交互更接近企业级金融终端：首页用于浏览观察名单与市场快照，个股详情则通过右侧抽屉加载。这样能让推荐、搜索、分析三类动作分层清晰，也便于后续增加个股详情页和更多数据模块。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                <PanelRightOpen className="h-4 w-4 text-slate-500" />
                分析入口
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">点击列表中的股票，或在顶部输入代码回车，即可从右侧拉出个股分析抽屉。</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                <Activity className="h-4 w-4 text-slate-500" />
                数据说明
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                推荐池默认展示固定观察名单，但会回补行情快照；点击“刷新实时推荐”时，才会向后端请求真实数据重排。
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                <Database className="h-4 w-4 text-slate-500" />
                Proxy & Update
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-500">
                <p>
                  API Proxy: <span className="font-mono text-slate-900">Vercel /api/v1 -&gt; {API_TARGET}</span>
                </p>
                <p>
                  观察池时间戳: <span className="font-mono text-slate-900">{formatDateTime(DEFAULT_RECOMMENDATIONS.updated_at)}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

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
      </main>

      <AnalysisDrawer
        symbol={activeSymbol || null}
        companyName={activeCompanyName}
        open={isDrawerOpen}
        onClose={() => updateDrawerSymbol(null)}
      />
    </>
  );
}
