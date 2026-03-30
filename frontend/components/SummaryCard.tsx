import { Lightbulb, Loader2, MapPinned, RefreshCcw, ShieldAlert, TimerReset } from "lucide-react";

import { formatDateTime } from "@/lib/formatters";
import type { AsyncSection, SummaryResponse } from "@/lib/types";

type SummaryCardProps = {
  section: AsyncSection<SummaryResponse>;
};

function getProviderLabel(section: AsyncSection<SummaryResponse>): string | null {
  if (section.status !== "success" || !section.data) {
    return null;
  }

  const meta = section.data.meta;
  if (!meta || meta.is_fallback) {
    return "模板回退";
  }

  const provider = meta.provider === "dashscope" ? "阿里云千问" : meta.provider === "openai" ? "OpenAI" : meta.provider;
  return meta.model ? `${provider} / ${meta.model}` : provider;
}

function SummaryLoadingState() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center gap-4 rounded-2xl bg-indigo-50 px-4 py-4 ring-1 ring-indigo-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">AI 正在撰写投研简报...</p>
          <p className="mt-1 text-sm text-slate-500">利好、风险与结论会在这一块逐步回填。</p>
        </div>
      </div>
    </section>
  );
}

export function SummaryCard({ section }: SummaryCardProps) {
  const providerLabel = getProviderLabel(section);

  if (section.status === "loading") {
    return <SummaryLoadingState />;
  }

  if (section.status === "error") {
    return <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm ring-1 ring-rose-100">{section.error}</p>;
  }

  if (section.status !== "success" || !section.data) {
    return <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5">等待生成分析师备忘录。</p>;
  }

  const { meta } = section.data;
  const isFallback = meta?.is_fallback ?? true;
  const latestQuoteTime = meta?.quote_market_time ? formatDateTime(meta.quote_market_time) : "--";
  const latestNewsTime = meta?.latest_news_time ? formatDateTime(meta.latest_news_time) : "--";
  const newsProviders = meta?.news_providers?.length ? meta.news_providers.join(" / ") : "--";

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600">Analyst Memo</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">AI 投研简报</h3>
        </div>
        {providerLabel ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              isFallback ? "bg-slate-100 text-slate-600 ring-slate-900/5" : "bg-emerald-50 text-emerald-700 ring-emerald-100"
            }`}
          >
            {providerLabel}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 px-5 py-5">
        <section className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-900/5 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-slate-900/5">
            <div className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <RefreshCcw className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">本次刷新</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {meta.force_refresh_used ? "已绕过缓存并重新抓取" : "可能使用缓存结果"}
              </p>
              <p className="mt-1 text-xs text-slate-500">系统会直连刷新本轮行情和新闻，再生成摘要。</p>
              <p className="mt-1 text-xs text-slate-400">说明：最新指数据源当前可返回的最新一笔/最新资讯，不代表交易所毫秒级直连。</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-slate-900/5">
            <div className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <TimerReset className="h-4 w-4" />
            </div>
            <div className="grid gap-1 text-sm text-slate-700">
              <p><span className="text-slate-500">行情来源:</span> {meta.quote_provider ?? "--"}</p>
              <p><span className="text-slate-500">行情时间:</span> <span className="font-mono">{latestQuoteTime}</span></p>
              <p><span className="text-slate-500">新闻最新:</span> <span className="font-mono">{latestNewsTime}</span></p>
              <p><span className="text-slate-500">新闻源:</span> {newsProviders}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-100">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Lightbulb className="h-4 w-4" />
              利好因素
            </div>
            <ul className="space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {section.data.summary.bullish.map((item, index) => (
                <li key={`${item}-${index}`} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-amber-50 px-4 py-4 ring-1 ring-amber-100">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
              <ShieldAlert className="h-4 w-4" />
              风险因素
            </div>
            <ul className="space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {section.data.summary.bearish.map((item, index) => (
                <li key={`${item}-${index}`} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl bg-indigo-50 px-4 py-4 ring-1 ring-indigo-100">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-800">
            <MapPinned className="h-4 w-4" />
            结论与执行建议
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">{section.data.summary.conclusion}</p>
        </section>
      </div>
    </section>
  );
}
