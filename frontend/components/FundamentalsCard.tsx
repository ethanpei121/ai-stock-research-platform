"use client";

import { BarChart3, Building2, Loader2 } from "lucide-react";

import {
  formatCompactNumber,
  formatDateTime,
  formatMetricNumber,
  formatMetricPercent,
} from "@/lib/formatters";
import type { AsyncSection, FundamentalsResponse } from "@/lib/types";

type FundamentalsCardProps = {
  section: AsyncSection<FundamentalsResponse>;
};

type MetricTileProps = {
  label: string;
  value: string;
  emphasize?: "positive" | "negative" | "neutral";
};

type MetricConfig = {
  label: string;
  value: string;
  emphasize?: "positive" | "negative" | "neutral";
};

function FundamentalsLoadingState() {
  return (
    <div className="terminal-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-terminal-text">正在同步基本面...</p>
          <p className="text-xs text-terminal-dim">估值、盈利能力和成长指标加载中。</p>
        </div>
      </div>
    </div>
  );
}

function isBenignMessage(message: string | null): boolean {
  return Boolean(message && (message.includes("未找到") || message.includes("不支持")));
}

function MetricTile({ label, value, emphasize = "neutral" }: MetricTileProps) {
  const valueClassName =
    emphasize === "positive"
      ? "text-gain"
      : emphasize === "negative"
        ? "text-loss"
        : "text-terminal-text";

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-card/50 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-terminal-dim">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

export function FundamentalsCard({ section }: FundamentalsCardProps) {
  if (section.status === "loading") return <FundamentalsLoadingState />;

  if (section.status === "error") {
    if (isBenignMessage(section.error)) {
      return (
        <div className="terminal-card px-4 py-3 text-sm text-terminal-dim">
          {section.error}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
        {section.error}
      </div>
    );
  }

  if (section.status !== "success" || !section.data) {
    return (
      <div className="terminal-card px-4 py-3 text-sm text-terminal-dim">等待同步基本面数据。</div>
    );
  }

  const data = section.data;
  const metrics: MetricConfig[] = [
    { label: "总市值", value: formatCompactNumber(data.market_cap) },
    { label: "流通市值", value: formatCompactNumber(data.float_market_cap) },
    { label: "PE", value: formatMetricNumber(data.pe_ratio, 2) },
    { label: "PB", value: formatMetricNumber(data.pb_ratio, 2) },
    { label: "ROE", value: formatMetricPercent(data.roe) },
    { label: "毛利率", value: formatMetricPercent(data.gross_margin) },
    { label: "净利率", value: formatMetricPercent(data.net_margin) },
    { label: "资产负债率", value: formatMetricPercent(data.debt_to_asset) },
    {
      label: "营收增速",
      value: formatMetricPercent(data.revenue_growth),
      emphasize: data.revenue_growth === null ? "neutral" : data.revenue_growth >= 0 ? "positive" : "negative",
    },
    {
      label: "净利增速",
      value: formatMetricPercent(data.net_profit_growth),
      emphasize:
        data.net_profit_growth === null ? "neutral" : data.net_profit_growth >= 0 ? "positive" : "negative",
    },
  ];

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-accent" />
          <p className="terminal-section-title">基本面概览</p>
        </div>
        {data.providers.length > 0 ? (
          <span className="text-[10px] text-terminal-dim">{data.providers.join(" · ")}</span>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {data.company_name ? (
            <span className="terminal-pill-accent">{data.company_name}</span>
          ) : null}
          {data.industry ? (
            <span className="terminal-pill-default">{data.industry}</span>
          ) : null}
          {data.listed_date ? (
            <span className="terminal-pill-default">上市 {data.listed_date}</span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {metrics.map((metric) => (
            <MetricTile
              key={metric.label}
              label={metric.label}
              value={metric.value}
              emphasize={metric.emphasize}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-terminal-border pt-3 text-[11px] text-terminal-dim">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            截至 {formatDateTime(data.as_of)}
          </span>
          {data.symbol ? <span className="font-mono">{data.symbol}</span> : null}
        </div>

        {data.source_note ? (
          <p className="rounded-xl border border-terminal-border bg-terminal-card/40 px-3 py-2 text-[11px] leading-5 text-terminal-dim">
            {data.source_note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
