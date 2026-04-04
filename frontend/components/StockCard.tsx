import { Sparkline, generateSparklineData } from "@/components/Sparkline";
import { formatCurrency, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import type { AsyncSection, Quote, RecommendationStock } from "@/lib/types";


type StockCardProps = {
  stock: RecommendationStock;
  quote: AsyncSection<Quote> | undefined;
  isActive: boolean;
  onClick: () => void;
};


export function StockCard({ stock, quote, isActive, onClick }: StockCardProps) {
  const quoteData = quote?.status === "success" ? quote.data : null;
  const isLoading = quote?.status === "loading" || quote?.status === "idle" || !quote;

  const changePercent = quoteData?.change_percent ?? 0;
  const tone = getChangeTone(stock.symbol, changePercent);
  const isPositive = changePercent >= 0;

  const sparklineData = generateSparklineData(stock.symbol);
  const tags = stock.tags.slice(0, 2);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group terminal-card-interactive flex flex-col gap-3 p-4 text-left transition-all duration-200 ${
        isActive
          ? "border-accent/40 bg-accent-muted shadow-glow"
          : ""
      }`}
    >
      {/* Header row: symbol + change badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-base font-bold text-terminal-text">{stock.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-terminal-muted">{stock.company_name}</p>
        </div>
        {quoteData ? (
          <span className={`shrink-0 font-mono text-xs font-semibold ${tone.badgeClassName}`}>
            {formatSignedPercent(changePercent)}
          </span>
        ) : isLoading ? (
          <span className="h-5 w-14 animate-pulse rounded bg-terminal-card" />
        ) : (
          <span className="font-mono text-xs text-terminal-dim">--</span>
        )}
      </div>

      {/* Price */}
      <div className="min-h-[1.5rem]">
        {quoteData ? (
          <p className="font-mono text-lg font-bold tracking-tight text-terminal-text">
            {formatCurrency(quoteData.price, quoteData.currency)}
          </p>
        ) : isLoading ? (
          <div className="h-6 w-24 animate-pulse rounded bg-terminal-card" />
        ) : (
          <p className="font-mono text-lg text-terminal-dim">--</p>
        )}
      </div>

      {/* Sparkline */}
      <div className="flex items-end justify-between gap-3">
        <Sparkline
          data={sparklineData}
          width={100}
          height={24}
          positive={isPositive}
          className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
        />
        <div className="flex flex-wrap justify-end gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-terminal-muted border border-terminal-border"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
