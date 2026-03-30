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
  detail: string;
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
  if (section.status === "success") {
    return "done";
  }
  if (section.status === "error") {
    return "error";
  }
  if (section.status === "loading") {
    return "loading";
  }
  return "pending";
}

function AnalysisLoadingState({
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
      {
        id: "quote",
        label: "正在获取最新可用行情...",
        detail: "直连刷新最新价格、涨跌幅与市场时间。",
        icon: <LineChart className="h-4 w-4" />,
        state: getStepState(quoteSection),
      },
      {
        id: "news",
        label: "正在拉取最新资讯...",
        detail: "重新抓取新闻聚合源，避免沿用旧缓存。",
        icon: <Newspaper className="h-4 w-4" />,
        state: getStepState(newsSection),
      },
      {
        id: "summary",
        label: "AI 正在撰写投研简报...",
        detail: "基于本轮最新可获取行情与资讯生成摘要。",
        icon: <Sparkles className="h-4 w-4" />,
        state: getStepState(summarySection),
      },
    ],
    [newsSection, quoteSection, summarySection]
  );

  const activeStep =
    steps.find((step) => step.state === "loading") ??
    steps.find((step) => step.state === "error") ??
    steps[steps.length - 1];

  return (
    <section className="rounded-2xl bg-slate-900 px-5 py-5 text-white shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-indigo-200">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold">{activeStep.label}</p>
          <p className="mt-1 text-sm text-slate-300">{activeStep.detail}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {steps.map((step) => {
          const stateStyles =
            step.state === "done"
              ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20"
              : step.state === "error"
                ? "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/20"
                : step.state === "loading"
                  ? "bg-indigo-500/15 text-white ring-1 ring-indigo-300/20"
                  : "bg-white/5 text-slate-300 ring-1 ring-white/10";

          return (
            <div key={step.id} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${stateStyles}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">{step.icon}</span>
                <div>
                  <p className="text-sm font-medium">{step.label.replace(/\.\.\.$/, "")}</p>
                  <p className="mt-0.5 text-xs text-inherit/80">{step.detail}</p>
                </div>
              </div>
              {step.state === "done" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
              {step.state === "loading" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              {step.state === "error" ? <span className="text-xs font-semibold uppercase tracking-[0.18em]">Retry</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AnalysisDrawer({ symbol, companyName, open, onClose }: AnalysisDrawerProps) {
  const [quoteSection, setQuoteSection] = useState<AsyncSection<Quote>>(createSection());
  const [newsSection, setNewsSection] = useState<AsyncSection<NewsResponse>>(createSection());
  const [summarySection, setSummarySection] = useState<AsyncSection<SummaryResponse>>(createSection());

  useEffect(() => {
    if (!open || !symbol) {
      return;
    }

    let cancelled = false;
    const normalized = symbol.trim().toUpperCase();

    const run = async () => {
      setQuoteSection(createSection("loading"));
      setNewsSection(createSection("loading"));
      setSummarySection(createSection("loading"));

      const [quoteResult, newsResult] = await Promise.allSettled([
        getQuote(normalized, { fresh: true }),
        getNews(normalized, 6, { fresh: true }),
      ]);

      if (cancelled) {
        return;
      }

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
        const summary = await getSummary(normalized, { fresh: true });
        if (!cancelled) {
          setSummarySection({ status: "success", data: summary, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setSummarySection({ status: "error", data: null, error: toErrorMessage(error) });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, symbol]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !symbol) {
    return null;
  }

  const isLoading =
    quoteSection.status === "loading" ||
    newsSection.status === "loading" ||
    summarySection.status === "loading";

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="relative px-5 py-5 sm:px-6 sm:py-6 after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-gradient-to-r after:from-indigo-500/50 after:via-slate-200 after:to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600">Equity Analysis</p>
            <div className="mt-3 flex flex-col gap-1">
              <h2 className="font-mono text-4xl font-semibold tracking-tight text-slate-900">{symbol}</h2>
              <p className="truncate text-sm text-slate-500">{companyName ?? "Company name unavailable"}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-900/5 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Close analysis drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {isLoading ? (
          <AnalysisLoadingState
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
      <aside className="hidden xl:block xl:sticky xl:top-[6.5rem] xl:h-[calc(100vh-7.5rem)] xl:self-start">{panelContent}</aside>
      <aside className="fixed inset-x-3 bottom-3 top-24 z-30 xl:hidden">{panelContent}</aside>
    </>
  );
}
