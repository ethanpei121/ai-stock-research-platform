"use client";

import type { ReactNode } from "react";
import { BookmarkCheck, Clock3, Search, Star, Trash2 } from "lucide-react";

import { formatCurrency, formatDateTime, formatRelativeTime, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import { RESEARCH_STATUSES } from "@/lib/research-tracker";
import type {
  AsyncSection,
  Quote,
  RecentViewedItem,
  ResearchStatus,
  WatchlistItem,
} from "@/lib/types";

type QuoteSnapshotMap = Record<string, AsyncSection<Quote>>;

type ResearchWorkspaceProps = {
  watchlist: WatchlistItem[];
  recentViews: RecentViewedItem[];
  quoteSnapshots: QuoteSnapshotMap;
  activeSymbol: string;
  onOpenSymbol: (symbol: string) => void;
  onToggleWatchlist: (input: { symbol: string; company_name?: string | null }) => void;
  onRemoveWatchlist: (symbol: string) => void;
  onStatusChange: (symbol: string, status: ResearchStatus) => void;
};

type ResearchItemCardProps = {
  symbol: string;
  companyName: string;
  subtitle?: string | null;
  quoteSection?: AsyncSection<Quote>;
  isActive?: boolean;
  metadata?: string[];
  trailing?: ReactNode;
  onOpen: () => void;
};

function QuoteInline({ symbol, section }: { symbol: string; section?: AsyncSection<Quote> }) {
  if (!section || section.status === "idle" || section.status === "loading") {
    return <span className="text-[11px] text-terminal-dim">同步中...</span>;
  }

  if (section.status === "error" || !section.data) {
    return <span className="text-[11px] text-terminal-dim">行情暂缺</span>;
  }

  const tone = getChangeTone(symbol, section.data.change_percent);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-semibold text-terminal-text">
        {formatCurrency(section.data.price, section.data.currency)}
      </span>
      <span className={`font-mono text-[11px] font-semibold ${tone.textClassName}`}>
        {formatSignedPercent(section.data.change_percent)}
      </span>
    </div>
  );
}

