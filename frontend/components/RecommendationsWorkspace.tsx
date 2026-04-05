import { RefreshCw } from "lucide-react";

import { StockCard } from "@/components/StockCard";
import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, Quote, RecommendationsResponse } from "@/lib/types";

type RecommendationQuoteMap = Record<string, AsyncSection<Quote>>;

type RecommendationsWorkspaceProps = {
  section: AsyncSection<RecommendationsResponse>;
  quoteSnapshots: RecommendationQuoteMap;
  activeSymbol: string;
  selectedCategory: string;
  selectedStyle: string;
  isRefreshing: boolean;
  refreshError: string | null;
  watchlistSymbols: string[];
  compareSymbols: string[];
  onToggleWatchlist: (input: {
    symbol: string;
    company_name?: string | null;
    market?: string | null;
    region?: string | null;
    tags?: string[] | null;
  }) => void;
  onToggleCompare: (symbol: string) => void;
  onCategoryChange: (category: string) => void;
  onStyleChange: (style: string) => void;
  onOpenSymbol: (symbol: string) => void;
  onRefresh: () => void;
};

type RecommendationRow = RecommendationsResponse["groups"][number]["stocks"][number] & {
  groupId: string;
  category: string;
  subcategory: string;
};

export function RecommendationsWorkspace({
  section,
  quoteSnapshots,
  activeSymbol,
  selectedCategory,
  selectedStyle,
  isRefreshing,
  refreshError,
  watchlistSymbols,
  compareSymbols,
  onToggleWatchlist,
  onToggleCompare,
  onCategoryChange,
  onStyleChange,
  onOpenSymbol,
  onRefresh,
}: RecommendationsWorkspaceProps) {
  const data = section.status === "success" ? section.data : null;
  const categories = data ? ["全部", ...data.categories] : ["全部"];
  const styleFilters = data ? ["全部", ...data.style_filters] : ["全部"];
  const flattenedRows: RecommendationRow[] = data
    ? data.groups
        .filter((group) => selectedCategory === "全部" || group.category === selectedCategory)
        .flatMap((group) =>
          group.stocks
            .filter((stock) => selectedStyle === "全部" || stock.styles.includes(selectedStyle))
            .map((stock) => ({
              ...stock,
              groupId: group.id,
              category: group.category,
              subcategory: group.subcategory,
            }))
        )
    : [];
  const rows =
    data?.mode === "live"
      ? [...flattenedRows].sort((left, right) => {
          const leftScore = left.scorecard?.total ?? -1;
          const rightScore = right.scorecard?.total ?? -1;
          if (rightScore !== leftScore) {
            return rightScore - leftScore;
          }
          return left.symbol.localeCompare(right.symbol);
        })
      : flattenedRows;
  const scoredRows = rows.filter((row) => row.scorecard !== null);
  const averageScore =
    scoredRows.length > 0
      ? scoredRows.reduce((sum, row) => sum + (row.scorecard?.total ?? 0), 0) / scoredRows.length
      : null;
  const displayedSources = data?.data_sources.slice(0, 3) ?? [];
  const hiddenSourceCount = Math.max((data?.data_sources.length ?? 0) - displayedSources.length, 0);
  const watchlistSet = new Set(watchlistSymbols.map((item) => item.toUpperCase()));
  const compareSet = new Set(compareSymbols.map((item) => item.toUpperCase()));

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="terminal-section-title">推荐股票池</p>
          <p className="mt-1 text-sm text-terminal-muted">
            {data?.mode === "live" ? "实时推荐模式" : "固定观察池"} · {rows.length} 只标的
            {data ? ` · ${formatDateTime(data.updated_at)}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="terminal-btn-primary"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "分析中..." : "实时分析推荐"}
        </button>
      </div>

      {data ? (
        <div className="rounded-2xl border border-terminal-border bg-terminal-card/45 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="terminal-label text-[9px] tracking-[0.24em]">
                {data.mode === "live" ? "推荐解释" : "观察池说明"}
              </p>
              <p className="text-sm leading-6 text-terminal-text-secondary">{data.methodology}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.mode === "live" && averageScore !== null ? (
                <span className="terminal-pill-accent text-[10px]">平均总分 {averageScore.toFixed(1)}</span>
              ) : null}
              <span className="terminal-pill-default text-[10px]">
                {data.mode === "live" ? "四维：景气 / 估值 / 资金 / 催化" : "点击实时分析推荐可生成评分"}
              </span>
              {displayedSources.map((source) => (
                <span key={source} className="terminal-pill-default text-[10px]">
                  {source}
                </span>
              ))}
              {hiddenSourceCount > 0 ? (
                <span className="terminal-pill-default text-[10px]">+{hiddenSourceCount} 个数据源</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedCategory === category
                  ? "bg-accent-dark text-white shadow-glow-sm"
                  : "border border-terminal-border text-terminal-muted hover:border-terminal-border-hover hover:text-terminal-text"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="hidden h-5 w-px bg-terminal-border sm:block" />
        <div className="flex flex-wrap gap-1.5">
          {styleFilters.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onStyleChange(style)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                selectedStyle === style
                  ? "bg-terminal-card-hover border border-accent/20 text-accent-light"
                  : "text-terminal-dim hover:text-terminal-muted"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {refreshError ? (
        <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
          {refreshError}
        </div>
      ) : null}

      {section.status === "loading" ? (
        <div className="flex items-center gap-3 rounded-xl border border-terminal-border bg-terminal-card/50 px-4 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-terminal-muted">正在加载推荐池...</span>
        </div>
      ) : null}

      {section.status === "error" ? (
        <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-8 text-sm text-loss">
          {section.error}
        </div>
      ) : null}

      {data ? (
        rows.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((row, index) => (
              <StockCard
                key={`${row.groupId}-${row.symbol}`}
                stock={row}
                quote={quoteSnapshots[row.symbol]}
                rank={data.mode === "live" ? index + 1 : undefined}
                isWatchlisted={watchlistSet.has(row.symbol.toUpperCase())}
                isCompared={compareSet.has(row.symbol.toUpperCase())}
                onToggleWatchlist={() =>
                  onToggleWatchlist({
                    symbol: row.symbol,
                    company_name: row.company_name,
                    market: row.market,
                    region: row.region,
                    tags: row.tags,
                  })
                }
                onToggleCompare={() => onToggleCompare(row.symbol)}
                isActive={row.symbol.toUpperCase() === activeSymbol}
                onClick={() => onOpenSymbol(row.symbol)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-terminal-border bg-terminal-card/50 px-4 py-8 text-center text-sm text-terminal-muted">
            当前筛选条件下没有可展示的股票。
          </div>
        )
      ) : null}
    </section>
  );
}
