import type { KeyboardEvent } from "react";
import { ArrowLeftRight, Star } from "lucide-react";

import { Sparkline, generateSparklineData } from "@/components/Sparkline";
import { formatCurrency, formatSignedPercent } from "@/lib/formatters";
import { getChangeTone } from "@/lib/market";
import type { AsyncSection, Quote, RecommendationStock } from "@/lib/types";

type StockCardProps = {
  stock: RecommendationStock;
  quote: AsyncSection<Quote> | undefined;
  rank?: number;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  isCompared?: boolean;
  onToggleCompare?: () => void;
  isActive: boolean;
  onClick: () => void;
};

type ScoreMeterProps = {
  label: string;
  value: number;
};

function getScoreBadgeClass(total: number): string {
  if (total >= 4.3) {
    return "terminal-pill-gain";
  }
  if (total >= 3.6) {
    return "terminal-pill-accent";
  }
  return "terminal-pill-default";
}

function getCoverageLabel(stock: RecommendationStock): string {
  if (!stock.scorecard || !stock.evidence) {
    return "固定观察池";
  }

  let coveredDimensions = 0;

  if (
    stock.evidence.momentum_1m !== null ||
    stock.evidence.momentum_3m !== null ||
    stock.evidence.volume_ratio !== null
  ) {
    coveredDimensions += 1;
  }
  if (stock.evidence.revenue_growth !== null || stock.evidence.earnings_growth !== null) {
    coveredDimensions += 1;
  }
  if (
    stock.evidence.analyst_target_upside !== null ||
    stock.evidence.analyst_consensus !== null ||
    stock.evidence.analyst_opinion_count !== null
  ) {
    coveredDimensions += 1;
  }
  if (stock.evidence.news_count_7d > 0) {
    coveredDimensions += 1;
  }

  if (coveredDimensions >= 4) {
    return "四维覆盖";
  }
  if (coveredDimensions >= 3) {
    return "多维覆盖";
  }
  return "部分维度中性";
}

function buildEvidencePills(stock: RecommendationStock): string[] {
  if (!stock.evidence) {
    return [];
  }

  const evidence = stock.evidence;
  const pills: string[] = [];

  if (evidence.momentum_3m !== null) {
    pills.push(`3月动量 ${formatSignedPercent(evidence.momentum_3m)}`);
  }
  if (evidence.revenue_growth !== null) {
    pills.push(`营收 ${formatSignedPercent(evidence.revenue_growth)}`);
  } else if (evidence.earnings_growth !== null) {
    pills.push(`盈利 ${formatSignedPercent(evidence.earnings_growth)}`);
  }
  if (evidence.analyst_target_upside !== null) {
    pills.push(`目标价 ${formatSignedPercent(evidence.analyst_target_upside)}`);
  } else if (evidence.analyst_consensus) {
    pills.push(`一致预期 ${evidence.analyst_consensus}`);
  }
  if (evidence.news_count_7d > 0) {
    pills.push(`新闻 ${evidence.news_count_7d} 条`);
  }
  if (pills.length < 3 && evidence.volume_ratio !== null) {
    pills.push(`量比 ${evidence.volume_ratio.toFixed(2)}x`);
  }

  return pills.slice(0, 3);
}

function ScoreMeter({ label, value }: ScoreMeterProps) {
  const width = `${Math.max(0, Math.min(100, (value / 5) * 100))}%`;

  return (
    <div className="space-y-1.5 rounded-xl border border-terminal-border bg-terminal-card/40 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-terminal-dim">{label}</span>
        <span className="font-mono text-[11px] font-semibold text-terminal-text">{value}/5</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-terminal-border">
        <div className="h-full rounded-full bg-accent" style={{ width }} />
      </div>
    </div>
  );
}

