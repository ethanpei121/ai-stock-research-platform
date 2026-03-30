import { ArrowUpRight, Building2, Clock3 } from "lucide-react";

import { formatCurrency, formatDateTime, formatSignedNumber, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import type { AsyncSection, Quote } from "@/lib/types";

type QuoteCardProps = {
  symbol: string;
  section: AsyncSection<Quote>;
};


function QuoteSkeleton() {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
      <div className="h-10 w-40 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-14 animate-pulse rounded bg-white" />
        <div className="h-14 animate-pulse rounded bg-white" />
        <div className="h-14 animate-pulse rounded bg-white" />
      </div>
    </div>
  );
}


export function QuoteCard({ symbol, section }: QuoteCardProps) {
  if (section.status === "loading") {
    return <QuoteSkeleton />;
  }

  if (section.status === "error") {
    return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{section.error}</p>;
  }

  if (section.status !== "success" || !section.data) {
    return <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">等待加载行情快照。</p>;
  }

  const tone = getChangeTone(symbol, section.data.change_percent);

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Quote Snapshot</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="font-mono text-3xl font-semibold tracking-tight text-slate-900">
              {formatCurrency(section.data.price, section.data.currency)}
            </h3>
            <span className={`inline-flex items-center rounded-md px-2.5 py-1 font-mono text-sm font-semibold ${tone.badgeClassName}`}>
              {formatSignedPercent(section.data.change_percent)}
            </span>
          </div>
        </div>

        <div className="grid gap-1 text-sm text-slate-500">
          <div className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>{section.data.provider}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            <span>{formatDateTime(section.data.market_time)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Price Change</p>
          <p className={`mt-2 font-mono text-lg font-semibold ${tone.textClassName}`}>{formatSignedNumber(section.data.change)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Change %</p>
          <p className={`mt-2 font-mono text-lg font-semibold ${tone.textClassName}`}>{formatSignedPercent(section.data.change_percent)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Currency</p>
          <p className="mt-2 inline-flex items-center gap-2 font-mono text-lg font-semibold text-slate-900">
            {section.data.currency}
            <ArrowUpRight className="h-4 w-4 text-slate-400" />
          </p>
        </div>
      </div>
    </section>
  );
}
