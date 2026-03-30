"use client";

import { useEffect, useRef, useState } from "react";

import { InputPanel } from "@/components/InputPanel";
import { NewsList } from "@/components/NewsList";
import { QuoteCard } from "@/components/QuoteCard";
import { SummaryCard } from "@/components/SummaryCard";
import { API_BASE, getNews, getQuote, getSummary } from "@/lib/api";
import type { AsyncSection, NewsResponse, Quote, SummaryResponse } from "@/lib/types";


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
  const [quoteSection, setQuoteSection] = useState<AsyncSection<Quote>>(createSection("loading"));
  const [newsSection, setNewsSection] = useState<AsyncSection<NewsResponse>>(createSection("loading"));
  const [summarySection, setSummarySection] = useState<AsyncSection<SummaryResponse>>(createSection("loading"));
  const hasAutoAnalyzed = useRef(false);

  const isSubmitting =
    quoteSection.status === "loading" ||
    newsSection.status === "loading" ||
    summarySection.status === "loading";

  const summarySourceLabel = getSummarySourceLabel(summarySection);

  const runAnalysis = async (nextSymbol: string) => {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) {
      setFormError("请输入有效的股票代码，例如 AAPL。");
      setQuoteSection(createSection());
      setNewsSection(createSection());
      setSummarySection(createSection());
      return;
    }

    setFormError(null);
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
  };

  useEffect(() => {
    if (hasAutoAnalyzed.current) {
      return;
    }
    hasAutoAnalyzed.current = true;
    void runAnalysis(DEFAULT_SYMBOL);
  }, []);

  const handleAnalyze = async () => {
    await runAnalysis(symbol);
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
          apiBase={API_BASE}
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
      </section>
    </main>
  );
}
