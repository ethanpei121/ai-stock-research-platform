"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

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


const createSection = <T,>(status: AsyncSection<T>["status"] = "idle"): AsyncSection<T> => ({
  status,
  data: null,
  error: null,
});


function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
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

      const [quoteResult, newsResult] = await Promise.allSettled([getQuote(normalized), getNews(normalized, 6)]);

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
        const summary = await getSummary(normalized);
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

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-slate-900/20 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <aside
        className={`absolute right-0 top-0 h-full w-full border-l border-slate-200 bg-white shadow-xl transition-transform duration-300 md:w-[48vw] md:min-w-[620px] md:max-w-[760px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Equity Analysis</p>
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
                  <h2 className="font-mono text-3xl font-semibold tracking-tight text-slate-900">{symbol ?? "--"}</h2>
                  <p className="truncate text-sm text-slate-500">{companyName ?? "Company name unavailable"}</p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={onClose}
                aria-label="Close analysis drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <QuoteCard symbol={symbol ?? ""} section={quoteSection} />
            <SummaryCard section={summarySection} />
            <NewsList section={newsSection} />
          </div>
        </div>
      </aside>
    </div>
  );
}
