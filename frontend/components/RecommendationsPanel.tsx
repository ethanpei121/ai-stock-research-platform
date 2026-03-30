import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, RecommendationStock, RecommendationsResponse } from "@/lib/types";

type RecommendationsPanelProps = {
  section: AsyncSection<RecommendationsResponse>;
  selectedCategory: string;
  selectedStyle: string;
  isRefreshing: boolean;
  refreshError: string | null;
  onCategoryChange: (category: string) => void;
  onStyleChange: (style: string) => void;
  onAnalyzeSymbol: (symbol: string) => void;
  onRefresh: () => void;
};


type MetricChip = {
  label: string;
  value: string;
};


function formatPercent(value: number | null): string {
  if (value === null) {
    return "数据不足";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}


function formatRatio(value: number | null): string {
  if (value === null) {
    return "数据不足";
  }
  return `${value.toFixed(2)}x`;
}


function getMetricChips(stock: RecommendationStock): MetricChip[] {
  if (!stock.evidence) {
    return [];
  }

  return [
    { label: "1M", value: formatPercent(stock.evidence.momentum_1m) },
    { label: "3M", value: formatPercent(stock.evidence.momentum_3m) },
    { label: "量比", value: formatRatio(stock.evidence.volume_ratio) },
    { label: "新闻", value: `${stock.evidence.news_count_7d} 条` },
    {
      label: "目标空间",
      value:
        stock.evidence.analyst_target_upside === null
          ? stock.evidence.analyst_consensus ?? "数据不足"
          : formatPercent(stock.evidence.analyst_target_upside),
    },
  ];
}


export function RecommendationsPanel({
  section,
  selectedCategory,
  selectedStyle,
  isRefreshing,
  refreshError,
  onCategoryChange,
  onStyleChange,
  onAnalyzeSymbol,
  onRefresh,
}: RecommendationsPanelProps) {
  const data = section.status === "success" ? section.data : null;
  const mode = data?.mode ?? "preset";
  const isLiveMode = mode === "live";

  const categories = data ? ["全部", ...data.categories] : ["全部"];
  const styleFilters = data ? ["全部", ...data.style_filters] : ["全部"];

  const groups = data
    ? data.groups
        .filter((group) => selectedCategory === "全部" || group.category === selectedCategory)
        .map((group) => ({
          ...group,
          stocks: group.stocks.filter((stock) => selectedStyle === "全部" || stock.styles.includes(selectedStyle)),
        }))
        .filter((group) => group.stocks.length > 0)
    : [];

  return (
    <section className="recommendation-panel">
      <div className="recommendation-panel__header recommendation-panel__header--actionable">
        <div>
          <p className="section-tag">Idea Shelf</p>
          <h2>{isLiveMode ? "真实数据推荐模块" : "固定推荐股票池"}</h2>
          <p className="section-note">
            {isLiveMode
              ? "当前结果已经按真实价格历史、成交量、新闻热度和分析师一致预期完成动态重排。缺少公开数据的维度会按中性处理，不会伪造结论。"
              : "首屏先展示固定观察池，方便快速浏览行业代表标的；只有点击右侧按钮后，系统才会调用后端做实时动态推荐。"}
          </p>
        </div>

        <div className="recommendation-panel__actions">
          {data ? (
            <div className="recommendation-meta">
              <span>{isLiveMode ? `赛道数 ${data.groups.length}` : `固定分组 ${data.groups.length}`}</span>
              <span>{isLiveMode ? `更新时间 ${formatDateTime(data.updated_at)}` : "尚未执行实时重排"}</span>
            </div>
          ) : null}

          <button
            type="button"
            className="secondary-button"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            {isRefreshing ? "实时分析中..." : isLiveMode ? "更新实时推荐" : "实时分析推荐"}
          </button>
        </div>
      </div>

      {data ? (
        <div className={`methodology-strip ${isLiveMode ? "" : "methodology-strip--preset"}`.trim()}>
          <p>{data.methodology}</p>
          <div className="tag-list">
            {data.data_sources.map((source) => (
              <span key={source} className="tag-chip tag-chip--source">
                {source}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="filter-stack">
        <div className="filter-group">
          <span className="filter-group__label">行业</span>
          <div className="category-pills" role="tablist" aria-label="推荐行业分类">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`category-pill ${selectedCategory === category ? "category-pill--active" : ""}`}
                onClick={() => onCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-group__label">风格</span>
          <div className="category-pills" role="tablist" aria-label="推荐风格分类">
            {styleFilters.map((style) => (
              <button
                key={style}
                type="button"
                className={`category-pill ${selectedStyle === style ? "category-pill--active" : ""}`}
                onClick={() => onStyleChange(style)}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </div>

      {section.status === "loading" ? <p className="loading-copy">推荐股票模块正在等待加载。</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}
      {refreshError ? <p className="error-copy">{refreshError}</p> : null}

      {data ? (
        groups.length > 0 ? (
          <div className="recommendation-grid">
            {groups.map((group) => (
              <article key={group.id} className="theme-card">
                <div className="theme-card__header">
                  <p className="theme-card__eyebrow">{group.category}</p>
                  <h3>{group.subcategory}</h3>
                  <p>{group.description}</p>
                </div>

                <div className="theme-card__stocks">
                  {group.stocks.map((stock) => {
                    const metricChips = getMetricChips(stock);

                    return (
                      <button
                        key={`${group.id}-${stock.symbol}`}
                        type="button"
                        className="pick-row pick-row--research"
                        onClick={() => onAnalyzeSymbol(stock.symbol)}
                      >
                        <div className="pick-row__main">
                          <div className="pick-row__topline">
                            <div className="pick-row__head">
                              <strong>{stock.symbol}</strong>
                              <span>{stock.company_name}</span>
                            </div>
                            {stock.scorecard ? (
                              <div className="score-badge-group">
                                <span className="score-badge">总分 {stock.scorecard.total.toFixed(1)}</span>
                                <span className="status-chip status-chip--live">{stock.scorecard.label}</span>
                              </div>
                            ) : (
                              <div className="score-badge-group">
                                <span className="status-chip status-chip--preset">固定观察池</span>
                              </div>
                            )}
                          </div>

                          <p>{stock.rationale}</p>

                          {stock.scorecard ? (
                            <>
                              <div className="score-grid">
                                <div className="score-cell">
                                  <span>景气度</span>
                                  <strong>{stock.scorecard.prosperity}</strong>
                                </div>
                                <div className="score-cell">
                                  <span>估值</span>
                                  <strong>{stock.scorecard.valuation}</strong>
                                </div>
                                <div className="score-cell">
                                  <span>资金活跃度</span>
                                  <strong>{stock.scorecard.fund_flow}</strong>
                                </div>
                                <div className="score-cell">
                                  <span>催化</span>
                                  <strong>{stock.scorecard.catalyst}</strong>
                                </div>
                              </div>

                              {metricChips.length > 0 ? (
                                <div className="metric-chip-row">
                                  {metricChips.map((item) => (
                                    <div key={`${stock.symbol}-${item.label}`} className="metric-chip">
                                      <span>{item.label}</span>
                                      <strong>{item.value}</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="preset-note">
                              点击“实时分析推荐”后，这里会显示基于最新公开数据重算出来的景气度、估值、资金活跃度和催化分数。
                            </div>
                          )}

                          <div className="tag-list">
                            <span className="tag-chip tag-chip--market">{stock.market}</span>
                            <span className="tag-chip tag-chip--region">{stock.region}</span>
                            {stock.styles.map((style) => (
                              <span key={`${stock.symbol}-${style}`} className="tag-chip tag-chip--style">
                                {style}
                              </span>
                            ))}
                            {stock.tags.map((tag) => (
                              <span key={`${stock.symbol}-${tag}`} className="tag-chip">
                                {tag}
                              </span>
                            ))}
                          </div>

                          {stock.data_sources.length > 0 ? (
                            <div className="source-strip">
                              {stock.data_sources.map((source) => (
                                <span key={`${stock.symbol}-${source}`} className="source-pill">
                                  {source}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span className="pick-action">快速分析</span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">当前筛选条件下还没有可展示的推荐标的。</p>
        )
      ) : null}
    </section>
  );
}
