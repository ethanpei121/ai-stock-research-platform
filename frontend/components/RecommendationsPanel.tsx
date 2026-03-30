import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, RecommendationStock, RecommendationsResponse } from "@/lib/types";

type RecommendationsPanelProps = {
  section: AsyncSection<RecommendationsResponse>;
  selectedCategory: string;
  selectedStyle: string;
  onCategoryChange: (category: string) => void;
  onStyleChange: (style: string) => void;
  onAnalyzeSymbol: (symbol: string) => void;
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
  onCategoryChange,
  onStyleChange,
  onAnalyzeSymbol,
}: RecommendationsPanelProps) {
  const categories = section.status === "success" && section.data
    ? ["全部", ...section.data.categories]
    : ["全部"];

  const styleFilters = section.status === "success" && section.data
    ? ["全部", ...section.data.style_filters]
    : ["全部"];

  const groups = section.status === "success" && section.data
    ? section.data.groups
        .filter((group) => selectedCategory === "全部" || group.category === selectedCategory)
        .map((group) => ({
          ...group,
          stocks: group.stocks.filter((stock) => selectedStyle === "全部" || stock.styles.includes(selectedStyle)),
        }))
        .filter((group) => group.stocks.length > 0)
    : [];

  return (
    <section className="recommendation-panel">
      <div className="recommendation-panel__header">
        <div>
          <p className="section-tag">Idea Shelf</p>
          <h2>真实数据推荐模块</h2>
          <p className="section-note">
            先按行业与细分赛道建立候选池，再用真实价格历史、成交量变化、近 7 天新闻数量和分析师一致预期动态打分。
            缺少公开数据的维度会按中性处理，不会伪造结论。
          </p>
        </div>
        {section.status === "success" && section.data ? (
          <div className="recommendation-meta">
            <span>赛道数 {section.data.groups.length}</span>
            <span>更新时间 {formatDateTime(section.data.updated_at)}</span>
          </div>
        ) : null}
      </div>

      {section.status === "success" && section.data ? (
        <div className="methodology-strip">
          <p>{section.data.methodology}</p>
          <div className="tag-list">
            {section.data.data_sources.map((source) => (
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

      {section.status === "loading" ? <p className="loading-copy">正在根据真实行情、新闻和分析师数据重排推荐池...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}
      {section.status === "idle" ? <p className="empty-copy">推荐股票模块正在等待加载。</p> : null}

      {section.status === "success" && section.data ? (
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
                  {group.stocks.map((stock) => (
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
                          <div className="score-badge-group">
                            <span className="score-badge">总分 {stock.scorecard.total.toFixed(1)}</span>
                            <span className="status-chip status-chip--live">{stock.scorecard.label}</span>
                          </div>
                        </div>

                        <p>{stock.rationale}</p>

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

                        <div className="metric-chip-row">
                          {getMetricChips(stock).map((item) => (
                            <div key={`${stock.symbol}-${item.label}`} className="metric-chip">
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>

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

                        <div className="source-strip">
                          {stock.data_sources.map((source) => (
                            <span key={`${stock.symbol}-${source}`} className="source-pill">
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="pick-action">快速分析</span>
                    </button>
                  ))}
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