export function StockCard({
  stock,
  quote,
  rank,
  isWatchlisted = false,
  onToggleWatchlist,
  isCompared = false,
  onToggleCompare,
  isActive,
  onClick,
}: StockCardProps) {
  const quoteData = quote?.status === "success" ? quote.data : null;
  const isLoading = quote?.status === "loading" || quote?.status === "idle" || !quote;

  const changePercent = quoteData?.change_percent ?? 0;
  const tone = getChangeTone(stock.symbol, changePercent);
  const isPositive = changePercent >= 0;

  const sparklineData = generateSparklineData(stock.symbol);
  const tags = stock.tags.slice(0, 2);
  const evidencePills = buildEvidencePills(stock);
  const coverageLabel = getCoverageLabel(stock);
  const scorecard = stock.scorecard;
  const scoreMeters = scorecard
    ? [
        { label: "景气", value: scorecard.prosperity },
        { label: "估值", value: scorecard.valuation },
        { label: "资金", value: scorecard.fund_flow },
        { label: "催化", value: scorecard.catalyst },
      ]
    : [];

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      className={`group terminal-card-interactive flex flex-col gap-3 p-4 text-left transition-all duration-200 ${
        isActive ? "border-accent/40 bg-accent-muted shadow-glow" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {rank ? <p className="terminal-label text-[9px] tracking-[0.24em]">Rank #{rank}</p> : null}
          <p className="font-mono text-base font-bold text-terminal-text">{stock.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-terminal-muted">{stock.company_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            {onToggleCompare ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCompare();
                }}
                className={`rounded-lg border p-2 transition ${
                  isCompared
                    ? "border-accent/30 bg-accent-muted text-accent-light"
                    : "border-terminal-border text-terminal-dim hover:border-terminal-border-hover hover:text-terminal-text"
                }`}
                aria-label={isCompared ? `从对比中移除 ${stock.symbol}` : `加入对比 ${stock.symbol}`}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onToggleWatchlist ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleWatchlist();
                }}
                className={`rounded-lg border p-2 transition ${
                  isWatchlisted
                    ? "border-accent/30 bg-accent-muted text-accent-light"
                    : "border-terminal-border text-terminal-dim hover:border-terminal-border-hover hover:text-terminal-text"
                }`}
                aria-label={isWatchlisted ? `从自选中移除 ${stock.symbol}` : `加入自选 ${stock.symbol}`}
              >
                <Star className={`h-3.5 w-3.5 ${isWatchlisted ? "fill-current" : ""}`} />
              </button>
            ) : null}
          </div>
          {scorecard ? (
            <span className={`${getScoreBadgeClass(scorecard.total)} text-[10px]`}>
              {scorecard.label} · {scorecard.total.toFixed(1)}
            </span>
          ) : null}
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
      </div>

      <div className="space-y-2">
        {quoteData ? (
          <p className="font-mono text-lg font-bold tracking-tight text-terminal-text">
            {formatCurrency(quoteData.price, quoteData.currency)}
          </p>
        ) : isLoading ? (
          <div className="h-6 w-24 animate-pulse rounded bg-terminal-card" />
        ) : (
          <p className="font-mono text-lg text-terminal-dim">--</p>
        )}
        <p className="text-xs leading-5 text-terminal-muted">{stock.rationale}</p>
      </div>

      {scorecard ? (
        <div className="space-y-2 rounded-xl border border-terminal-border bg-terminal-card/35 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="terminal-label text-[9px] tracking-[0.22em]">四维评分</p>
            <span className="text-[10px] text-terminal-dim">{coverageLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {scoreMeters.map((item) => (
              <ScoreMeter key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      ) : null}

      {evidencePills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {evidencePills.map((pill) => (
            <span key={pill} className="terminal-pill-default text-[10px]">
              {pill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Sparkline
            data={sparklineData}
            width={100}
            height={24}
            positive={isPositive}
            className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
          />
          <span className="terminal-pill-default text-[10px]">{coverageLabel}</span>
        </div>
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
    </div>
  );
}
