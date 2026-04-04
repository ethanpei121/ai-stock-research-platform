"use client";

import { CheckCircle2, LineChart, Loader2, Newspaper, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { NewsList } from "@/components/NewsList";
import { QuoteCard } from "@/components/QuoteCard";
import { SummaryCard } from "@/components/SummaryCard";
import { getNews, getQuote, getSummary } from "@/lib/api";
import type { AsyncSection, NewsResponse, Quote, SummaryResponse } from "@/lib/types";

type AnalysisDrawerProps = {
  symbol: string | null;
  companyName?: string | null;
  open: boolean;
  onClose: () => void;
};

type StepState = "loading" | "done" | "error" | "pending";

type StepDefinition = {
  id: string;
  label: string;
  icon: React.ReactNode;
  state: StepState;
};

const createSection = <T,>(status: AsyncSection<T>["status"] = "idle"): AsyncSection<T> => ({
  status,
  data: null,
  error: null,
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function getStepState<T>(section: AsyncSection<T>): StepState {
  if (section.status === "success") return "done";
  if (section.status === "error") return "error";
  if (section.status === "loading") return "loading";
  return "pending";
}

function getLatestNewsTimestamp(news: NewsResponse): string | null {
  if (!news.items.length) return null;
  let latest = new Date(0);
  for (const item of news.items) {
    const parsed = new Date(item.published_at);
    if (!Number.isNaN(parsed.getTime()) && parsed > latest) {
      latest = parsed;
    }
  }
  if (latest.getTime() === 0) return null;
  return latest.toISOString();
}

function buildLocalSummary(symbol: string, quote: Quote, news: NewsResponse): SummaryResponse {
  const bullish: string[] = [];
  const bearish: string[] = [];

  if (quote.change_percent >= 0) {
    bullish.push(`最新报价 ${quote.price.toFixed(2)} ${quote.currency}，日内上涨 ${Math.abs(quote.change_percent).toFixed(2)}%。`);
  } else {
    bearish.push(`最新报价 ${quote.price.toFixed(2)} ${quote.currency}，日内下跌 ${Math.abs(quote.change_percent).toFixed(2)}%。`);
  }

  bullish.push(`已聚合 ${news.count} 条相关新闻。`);
  bearish.push("当前为快速回退版本，AI 总结正在后台重试。");

  return {
    symbol,
    generated_at: new Date().toISOString(),
    summary: { bullish, bearish, conclusion: "快速回退摘要，AI 总结完成后会自动更新。" },
    data_points: { price: quote.price, change_percent: quote.change_percent, news_count: news.count },
    meta: {
      provider: "template",
      model: null,
      is_fallback: true,
      force_refresh_used: true,
      quote_provider: quote.provider,
      quote_market_time: quote.market_time,
      latest_news_time: getLatestNewsTimestamp(news),
      news_providers: news.providers,
    },
  };
}

function buildSummaryPrerequisiteError(quoteError: string | null, newsError: string | null): string {
  if (quoteError && newsError) return `行情和资讯均获取失败。`;
  if (quoteError) return `行情获取失败：${quoteError}`;
  if (newsError) return `资讯获取失败：${newsError}`;
  return "前置数据未准备完成。";
}


function AnalysisSteps({
  quoteSection,
  newsSection,
  summarySection,
}: {
  quoteSection: AsyncSection<Quote>;
  newsSection: AsyncSection<NewsResponse>;
  summarySection: AsyncSection<SummaryResponse>;
}) {
  const steps: StepDefinition[] = useMemo(
    () => [
      { id: "quote", label: "获取行情", icon: <LineChart className="h-3.5 w-3.5" />, state: getStepState(quoteSection) },
      { id: "news", label: "拉取资讯", icon: <Newspaper className="h-3.5 w-3.5" />, state: getStepState(newsSection) },
      { id: "summary", label: "AI 简报", icon: <Sparkles className="h-3.5 w-3.5" />, state: getStepState(summarySection) },
    ],
    [newsSection, quoteSection, summarySection]
  );

  return (
    <div className="flex items-center gap-2 rounded-xl border border-terminal-border bg-terminal-card/50 px-3 py-2">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1.5">
          {i > 0 && <div className="h-px w-3 bg-terminal-border" />}
          <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
            step.state === "done"
              ? "text-gain"
              : step.state === "loading"
                ? "text-accent-light"
                : step.state === "error"
                  ? "text-loss"
                  : "text-terminal-dim"
          }`}>
            {step.state === "done" ? <CheckCircle2 className="h-3 w-3" /> : null}
            {step.state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {step.state === "pending" ? step.icon : null}
            {step.state === "error" ? step.icon : null}
            <span>{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}


export function AnalysisDrawer({ symbol, companyName, open, onClose }: AnalysisDrawerProps) {
  const [quoteSection, setQuoteSection] = useState<AsyncSection<Quote>>(createSection());
  const [newsSection, setNewsSection] = useState<AsyncSection<NewsResponse>>(createSection());
  const [summarySection, setSummarySection] = useState<AsyncSection<SummaryResponse>>(createSection());

  useEffect(() => {
    if (!open || !symbol) return;

    let cancelled = false;
    let retried = false;
    const normalized = symbol.trim().toUpperCase();

    const run = async () => {
      setQuoteSection(createSection("loading"));
      setNewsSection(createSection("loading"));
      setSummarySection(createSection("loading"));

      const [quoteResult, newsResult] = await Promise.allSettled([
        getQuote(normalized, { fresh: true }),
        getNews(normalized, 6, { fresh: true }),
      ]);

      if (cancelled) return;

      let resolvedQuote: Quote | null = null;
      let resolvedNews: NewsResponse | null = null;
      let quoteError: string | null = null;
      let newsError: string | null = null;

      if (quoteResult.status === "fulfilled") {
        resolvedQuote = quoteResult.value;
        setQuoteSection({ status: "success", data: resolvedQuote, error: null });
      } else {
        quoteError = toErrorMessage(quoteResult.reason);
        setQuoteSection({ status: "error", data: null, error: quoteError });
      }

      if (newsResult.status === "fulfilled") {
        resolvedNews = newsResult.value;
        setNewsSection({ status: "success", data: resolvedNews, error: null });
      } else {
        newsError = toErrorMessage(newsResult.reason);
        setNewsSection({ status: "error", data: null, error: newsError });
      }

      if (!resolvedQuote || !resolvedNews) {
        setSummarySection({
          status: "error",
          data: null,
          error: buildSummaryPrerequisiteError(quoteError, newsError),
        });
        return;
      }

      const fallbackSummary = () => {
        const summary = buildLocalSummary(normalized, resolvedQuote!, resolvedNews!);
        setSummarySection({ status: "success", data: summary, error: null });
      };

      const attemptAi = async () => {
        try {
          const summary = await getSummary(normalized, {
            fresh: true,
            quote: resolvedQuote,
            news: resolvedNews,
            includeSupplemental: false,
          });
          if (!cancelled) {
            setSummarySection({ status: "success", data: summary, error: null });
          }
        } catch {
          if (cancelled) return;
          if (!retried) {
            retried = true;
            fallbackSummary();
            setTimeout(() => {
              if (!cancelled) void attemptAi();
            }, 2000);
            return;
          }
          fallbackSummary();
        }
      };

      void attemptAi();
    };

    void run();
    return () => { cancelled = true; };
  }, [open, symbol]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !symbol) return null;

  const isLoading =
    quoteSection.status === "loading" ||
    newsSection.status === "loading" ||
    summarySection.status === "loading";

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-terminal-border bg-terminal-bg/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-terminal-border px-5 py-4">
        <div className="min-w-0">
          <p className="terminal-section-title">个股分析</p>
          <div className="mt-2 flex items-baseline gap-3">
            <h2 className="font-mono text-2xl font-bold tracking-tight text-terminal-text">{symbol}</h2>
            <p className="truncate text-sm text-terminal-muted">{companyName ?? ""}</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-terminal-border text-terminal-muted transition hover:border-terminal-border-hover hover:text-terminal-text"
          onClick={onClose}
          aria-label="关闭分析面板"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <AnalysisSteps
            quoteSection={quoteSection}
            newsSection={newsSection}
            summarySection={summarySection}
          />
        ) : null}
        <QuoteCard symbol={symbol} section={quoteSection} />
        <SummaryCard section={summarySection} />
        <NewsList section={newsSection} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden xl:block xl:sticky xl:top-[4.5rem] xl:h-[calc(100vh-5rem)] xl:self-start animate-slide-in-right">
        {panelContent}
      </aside>
      <aside className="fixed inset-x-3 bottom-3 top-16 z-30 xl:hidden animate-fade-in">
        {panelContent}
      </aside>
    </>
  );
}
