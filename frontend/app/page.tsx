"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { InputPanel } from "@/components/InputPanel";
import { NewsList } from "@/components/NewsList";
import { QuoteCard } from "@/components/QuoteCard";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { SummaryCard } from "@/components/SummaryCard";
import { API_TARGET, getNews, getQuote, getRecommendations, getSummary } from "@/lib/api";
import { DEFAULT_RECOMMENDATIONS } from "@/lib/default-recommendations";
import type {
  AsyncSection,
  NewsResponse,
  Quote,
  RecommendationsResponse,
  SummaryResponse,
} from "@/lib/types";


const DEFAULT_SYMBOL = "AAPL";

const createSection = <T,>(status: AsyncSection<T>["status"] = "idle"): AsyncSection<T> => ({
  status,
  data: null,
  error: null,
});


function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}


function getSummarySourceLabel(section: AsyncSection<SummaryResponse>): string | null {
  if (section.status === "loading") {
    return "研究引擎正在更新中";
  }

  if (section.status !== "success" || !section.data) {
    return null;
  }

  const meta = section.data.meta;
  if (!meta || meta.is_fallback) {
    return "当前使用模板回退";
  }

  const provider = meta.provider === "dashscope" ? "阿里云千问" : meta.provider === "openai" ? "OpenAI" : meta.provider;
  const model = meta.model ? ` · ${meta.model}` : "";
  return `${provider}${model}`;
}


export default function HomePage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOL);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRecommendationCategory, setSelectedRecommendationCategory] = useState("全部");
  const [selectedRecommendationStyle, setSelectedRecommendationStyle] = useState("全部");
  const [quoteSection, setQuoteSection] = useState<AsyncSection<Quote>>(createSection("loading"));
  const [newsSection, setNewsSection] = useState<AsyncSection<NewsResponse>>(createSection("loading"));
  const [summarySection, setSummarySection] = useState<AsyncSection<SummaryResponse>>(createSection("loading"));
  const [recommendationSection, setRecommendationSection] = useState<AsyncSection<RecommendationsResponse>>({
    status: "success",
    data: DEFAULT_RECOMMENDATIONS,
    error: null,
  });
  const [isRecommendationRefreshing, setIsRecommendationRefreshing] = useState(false);
  const [recommendationRefreshError, setRecommendationRefreshError] = useState<string | null>(null);
  const hasBootstrapped = useRef(false);

  const isSubmitting =
    quoteSection.status === "loading" ||
    newsSection.status === "loading" ||
    summarySection.status === "loading";

  const summarySourceLabel = getSummarySourceLabel(summarySection);

  const runAnalysis = useCallback(async (nextSymbol: string) => {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) {
      setFormError("请输入有效的股票代码，例如 AAPL。");
      setQuoteSection(createSection());
      setNewsSection(createSection());
      setSummarySection(createSection());
      return;
    }

    setFormError(null);
    setSymbol(normalized);
    setActiveSymbol(normalized);
    setQuoteSection(createSection("loading"));
    setNewsSection(createSection("loading"));
    setSummarySection(createSection("loading"));

    const [quoteResult, newsResult] = await Promise.allSettled([
      getQuote(normalized),
      getNews(normalized, 5),
    ]);

    if (quoteResult.status === "fulfilled") {
      setQuoteSection({ status: "success", data: quoteResult.value, error: null });
    } else {
      setQuoteSection({ status: "error", data: null, error: toErrorMessage(quoteResult.reason) });
    }

    if (newsResult.status === "fulfilled") {
      setNewsSection({ status: "success", data: newsResult.value, error: null });
    } else {
      setNewsSection({ status: "error", data: null, error: toErrorMessage(newsResult.reason) });
    }

    try {
      const summary = await getSummary(normalized);
      setSummarySection({ status: "success", data: summary, error: null });
    } catch (error) {
      setSummarySection({ status: "error", data: null, error: toErrorMessage(error) });
    }
  }, []);

  const refreshRecommendations = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (hasBootstrapped.current) {
      return;
    }
    hasBootstrapped.current = true;
    void runAnalysis(DEFAULT_SYMBOL);
  }, [runAnalysis]);

  const handleAnalyze = async () => {
    await runAnalysis(symbol);
  };

  const handleRecommendationAnalyze = (recommendedSymbol: string) => {
    void runAnalysis(recommendedSymbol);
  };

  return (
    <main className="app-shell">
      <div className="page-grain" />
      <div className="page-halo page-halo--amber" />
      <div className="page-halo page-halo--teal" />

      <section className="stage">
        <InputPanel
          symbol={symbol}
          activeSymbol={activeSymbol}
          apiBase={`Vercel Proxy -> ${API_TARGET}`}
          isSubmitting={isSubmitting}
          error={formError}
          summarySourceLabel={summarySourceLabel}
          onSymbolChange={setSymbol}
          onSubmit={handleAnalyze}
        />

        <section className="result-mosaic">
          <QuoteCard symbol={activeSymbol} section={quoteSection} />
          <SummaryCard section={summarySection} />
          <NewsList section={newsSection} />
        </section>

        <RecommendationsPanel
          section={recommendationSection}
          selectedCategory={selectedRecommendationCategory}
          selectedStyle={selectedRecommendationStyle}
          isRefreshing={isRecommendationRefreshing}
          refreshError={recommendationRefreshError}
          onCategoryChange={setSelectedRecommendationCategory}
          onStyleChange={setSelectedRecommendationStyle}
          onAnalyzeSymbol={handleRecommendationAnalyze}
          onRefresh={refreshRecommendations}
        />
      </section>
    </main>
  );
}
