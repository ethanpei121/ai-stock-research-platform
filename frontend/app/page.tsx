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
      <div className="aurora aurora--left" />
      <div className="aurora aurora--right" />

      <section className="dashboard">
        <InputPanel
          symbol={symbol}
          apiBase={API_BASE}
          isSubmitting={isSubmitting}
          error={formError}
          onSymbolChange={setSymbol}
          onSubmit={handleAnalyze}
        />

        <section className="results-grid">
          <QuoteCard symbol={activeSymbol} section={quoteSection} />
          <NewsList section={newsSection} />
          <SummaryCard section={summarySection} />
        </section>
      </section>
    </main>
  );
}
