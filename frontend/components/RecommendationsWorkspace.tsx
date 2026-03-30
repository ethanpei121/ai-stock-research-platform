import { RefreshCw } from "lucide-react";

import { formatCurrency, formatDateTime, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
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


type MarketCoverage = {
  aShares: number;
  usStocks: number;
  scoreReady: number;
};


function QuotePriceCell({ symbol, quoteSnapshots }: { symbol: string; quoteSnapshots: RecommendationQuoteMap }) {
  const snapshot = quoteSnapshots[symbol];

  if (!snapshot || snapshot.status === "idle" || snapshot.status === "loading") {
    return <span className="font-mono text-sm text-slate-400">Loading</span>;
  }

  if (snapshot.status !== "success" || !snapshot.data) {
    return <span className="font-mono text-sm text-slate-400">--</span>;
  }

  return <span className="font-mono text-sm font-semibold text-slate-900">{formatCurrency(snapshot.data.price, snapshot.data.currency)}</span>;
}


function QuoteChangeCell({ symbol, quoteSnapshots }: { symbol: string; quoteSnapshots: RecommendationQuoteMap }) {
  const snapshot = quoteSnapshots[symbol];

  if (!snapshot || snapshot.status === "idle" || snapshot.status === "loading") {
    return <span className="font-mono text-sm text-slate-400">--</span>;
  }

  if (snapshot.status !== "success" || !snapshot.data) {
    return <span className="font-mono text-sm text-slate-400">--</span>;
  }

  const tone = getChangeTone(symbol, snapshot.data.change_percent);

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${tone.badgeClassName}`}>
      {formatSignedPercent(snapshot.data.change_percent)}
    </span>
  );
}


function getCoverage(rows: RecommendationRow[]): MarketCoverage {
  return rows.reduce<MarketCoverage>(
    (accumulator, row) => {
      if (row.market.includes("CN")) {
        accumulator.aShares += 1;
      }
      if (row.market.includes("US")) {
        accumulator.usStocks += 1;
      }
      if (row.scorecard) {
        accumulator.scoreReady += 1;
      }
      return accumulator;
    },
    { aShares: 0, usStocks: 0, scoreReady: 0 }
  );
}


function scoreLabel(row: RecommendationRow) {
  if (!row.scorecard) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">固定观察池</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-sm font-semibold text-slate-900">{row.scorecard.total.toFixed(1)}</span>
      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100">{row.scorecard.label}</span>
    </div>
  );
}


function StatCell({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-900/5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 font-mono text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}


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
  const coverage = getCoverage(rows);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCell label="Universe" value={String(rows.length)} note="当前筛选后的推荐标的数量" />
        <StatCell label="US Coverage" value={String(coverage.usStocks)} note="当前列表里的美股与美股 ADR" />
        <StatCell label="A-share Coverage" value={String(coverage.aShares)} note="当前列表里的 A 股标的" />
        <StatCell
          label="Scored Names"
          value={String(coverage.scoreReady)}
          note={data?.mode === "live" ? "已进入实时评分模式" : "固定池状态下默认不显示评分"}
        />
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="flex flex-col gap-5 border-b border-slate-200/80 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600">Market Dashboard</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">推荐股票池</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-slate-500">
              默认展示固定观察池，并同步回补每只股票的市场快照。点击任意股票或使用顶部搜索框，即可在右侧打开个股 AI 分析。点击“刷新实时推荐”后，结果会按后端实时数据重新排序。
            </p>
            <div className="flex flex-wrap gap-2">
              {activeSymbol ? (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                  当前查看: {activeSymbol}
                </span>
              ) : null}
              {data?.mode === "live" ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  实时推荐模式已开启
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-900/5">
                  当前为固定观察池模式
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            {data ? (
              <div className="grid gap-1 text-sm text-slate-500 lg:text-right">
                <span>模式: {data.mode === "live" ? "实时推荐" : "固定观察池"}</span>
                <span>标的数: {rows.length}</span>
                <span>更新时间: {formatDateTime(data.updated_at)}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-progress disabled:opacity-60"
              disabled={isRefreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "刷新中..." : "刷新实时推荐"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4 md:grid-cols-[220px_220px_minmax(0,1fr)] md:items-end lg:px-6">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            行业
            <select
              value={selectedCategory}
              className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/5 outline-none transition focus:ring-2 focus:ring-indigo-100"
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            风格
            <select
              value={selectedStyle}
              className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/5 outline-none transition focus:ring-2 focus:ring-indigo-100"
              onChange={(event) => onStyleChange(event.target.value)}
            >
              {styleFilters.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>

          {data ? (
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
              <span className="font-medium text-slate-900">推荐方法:</span> {data.methodology}
            </div>
          ) : null}
        </div>

        {refreshError ? <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-600 lg:px-6">{refreshError}</div> : null}

        {section.status === "loading" ? <div className="px-5 py-10 text-sm text-slate-500 lg:px-6">推荐股票池正在加载。</div> : null}

        {section.status === "error" ? <div className="px-5 py-10 text-sm text-rose-600 lg:px-6">{section.error}</div> : null}

        {data ? (
          rows.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-full divide-y divide-slate-200/80 text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Symbol</th>
                      <th className="px-6 py-3">Company</th>
                      <th className="px-6 py-3">Sector</th>
                      <th className="px-6 py-3">Price</th>
                      <th className="px-6 py-3">Change</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 bg-white">
                    {rows.map((row) => {
                      const isActive = row.symbol.toUpperCase() === activeSymbol;

                      return (
                        <tr
                          key={`${row.groupId}-${row.symbol}`}
                          tabIndex={0}
                          role="button"
                          aria-pressed={isActive}
                          className={`cursor-pointer align-top transition focus:outline-none ${
                            isActive ? "bg-indigo-50/60" : "hover:bg-slate-50/80 focus:bg-slate-50/80"
                          }`}
                          onClick={() => onOpenSymbol(row.symbol)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onOpenSymbol(row.symbol);
                            }
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <p className="font-mono text-sm font-semibold text-slate-900">{row.symbol}</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">{row.market}</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">{row.region}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1.5">
                              <p className="font-medium text-slate-900">{row.company_name}</p>
                              <div className="flex flex-wrap gap-2">
                                {row.tags.slice(0, 3).map((tag) => (
                                  <span key={`${row.symbol}-${tag}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1.5">
                              <p className="text-sm font-medium text-slate-900">{row.category}</p>
                              <p className="text-sm text-slate-500">{row.subcategory}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <QuotePriceCell symbol={row.symbol} quoteSnapshots={quoteSnapshots} />
                          </td>
                          <td className="px-6 py-4">
                            <QuoteChangeCell symbol={row.symbol} quoteSnapshots={quoteSnapshots} />
                          </td>
                          <td className="px-6 py-4">{scoreLabel(row)}</td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <p className="text-sm leading-6 text-slate-700">{row.rationale}</p>
                              <div className="flex flex-wrap gap-2">
                                {row.styles.map((style) => (
                                  <span key={`${row.symbol}-${style}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">
                                    {style}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-200/80 xl:hidden">
                {rows.map((row) => {
                  const isActive = row.symbol.toUpperCase() === activeSymbol;

                  return (
                    <button
                      key={`${row.groupId}-${row.symbol}`}
                      type="button"
                      className={`grid w-full gap-4 px-5 py-4 text-left transition sm:px-6 ${isActive ? "bg-indigo-50/60" : "hover:bg-slate-50/80"}`}
                      onClick={() => onOpenSymbol(row.symbol)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="font-mono text-base font-semibold text-slate-900">{row.symbol}</p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">{row.category}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-900">{row.company_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{row.subcategory}</p>
                        </div>
                        <div className="text-right">
                          <QuotePriceCell symbol={row.symbol} quoteSnapshots={quoteSnapshots} />
                          <div className="mt-2">
                            <QuoteChangeCell symbol={row.symbol} quoteSnapshots={quoteSnapshots} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm leading-6 text-slate-700">{row.rationale}</p>
                        <div className="shrink-0">{scoreLabel(row)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {row.styles.map((style) => (
                          <span key={`${row.symbol}-${style}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">
                            {style}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-200/80 bg-slate-50/80 px-5 py-4 text-xs text-slate-500 lg:px-6">
                数据来源: {data.data_sources.join(" / ") || "前端固定观察池"}
              </div>
            </>
          ) : (
            <div className="px-5 py-10 text-sm text-slate-500 lg:px-6">当前筛选条件下没有可展示的股票。</div>
          )
        ) : null}
      </div>
    </section>
  );
}
