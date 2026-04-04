import { ExternalLink, Loader2, Newspaper } from "lucide-react";

import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, NewsResponse } from "@/lib/types";

type NewsListProps = {
  section: AsyncSection<NewsResponse>;
};


function NewsLoadingState() {
  return (
    <div className="terminal-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-terminal-text">正在拉取资讯...</p>
          <p className="text-xs text-terminal-dim">新闻时间线即将就绪。</p>
        </div>
      </div>
    </div>
  );
}


export function NewsList({ section }: NewsListProps) {
  const providers = section.status === "success" && section.data ? section.data.providers ?? [] : [];

  if (section.status === "loading") return <NewsLoadingState />;

  if (section.status === "error") {
    return (
      <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
        {section.error}
      </div>
    );
  }

  if (section.status !== "success" || !section.data) {
    return (
      <div className="terminal-card px-4 py-3 text-sm text-terminal-dim">等待新闻加载。</div>
    );
  }

  const items = section.data.items;

  return (
    <div className="terminal-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Newspaper className="h-3.5 w-3.5 text-accent" />
          <p className="terminal-section-title">相关新闻</p>
        </div>
        {providers.length > 0 ? (
          <span className="text-[10px] text-terminal-dim">
            {providers.join(" · ")}
          </span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="divide-y divide-terminal-border">
          {items.map((item, index) => (
            <a
              key={`${item.url}-${index}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-3 px-4 py-3 transition hover:bg-terminal-card-hover"
            >
              <div className="relative mt-1.5 shrink-0">
                <span className="block h-2 w-2 rounded-full bg-accent/60 group-hover:bg-accent" />
                {index < items.length - 1 && (
                  <span className="absolute left-[3px] top-3 h-[calc(100%+0.75rem)] w-px bg-terminal-border" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-terminal-text transition group-hover:text-accent-light">
                  {item.title}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-terminal-dim">
                  <span>{formatDateTime(item.published_at)}</span>
                  <span>·</span>
                  <span>{item.source}</span>
                </div>
              </div>
              <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-terminal-dim opacity-0 transition group-hover:opacity-100" />
            </a>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-terminal-dim">暂无相关新闻。</div>
      )}
    </div>
  );
}
