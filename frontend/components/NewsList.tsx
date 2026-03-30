import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, NewsResponse } from "@/lib/types";

type NewsListProps = {
  section: AsyncSection<NewsResponse>;
};


export function NewsList({ section }: NewsListProps) {
  return (
    <article className="result-card result-card--news">
      <div className="result-card__header">
        <div>
          <p className="section-tag">Catalyst Feed</p>
          <h2>Event Watch</h2>
          {section.status === "success" && section.data && section.data.providers.length > 0 ? (
            <p className="section-note">聚合来源: {section.data.providers.join(" / ")}</p>
          ) : null}
        </div>
      </div>

      {section.status === "idle" ? <p className="empty-copy">等待事件流更新。</p> : null}
      {section.status === "loading" ? <p className="loading-copy">正在整理最新催化事件...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}

      {section.status === "success" && section.data ? (
        section.data.items.length > 0 ? (
          <ol className="news-ledger">
            {section.data.items.map((item, index) => (
              <li key={`${item.url}-${item.published_at}`} className="news-ledger__item">
                <span className="news-ledger__index">{String(index + 1).padStart(2, "0")}</span>
                <a className="news-ledger__body" href={item.url} target="_blank" rel="noreferrer">
                  <strong>{item.title}</strong>
                  <span>
                    {item.source} · {formatDateTime(item.published_at)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">当前没有可展示的新闻。</p>
        )
      ) : null}
    </article>
  );
}
