import { ChevronDown, Lightbulb, Loader2, MapPinned, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, SummaryResponse } from "@/lib/types";

type SummaryCardProps = {
  section: AsyncSection<SummaryResponse>;
};

function getProviderLabel(section: AsyncSection<SummaryResponse>): string | null {
  if (section.status !== "success" || !section.data) return null;
  const meta = section.data.meta;
  if (!meta || meta.is_fallback) return "模板回退";
  const provider = meta.provider === "dashscope" ? "千问" : meta.provider === "openai" ? "OpenAI" : meta.provider;
  return meta.model ? `${provider} · ${meta.model}` : provider;
}

function SummaryLoadingState() {
  return (
    <div className="terminal-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-terminal-text">AI 正在撰写简报...</p>
          <p className="text-xs text-terminal-dim">利好、风险与结论生成中。</p>
        </div>
      </div>
    </div>
  );
}

export function SummaryCard({ section }: SummaryCardProps) {
  const [showMeta, setShowMeta] = useState(false);
  const providerLabel = getProviderLabel(section);

  if (section.status === "loading") return <SummaryLoadingState />;

  if (section.status === "error") {
    return (
      <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
        {section.error}
      </div>
    );
  }

  if (section.status !== "success" || !section.data) {
    return (
      <div className="terminal-card px-4 py-3 text-sm text-terminal-dim">等待生成分析简报。</div>
    );
  }

  const { meta } = section.data;
  const isFallback = meta?.is_fallback ?? true;

  return (
    <div className="terminal-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <p className="terminal-section-title">AI 投研简报</p>
        {providerLabel ? (
          <span className={`terminal-pill text-[10px] ${
            isFallback
              ? "border border-terminal-border bg-terminal-card text-terminal-dim"
              : "border border-gain-border bg-gain-bg text-gain"
          }`}>
            {providerLabel}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {/* Bullish */}
        {section.data.summary.bullish.length > 0 && (
          <div className="rounded-xl border border-gain-border bg-gain-bg/50 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gain">
              <Lightbulb className="h-3.5 w-3.5" />
              利好因素
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-terminal-text-secondary">
              {section.data.summary.bullish.map((item, index) => (
                <li key={`b-${index}`} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gain" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bearish */}
        {section.data.summary.bearish.length > 0 && (
          <div className="rounded-xl border border-warning-border bg-warning-bg/50 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
              <ShieldAlert className="h-3.5 w-3.5" />
              风险因素
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-terminal-text-secondary">
              {section.data.summary.bearish.map((item, index) => (
                <li key={`r-${index}`} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warning" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Conclusion */}
        <div className="rounded-xl border border-accent/20 bg-accent-muted px-3.5 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent-light">
            <MapPinned className="h-3.5 w-3.5" />
            结论
          </div>
          <p className="text-sm leading-relaxed text-terminal-text-secondary">
            {section.data.summary.conclusion}
          </p>
        </div>

        {/* Collapsible meta */}
        <button
          type="button"
          onClick={() => setShowMeta(!showMeta)}
          className="flex w-full items-center gap-1.5 text-[10px] text-terminal-dim transition hover:text-terminal-muted"
        >
          <ChevronDown className={`h-3 w-3 transition ${showMeta ? "rotate-180" : ""}`} />
          数据来源详情
        </button>
        {showMeta && meta && (
          <div className="grid gap-1 rounded-lg border border-terminal-border bg-terminal-card/50 px-3 py-2 text-[11px] text-terminal-dim">
            <span>行情来源: {meta.quote_provider ?? "--"}</span>
            <span>行情时间: {meta.quote_market_time ? formatDateTime(meta.quote_market_time) : "--"}</span>
            <span>新闻最新: {meta.latest_news_time ? formatDateTime(meta.latest_news_time) : "--"}</span>
            <span>新闻源: {meta.news_providers?.join(" / ") || "--"}</span>
            <span>刷新: {meta.force_refresh_used ? "已绕过缓存" : "可能使用缓存"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
