import { ArrowUpRight, Building2, Clock3, Loader2, TrendingUp } from "lucide-react";

import { formatCurrency, formatDateTime, formatSignedNumber, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import type { AsyncSection, Quote } from "@/lib/types";

type QuoteCardProps = {
  symbol: string;
  section: AsyncSection<Quote>;
};

function QuoteLoadingState() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">正在获取最新可用行情...</p>
          <p className="mt-1 text-sm text-slate-500">价格、涨跌幅和市场时间就绪后会立即展示。</p>
        </div>
      </div>
    </section>
  );
}

export function QuoteCard({ symbol, section }: QuoteCardProps) {
  if (section.status === "loading") {
    return <QuoteLoadingState />;
  }

  if (section.status === "error") {
    return <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm ring-1 ring-rose-100">{section.error}</p>;
  }

  if (section.status !== "success" || !section.data) {
    return <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-900/5">等待加载行情快照。</p>;
  }

  const tone = getChangeTone(symbol, section.data.change_percent);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="grid gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-5 py-5 text-white lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
            <TrendingUp className="h-4 w-4" />
            Quote Snapshot
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h3 className="font-mono text-4xl font-semibold tracking-tight text-white">
              {formatCurrency(section.data.price, section.data.currency)}
            </h3>
            <span className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-sm font-semibold ${tone.badgeClassName}`}>
              {formatSignedPercent(section.data.change_percent)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:justify-items-end">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
            <Building2 className="h-3.5 w-3.5" />
            {section.data.provider}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDateTime(section.data.market_time)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-900/5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Price Change</p>
          <p className={`mt-3 font-mono text-lg font-semibold ${tone.textClassName}`}>{formatSignedNumber(section.data.change)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-900/5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Change %</p>
          <p className={`mt-3 font-mono text-lg font-semibold ${tone.textClassName}`}>{formatSignedPercent(section.data.change_percent)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-900/5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Currency</p>
          <p className="mt-3 inline-flex items-center gap-2 font-mono text-lg font-semibold text-slate-900">
            {section.data.currency}
            <ArrowUpRight className="h-4 w-4 text-indigo-500" />
          </p>
        </div>
      </div>
    </section>
  );
}
