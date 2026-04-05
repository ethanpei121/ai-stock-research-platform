import { Building2, Clock3, Loader2, TrendingUp } from "lucide-react";

import { Sparkline, generateSparklineData } from "@/components/Sparkline";
import { formatCurrency, formatDateTime, formatSignedNumber, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import type { AsyncSection, Quote } from "@/lib/types";

type QuoteCardProps = {
  symbol: string;
  section: AsyncSection<Quote>;
};

function QuoteLoadingState() {
  return (
    <div className="terminal-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-terminal-text">正在获取行情...</p>
          <p className="text-xs text-terminal-dim">价格和涨跌幅就绪后立即展示。</p>
        </div>
      </div>
    </div>
  );
}

export function QuoteCard({ symbol, section }: QuoteCardProps) {
  if (section.status === "loading") return <QuoteLoadingState />;

  if (section.status === "error") {
    return (
      <div className="rounded-xl border border-loss-border bg-loss-bg px-4 py-3 text-sm text-loss">
        {section.error}
      </div>
    );
  }

  if (section.status !== "success" || !section.data) {
    return (
      <div className="terminal-card px-4 py-3 text-sm text-terminal-dim">等待加载行情。</div>
    );
  }

  const tone = getChangeTone(symbol, section.data.change_percent);
  const sparklineData = generateSparklineData(symbol, 20);
  const isPositive = section.data.change_percent >= 0;

  return (
    <div className="terminal-card overflow-hidden">
      {/* Price header */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div>
          <div className="terminal-label flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            行情概览
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold tracking-tight text-terminal-text">
              {formatCurrency(section.data.price, section.data.currency)}
            </span>
            <span className={`font-mono text-sm font-semibold ${tone.badgeClassName}`}>
              {formatSignedPercent(section.data.change_percent)}
            </span>
          </div>
        </div>
        <Sparkline data={sparklineData} width={80} height={32} positive={isPositive} className="mt-3 shrink-0" />
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-3 gap-px border-t border-terminal-border bg-terminal-border">
        <div className="bg-terminal-card px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-terminal-dim">变动</p>
          <p className={`mt-1 font-mono text-sm font-semibold ${tone.textClassName}`}>
            {formatSignedNumber(section.data.change)}
          </p>
        </div>
        <div className="bg-terminal-card px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-terminal-dim">涨跌幅</p>
          <p className={`mt-1 font-mono text-sm font-semibold ${tone.textClassName}`}>
            {formatSignedPercent(section.data.change_percent)}
          </p>
        </div>
        <div className="bg-terminal-card px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-terminal-dim">币种</p>
          <p className="mt-1 font-mono text-sm font-semibold text-terminal-text">{section.data.currency}</p>
        </div>
      </div>

      {/* Meta footer */}
      <div className="flex items-center justify-between border-t border-terminal-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] text-terminal-dim">
          <Building2 className="h-3 w-3" />
          {section.data.provider}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-terminal-dim">
          <Clock3 className="h-3 w-3" />
          {formatDateTime(section.data.market_time)}
        </span>
      </div>
    </div>
  );
}