function ResearchItemCard({
  symbol,
  companyName,
  subtitle,
  quoteSection,
  isActive = false,
  metadata = [],
  trailing,
  onOpen,
}: ResearchItemCardProps) {
  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 transition ${
        isActive
          ? "border-accent/30 bg-accent-muted shadow-glow-sm"
          : "border-terminal-border bg-terminal-card/40 hover:border-terminal-border-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="font-mono text-sm font-bold text-terminal-text">{symbol}</p>
          <p className="mt-0.5 truncate text-xs text-terminal-muted">{companyName}</p>
          {subtitle ? <p className="mt-1 text-[11px] text-terminal-dim">{subtitle}</p> : null}
        </button>
        {trailing}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <QuoteInline symbol={symbol} section={quoteSection} />
        {metadata.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1">
            {metadata.map((item) => (
              <span key={item} className="terminal-pill-default text-[10px]">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ResearchWorkspace({
  watchlist,
  recentViews,
  quoteSnapshots,
  activeSymbol,
  onOpenSymbol,
  onToggleWatchlist,
  onRemoveWatchlist,
  onStatusChange,
}: ResearchWorkspaceProps) {
  const activeWatchCount = watchlist.filter((item) => item.status === "持续跟踪").length;
  const pendingCount = watchlist.filter((item) => item.status === "待研究").length;
  const watchlistSet = new Set(watchlist.map((item) => item.symbol.toUpperCase()));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terminal-border bg-terminal-card/45 px-4 py-3">
        <div>
          <p className="terminal-section-title">研究清单</p>
          <p className="mt-1 text-sm text-terminal-muted">
            用本地清单沉淀关注标的、研究状态和最近查看记录。
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="terminal-pill-accent text-[10px]">自选 {watchlist.length}</span>
          <span className="terminal-pill-default text-[10px]">持续跟踪 {activeWatchCount}</span>
          <span className="terminal-pill-default text-[10px]">待研究 {pendingCount}</span>
          <span className="terminal-pill-default text-[10px]">最近查看 {recentViews.length}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="terminal-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <BookmarkCheck className="h-3.5 w-3.5 text-accent" />
              <p className="terminal-section-title">自选与状态</p>
            </div>
            <span className="text-[10px] text-terminal-dim">本地持久化</span>
          </div>

          <div className="space-y-3 p-4">
            {watchlist.length > 0 ? (
              watchlist.map((item) => (
                <ResearchItemCard
                  key={item.symbol}
                  symbol={item.symbol}
                  companyName={item.company_name}
                  subtitle={`加入于 ${formatDateTime(item.added_at)}`}
                  quoteSection={quoteSnapshots[item.symbol]}
                  isActive={item.symbol === activeSymbol}
                  metadata={[
                    item.status,
                    ...(item.market ? [item.market] : []),
                    ...(item.region ? [item.region] : []),
                  ].slice(0, 3)}
                  trailing={
                    <div className="flex shrink-0 items-center gap-1.5">
                      <select
                        value={item.status}
                        onChange={(event) => onStatusChange(item.symbol, event.target.value as ResearchStatus)}
                        className="rounded-lg border border-terminal-border bg-terminal-card px-2 py-1 text-[11px] text-terminal-text outline-none transition hover:border-terminal-border-hover"
                        aria-label={`设置 ${item.symbol} 的研究状态`}
                      >
                        {RESEARCH_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded-lg border border-terminal-border p-2 text-terminal-dim transition hover:border-loss-border hover:text-loss"
                        aria-label={`移除 ${item.symbol}`}
                        onClick={() => onRemoveWatchlist(item.symbol)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                  onOpen={() => onOpenSymbol(item.symbol)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-terminal-border px-4 py-8 text-center text-sm text-terminal-dim">
                还没有自选标的。可以在推荐卡片或分析面板里点击星标加入研究清单。
              </div>
            )}
          </div>
        </div>

        <div className="terminal-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-accent" />
              <p className="terminal-section-title">最近查看</p>
            </div>
            <span className="text-[10px] text-terminal-dim">自动记录</span>
          </div>

          <div className="space-y-3 p-4">
            {recentViews.length > 0 ? (
              recentViews.map((item) => (
                <ResearchItemCard
                  key={item.symbol}
                  symbol={item.symbol}
                  companyName={item.company_name}
                  subtitle={`查看于 ${formatRelativeTime(item.viewed_at)}`}
                  quoteSection={quoteSnapshots[item.symbol]}
                  isActive={item.symbol === activeSymbol}
                  metadata={[formatDateTime(item.viewed_at)]}
                  trailing={
                    <button
                      type="button"
                      className={`rounded-lg border p-2 transition ${
                        watchlistSet.has(item.symbol.toUpperCase())
                          ? "border-accent/30 bg-accent-muted text-accent-light"
                          : "border-terminal-border text-terminal-dim hover:border-accent/30 hover:text-accent-light"
                      }`}
                      aria-label={
                        watchlistSet.has(item.symbol.toUpperCase())
                          ? `从自选中移除 ${item.symbol}`
                          : `收藏 ${item.symbol}`
                      }
                      onClick={() =>
                        onToggleWatchlist({
                          symbol: item.symbol,
                          company_name: item.company_name,
                        })
                      }
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${watchlistSet.has(item.symbol.toUpperCase()) ? "fill-current" : ""}`}
                      />
                    </button>
                  }
                  onOpen={() => onOpenSymbol(item.symbol)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-terminal-border px-4 py-8 text-center text-sm text-terminal-dim">
                打开个股分析后，这里会保留最近查看记录，方便回看。
              </div>
            )}

            <div className="rounded-2xl border border-terminal-border bg-terminal-card/35 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-terminal-muted">
                <Search className="h-3.5 w-3.5 text-accent" />
                顶部搜索打开的标的也会自动进入最近查看列表。
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
