import { Bot, ShieldAlert } from "lucide-react";

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


function SummarySkeleton() {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-4">
        <div className="h-20 animate-pulse rounded bg-slate-50" />
        <div className="h-20 animate-pulse rounded bg-slate-50" />
        <div className="h-24 animate-pulse rounded bg-slate-50" />
      </div>
    </div>
  );
}


export function SummaryCard({ section }: SummaryCardProps) {
  const providerLabel = getProviderLabel(section);

  if (section.status === "loading") {
    return <SummarySkeleton />;
  }

  if (section.status === "error") {
    return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{section.error}</p>;
  }

  if (section.status !== "success" || !section.data) {
    return <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">等待生成分析师备忘录。</p>;
  }

  const isFallback = section.data.meta?.is_fallback ?? true;

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Analyst Memo</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">AI 简报</h3>
        </div>
        {providerLabel ? (
          <span
            className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ${
              isFallback ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            {providerLabel}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
              <Bot className="h-4 w-4 text-slate-500" />
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

          <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
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

        <section className="rounded-md border border-slate-200 bg-slate-900 px-4 py-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Conclusion</p>
          <p className="mt-3 text-sm leading-6 text-slate-100">{section.data.summary.conclusion}</p>
        </section>
      </div>
    </section>
  );
}
