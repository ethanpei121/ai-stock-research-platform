import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, NewsResponse } from "@/lib/types";

type NewsListProps = {
  section: AsyncSection<NewsResponse>;
};


function NewsSkeleton() {
  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 px-5 py-4">
            <div className="h-4 animate-pulse rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export function NewsList({ section }: NewsListProps) {
  const providers = section.status === "success" && section.data ? section.data.providers ?? [] : [];

  if (section.status === "loading") {
    return <NewsSkeleton />;
  }

  if (section.status === "error") {
    return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{section.error}</p>;
  }

  if (section.status !== "success" || !section.data) {
    return <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">等待新闻时间线加载。</p>;
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">News Timeline</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-slate-900">相关新闻</h3>
          {providers.length > 0 ? <span className="text-xs text-slate-500">来源: {providers.join(" / ")}</span> : null}
        </div>
      </div>

      {section.data.items.length > 0 ? (
        <ol className="divide-y divide-slate-200">
          {section.data.items.map((item, index) => (
            <li key={`${item.url}-${item.published_at}-${index}`} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
              <div className="font-mono text-xs text-slate-500">{formatDateTime(item.published_at)}</div>
              <a href={item.url} target="_blank" rel="noreferrer" className="group min-w-0">
                <p className="text-sm font-medium leading-6 text-slate-900 transition group-hover:text-slate-700">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.source}</p>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-5 py-6 text-sm text-slate-500">当前没有可展示的新闻。</div>
      )}
    </section>
  );
}
