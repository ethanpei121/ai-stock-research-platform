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
  onCategoryChange,
  onStyleChange,
  onOpenSymbol,
  onRefresh,
}: RecommendationsWorkspaceProps) {
  const data = section.status === "success" ? section.data : null;
  const categories = data ? ["全部", ...data.categories] : ["全部"];
  const styleFilters = data ? ["全部", ...data.style_filters] : ["全部"];
  const rows: RecommendationRow[] = data
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

  return (
    <section className="space-y-4">
      {/* Header bar */}
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

      {/* Filter tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Category tabs */}
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

        {/* Style filter pills */}
        <div className="hidden h-5 w-px bg-terminal-border sm:block" />
        <div className="flex flex-wrap gap-1.5">
          {styleFilters.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onStyleChange(style)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                selectedStyle === style
                  ? "bg-terminal-card-hover text-accent-light border border-accent/20"
                  : "text-terminal-dim hover:text-terminal-muted"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {refreshError ? (
        <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
          {refreshError}
        </div>
      ) : null}

      {/* Loading state */}
      {section.status === "loading" ? (
        <div className="flex items-center gap-3 rounded-xl border border-terminal-border bg-terminal-card/50 px-4 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-terminal-muted">正在加载推荐池...</span>
        </div>
      ) : null}

      {/* Error state */}
      {section.status === "error" ? (
        <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-8 text-sm text-loss">
          {section.error}
        </div>
      ) : null}

      {/* Card grid */}
      {data ? (
        rows.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((row) => (
              <StockCard
                key={`${row.groupId}-${row.symbol}`}
                stock={row}
                quote={quoteSnapshots[row.symbol]}
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
