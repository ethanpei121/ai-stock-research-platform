import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, NewsResponse } from "@/lib/types";

type NewsListProps = {
  section: AsyncSection<NewsResponse>;
};


export function NewsList({ section }: NewsListProps) {
  return (
    <article className="result-card">
      <div className="result-card__header">
        <div>
          <p className="section-tag">新闻聚合</p>
          <h2>最新资讯</h2>
        </div>
      </div>

      {section.status === "idle" ? <p className="empty-copy">分析完成后，这里会展示最近 5 条相关新闻。</p> : null}
      {section.status === "loading" ? <p className="loading-copy">正在整理新闻列表...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}

      {section.status === "success" && section.data ? (
        section.data.items.length > 0 ? (
          <div className="news-stack">
            {section.data.items.map((item) => (
              <a
                key={`${item.url}-${item.published_at}`}
                className="news-item"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                <strong>{item.title}</strong>
                <span>
                  {item.source} · {formatDateTime(item.published_at)}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="empty-copy">当前没有可展示的新闻。</p>
        )
      ) : null}
    </article>
  );
}
