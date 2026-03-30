import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, RecommendationsResponse } from "@/lib/types";

type RecommendationsPanelProps = {
  section: AsyncSection<RecommendationsResponse>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onAnalyzeSymbol: (symbol: string) => void;
};


export function RecommendationsPanel({
  section,
  selectedCategory,
  onCategoryChange,
  onAnalyzeSymbol,
}: RecommendationsPanelProps) {
  const categories = section.status === "success" && section.data
    ? ["全部", ...section.data.categories]
    : ["全部"];

  const groups = section.status === "success" && section.data
    ? section.data.groups.filter((group) => selectedCategory === "全部" || group.category === selectedCategory)
    : [];

  return (
    <section className="recommendation-panel">
      <div className="recommendation-panel__header">
        <div>
          <p className="section-tag">Idea Shelf</p>
          <h2>推荐股票模块</h2>
          <p className="section-note">
            按行业和细分赛道整理推荐股票。点击任意标的，会直接带入上方研究引擎继续看行情、新闻和 AI 总结。
          </p>
        </div>
        {section.status === "success" && section.data ? (
          <div className="recommendation-meta">
            <span>赛道数 {section.data.groups.length}</span>
            <span>更新时间 {formatDateTime(section.data.updated_at)}</span>
          </div>
        ) : null}
      </div>

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

      {section.status === "loading" ? <p className="loading-copy">正在整理推荐池与细分赛道...</p> : null}
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
                      className="pick-row"
                      onClick={() => onAnalyzeSymbol(stock.symbol)}
                    >
                      <div className="pick-row__main">
                        <div className="pick-row__head">
                          <strong>{stock.symbol}</strong>
                          <span>{stock.company_name}</span>
                        </div>
                        <p>{stock.rationale}</p>
                        <div className="tag-list">
                          <span className="tag-chip tag-chip--market">{stock.market}</span>
                          <span className="tag-chip tag-chip--region">{stock.region}</span>
                          {stock.tags.map((tag) => (
                            <span key={`${stock.symbol}-${tag}`} className="tag-chip">
                              {tag}
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
          <p className="empty-copy">当前分类下还没有可展示的推荐标的。</p>
        )
      ) : null}
    </section>
  );
}
