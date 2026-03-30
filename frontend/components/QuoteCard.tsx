import { formatCurrency, formatDateTime, formatSignedNumber, formatSignedPercent } from "@/lib/formatters";
import type { AsyncSection, Quote } from "@/lib/types";

type QuoteCardProps = {
  symbol: string;
  section: AsyncSection<Quote>;
};


export function QuoteCard({ symbol, section }: QuoteCardProps) {
  return (
    <article className="result-card">
      <div className="result-card__header">
        <div>
          <p className="section-tag">实时行情</p>
          <h2>{symbol}</h2>
        </div>
      </div>

      {section.status === "idle" ? <p className="empty-copy">点击“开始分析”后显示行情结果。</p> : null}
      {section.status === "loading" ? <p className="loading-copy">正在拉取最新行情...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}

      {section.status === "success" && section.data ? (
        <div className="quote-grid">
          <div className="metric-panel">
            <span>最新价格</span>
            <strong>{formatCurrency(section.data.price, section.data.currency)}</strong>
          </div>
          <div className="metric-panel">
            <span>涨跌额</span>
            <strong>{formatSignedNumber(section.data.change)}</strong>
          </div>
          <div className="metric-panel">
            <span>涨跌幅</span>
            <strong>{formatSignedPercent(section.data.change_percent)}</strong>
          </div>
          <div className="metric-panel">
            <span>市场时间</span>
            <strong>{formatDateTime(section.data.market_time)}</strong>
          </div>
        </div>
      ) : null}
    </article>
  );
}
