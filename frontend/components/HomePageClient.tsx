"use client";

import { Activity, Database, PanelRightOpen, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
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

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
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
      for (const symbol of symbols) {
        if (cancelled) {
          return;
        }

        try {
          const quote = await getQuote(symbol);
          if (cancelled) {
            return;
          }
          setRecommendationQuoteSnapshots((current) => ({
            ...current,
            [symbol]: { status: "success", data: quote, error: null },
          }));
        } catch (error) {
          if (cancelled) {
            return;
          }
          setRecommendationQuoteSnapshots((current) => ({
            ...current,
            [symbol]: { status: "error", data: null, error: toErrorMessage(error) },
          }));
        }
      }
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
    <main className="space-y-3">
      <div
        className={`grid items-start gap-5 transition-[grid-template-columns] duration-300 ease-out xl:h-[calc(100vh-7.5rem)] xl:overflow-hidden ${
          isPanelOpen ? "xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]" : "xl:grid-cols-1"
        }`}
      >
        <div
          className={`space-y-4 transition-[max-width] duration-300 xl:h-full xl:overflow-y-auto xl:pr-2 ${
            isPanelOpen ? "" : "mx-auto w-full max-w-6xl"
          }`}
        >
          <section className={`grid gap-3 ${isPanelOpen ? "2xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]" : "xl:grid-cols-[minmax(0,1.6fr)_320px]"}`}>
            <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600">Market Overview</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                推荐池为主视图，右侧面板为个股深度分析。
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                左侧用于发现和筛选，右侧用于总结与判断。分析过程中左侧仍保持可浏览与可点击。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                  默认首页: 推荐观察池
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-900/5">
                  代理链路: Vercel /api/v1 -&gt; {API_TARGET}
                </span>
                {isPanelOpen ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    当前查看 {activeSymbol}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <InfoCard
                icon={<PanelRightOpen className="h-4 w-4" />}
                title="主从分屏"
                description="选中股票后自动分屏，右侧加载不阻塞左侧浏览。"
              />
              <InfoCard
                icon={<Activity className="h-4 w-4" />}
                title="非阻塞加载"
                description="行情、新闻、摘要分步填充，页面始终可操作。"
              />
              <InfoCard
                icon={<Database className="h-4 w-4" />}
                title="Proxy & Update"
                description={`观察池时间 ${formatDateTime(DEFAULT_RECOMMENDATIONS.updated_at)}，点击按钮可切到实时推荐。`}
              />
              <InfoCard
                icon={<TrendingUp className="h-4 w-4" />}
                title="金融终端风格"
                description="保持轻量网格与精简信息层级，避免大段空白。"
              />
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
        </div>

        <AnalysisDrawer
          symbol={activeSymbol || null}
          companyName={activeCompanyName}
          open={isPanelOpen}
          onClose={() => updateDrawerSymbol(null)}
        />
      </div>
    </main>
  );
}
