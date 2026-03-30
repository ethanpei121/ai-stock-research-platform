import { formatCurrency, formatDateTime, formatSignedNumber, formatSignedPercent } from "@/lib/formatters";
import type { AsyncSection, Quote } from "@/lib/types";

type QuoteCardProps = {
  symbol: string;
  section: AsyncSection<Quote>;
};


export function QuoteCard({ symbol, section }: QuoteCardProps) {
  const toneClass =
    section.status === "success" && section.data && section.data.change_percent < 0
      ? "tone-negative"
      : "tone-positive";
  const provider = section.status === "success" && section.data ? section.data.provider || "Yahoo Finance" : null;

  return (
    <article className="result-card result-card--quote">
      <div className="result-card__header">
        <div>
          <p className="section-tag">Market Tape</p>
          <h2>{symbol}</h2>
          {provider ? <p className="section-note">当前行情命中渠道: {provider}</p> : null}
        </div>
        {section.status === "success" && section.data ? (
          <span className={`quote-direction ${toneClass}`}>
            {formatSignedPercent(section.data.change_percent)}
          </span>
        ) : null}
      </div>

      {section.status === "idle" ? <p className="empty-copy">等待研究任务开始。</p> : null}
      {section.status === "loading" ? <p className="loading-copy">正在回补最新市场价格...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}

      {section.status === "success" && section.data ? (
        <>
          <div className="quote-spotline">
            <div>
              <p className="quote-label">Spot Price</p>
              <div className={`quote-price ${toneClass}`}>{formatCurrency(section.data.price, section.data.currency)}</div>
            </div>
            <p className="quote-timestamp">{formatDateTime(section.data.market_time)}</p>
          </div>

          <div className="quote-ledger">
            <div className="ledger-cell">
              <span>Change</span>
              <strong>{formatSignedNumber(section.data.change)}</strong>
            </div>
            <div className="ledger-cell">
              <span>Change %</span>
              <strong>{formatSignedPercent(section.data.change_percent)}</strong>
            </div>
            <div className="ledger-cell">
              <span>Currency</span>
              <strong>{section.data.currency}</strong>
            </div>
            <div className="ledger-cell">
              <span>Provider</span>
              <strong>{provider ?? "Yahoo Finance"}</strong>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}
