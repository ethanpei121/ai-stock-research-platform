"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowLeftRight, Loader2, PlayCircle, Plus, RefreshCw, X } from "lucide-react";

import {
  formatCompactNumber,
  formatCurrency,
  formatDateTime,
  formatMetricNumber,
  formatMetricPercent,
  formatRelativeTime,
  formatSignedPercent,
} from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import type { AsyncSection, CompareResponse } from "@/lib/types";

type CompareWorkspaceProps = {
  section: AsyncSection<CompareResponse>;
  selectedSymbols: string[];
  onAddSymbol: (symbol: string) => string | null;
  onOpenSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  onClear: () => void;
  onRunAnalysis: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

type MetricItem = {
  label: string;
  value: string;
};

function buildMetrics(item: CompareResponse["items"][number]): MetricItem[] {
  return [
    { label: "日涨跌", value: formatSignedPercent(item.quote.change_percent) },
    { label: "总市值", value: formatCompactNumber(item.fundamentals?.market_cap ?? null) },
    { label: "流通市值", value: formatCompactNumber(item.fundamentals?.float_market_cap ?? null) },
    { label: "PE", value: formatMetricNumber(item.fundamentals?.pe_ratio ?? null, 2) },
    { label: "PB", value: formatMetricNumber(item.fundamentals?.pb_ratio ?? null, 2) },
    { label: "ROE", value: formatMetricPercent(item.fundamentals?.roe ?? null) },
    { label: "毛利率", value: formatMetricPercent(item.fundamentals?.gross_margin ?? null) },
    { label: "净利率", value: formatMetricPercent(item.fundamentals?.net_margin ?? null) },
    { label: "资产负债率", value: formatMetricPercent(item.fundamentals?.debt_to_asset ?? null) },
    { label: "营收增速", value: formatMetricPercent(item.fundamentals?.revenue_growth ?? null) },
    { label: "净利增速", value: formatMetricPercent(item.fundamentals?.net_profit_growth ?? null) },
    { label: "新闻条数", value: item.news_count > 0 ? `${item.news_count} 条` : "--" },
    { label: "公告条数", value: item.announcement_count > 0 ? `${item.announcement_count} 条` : "--" },
  ];
}

export function CompareWorkspace({
  section,
  selectedSymbols,
  onAddSymbol,
  onOpenSymbol,
  onRemoveSymbol,
  onClear,
  onRunAnalysis,
  onRefresh,
  isRefreshing = false,
}: CompareWorkspaceProps) {
  const canRunCompare = selectedSymbols.length >= 2;
  const [draftSymbol, setDraftSymbol] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const handleAddSymbol = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = onAddSymbol(draftSymbol);
    if (message) {
      setInputError(message);
      return;
    }

    setDraftSymbol("");
    setInputError(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terminal-border bg-terminal-card/45 px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 text-accent" />
            <p className="terminal-section-title">对比分析</p>
          </div>
          <p className="mt-1 text-sm text-terminal-muted">
            先挑选 2 到 4 只股票，再点击开始分析，横向比较价格、估值、成长与事件热度。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="terminal-btn-primary"
            onClick={onRunAnalysis}
            disabled={!canRunCompare || isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {isRefreshing ? "分析中..." : "开始分析"}
          </button>
          <button
            type="button"
            className="terminal-btn-ghost"
            onClick={onRefresh}
            disabled={section.status !== "success" || isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            刷新数据
          </button>
          <button type="button" className="terminal-btn-ghost" onClick={onClear} disabled={selectedSymbols.length === 0}>
            清空
          </button>
        </div>
      </div>

      <form
        className="rounded-2xl border border-terminal-border bg-terminal-card/40 px-4 py-4"
        onSubmit={handleAddSymbol}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="terminal-label text-[9px] tracking-[0.22em]">手动加入股票</p>
            <p className="mt-1 text-sm text-terminal-muted">
              支持直接输入代码加入对比，例如 `TSM`、`AAPL`、`600519`、`0700`。
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
            <input
              value={draftSymbol}
              maxLength={16}
              placeholder="输入股票代码后加入对比"
              className="terminal-input rounded-xl border border-terminal-border bg-terminal-card/60 px-3 py-2.5"
              onChange={(event) => {
                setDraftSymbol(event.target.value.toUpperCase());
                if (inputError) {
                  setInputError(null);
                }
              }}
            />
            <button type="submit" className="terminal-btn-ghost whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" />
              加入对比
            </button>
          </div>
        </div>
        {inputError ? (
          <div className="mt-3 rounded-xl border border-loss-border bg-loss-bg px-3 py-2 text-sm text-loss">
            {inputError}
          </div>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-1.5">
        {selectedSymbols.length > 0 ? (
          selectedSymbols.map((symbol) => (
            <span key={symbol} className="inline-flex items-center gap-1.5 rounded-xl border border-terminal-border bg-terminal-card px-3 py-1.5 text-xs text-terminal-text">
              <button type="button" onClick={() => onOpenSymbol(symbol)} className="font-mono hover:text-accent-light">
                {symbol}
              </button>
              <button
                type="button"
                className="text-terminal-dim transition hover:text-loss"
                aria-label={`移除 ${symbol}`}
                onClick={() => onRemoveSymbol(symbol)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="terminal-pill-default text-[10px]">可以从推荐池添加，也可以在这里手动输入股票代码</span>
        )}
      </div>

      {!canRunCompare ? (
        <div className="rounded-2xl border border-dashed border-terminal-border px-4 py-8 text-center text-sm text-terminal-dim">
          当前已选 {selectedSymbols.length} 只，再添加 {Math.max(0, 2 - selectedSymbols.length)} 只即可开始对比分析。
        </div>
      ) : null}

      {canRunCompare && section.status === "idle" ? (
        <div className="rounded-2xl border border-terminal-border bg-terminal-card/35 px-4 py-4 text-sm text-terminal-text-secondary">
          当前已选 {selectedSymbols.length} 只股票。对比分析不会自动触发，确认列表后点击上方“开始分析”生成结果。
        </div>
      ) : null}

      {canRunCompare && section.status === "loading" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-terminal-border bg-terminal-card/50 px-4 py-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-terminal-text">正在生成对比结果...</p>
            <p className="text-xs text-terminal-dim">价格、财务指标与事件热度同步中。</p>
          </div>
        </div>
      ) : null}

      {canRunCompare && section.status === "error" ? (
        <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
          {section.error}
        </div>
      ) : null}

      {canRunCompare && section.status === "success" && section.data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-terminal-border bg-terminal-card/35 px-4 py-3 text-[11px] text-terminal-dim">
            <span>生成时间：{formatDateTime(section.data.generated_at)}</span>
            <span>支持快速比较价格、估值、成长与事件热度，不直接构成投资建议。</span>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {section.data.items.map((item) => {
              const tone = getChangeTone(item.symbol, item.quote.change_percent);
              const metrics = buildMetrics(item);

              return (
                <div key={item.symbol} className="terminal-card overflow-hidden">
                  <div className="flex items-start justify-between gap-3 border-b border-terminal-border px-4 py-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => onOpenSymbol(item.symbol)}
                        className="font-mono text-lg font-bold text-terminal-text transition hover:text-accent-light"
                      >
                        {item.symbol}
                      </button>
                      <p className="mt-0.5 text-xs text-terminal-muted">{item.company_name ?? "基础资料暂缺"}</p>
                      {item.fundamentals?.industry ? (
                        <p className="mt-1 text-[11px] text-terminal-dim">{item.fundamentals.industry}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold text-terminal-text">
                        {formatCurrency(item.quote.price, item.quote.currency)}
                      </p>
                      <p className={`font-mono text-xs font-semibold ${tone.textClassName}`}>
                        {formatSignedPercent(item.quote.change_percent)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((metric) => (
                        <div
                          key={`${item.symbol}-${metric.label}`}
                          className="rounded-xl border border-terminal-border bg-terminal-card/40 px-3 py-2.5"
                        >
                          <p className="text-[10px] uppercase tracking-[0.16em] text-terminal-dim">{metric.label}</p>
                          <p className="mt-1 font-mono text-sm font-semibold text-terminal-text">{metric.value}</p>
                        </div>
                      ))}
                    </div>

                    {item.fundamentals?.source_note ? (
                      <div className="rounded-xl border border-terminal-border bg-terminal-card/30 px-3.5 py-3 text-sm leading-6 text-terminal-text-secondary">
                        {item.fundamentals.source_note}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-warning-border bg-warning-bg/50 px-3.5 py-3 text-sm leading-6 text-terminal-text-secondary">
                        当前这只股票的基本面字段还不完整，先展示行情、新闻与已获取到的财务项。
                      </div>
                    )}

                    {item.highlights.length > 0 ? (
                      <div className="rounded-xl border border-terminal-border bg-terminal-card/30 px-3.5 py-3">
                        <p className="terminal-label text-[9px] tracking-[0.22em]">对比要点</p>
                        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-terminal-text-secondary">
                          {item.highlights.map((highlight) => (
                            <li key={highlight} className="flex gap-2">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      <span className="terminal-pill-default text-[10px]">
                        行情 {formatRelativeTime(item.quote.market_time)}
                      </span>
                      {item.latest_news_time ? (
                        <span className="terminal-pill-default text-[10px]">
                          新闻 {formatRelativeTime(item.latest_news_time)}
                        </span>
                      ) : null}
                      {item.latest_announcement_time ? (
                        <span className="terminal-pill-default text-[10px]">
                          公告 {formatRelativeTime(item.latest_announcement_time)}
                        </span>
                      ) : null}
                    </div>

                    {item.data_sources.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.data_sources.slice(0, 4).map((source) => (
                          <span key={`${item.symbol}-${source}`} className="terminal-pill-default text-[10px]">
                            {source}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
