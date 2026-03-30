import { Loader2, Newspaper } from "lucide-react";

import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, NewsResponse } from "@/lib/types";

type NewsListProps = {
  section: AsyncSection<NewsResponse>;
};


function NewsLoadingState() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-900/5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">正在拉取最新资讯...</p>
          <p className="mt-1 text-sm text-slate-500">事件时间线会按时间顺序整理在这里。</p>
        </div>
      </div>
    </section>
  );
}


export function NewsList({ section }: NewsListProps) {
  const providers = section.status === "success" && section.data ? section.data.providers ?? [] : [];

  if (section.status === "loading") {
    return <NewsLoadingState />;
  }

  if (section.status === "error") {
    return <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm ring-1 ring-rose-100">{section.error}</p>;
  }

  if (section.status !== "success" || !section.data) {
    return <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5">等待新闻时间线加载。</p>;
  }

  const items = section.data.items;

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="border-b border-slate-200/80 px-5 py-5">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600">
          <Newspaper className="h-4 w-4" />
          News Timeline
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold text-slate-900">相关新闻</h3>
          {providers.length > 0 ? <span className="text-xs text-slate-500">来源: {providers.join(" / ")}</span> : null}
        </div>
      </div>

      {items.length > 0 ? (
        <ol className="px-5 py-2">
          {items.map((item, index) => (
            <li key={`${item.url}-${item.published_at}-${index}`} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
              <div className="font-mono text-xs text-slate-500">{formatDateTime(item.published_at)}</div>
              <div className="relative min-w-0 pl-6">
                <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                {index < items.length - 1 ? <span className="absolute left-[4px] top-5 bottom-[-1.4rem] w-px bg-slate-200" /> : null}
                <a href={item.url} target="_blank" rel="noreferrer" className="group min-w-0">
                  <p className="text-sm font-medium leading-6 text-slate-900 transition group-hover:text-indigo-700">{item.title}</p>
                </a>
                <div className="mt-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/5">
                    {item.source}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-5 py-6 text-sm text-slate-500">当前没有可展示的新闻。</div>
      )}
    </section>
  );
}
