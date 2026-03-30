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
  const model = meta.model ? ` / ${meta.model}` : "";
  return `${provider}${model}`;
}


export function SummaryCard({ section }: SummaryCardProps) {
  const providerLabel = getProviderLabel(section);
  const bullish = section.status === "success" && section.data ? section.data.summary.bullish ?? [] : [];
  const bearish = section.status === "success" && section.data ? section.data.summary.bearish ?? [] : [];
  const conclusion = section.status === "success" && section.data ? section.data.summary.conclusion ?? "当前暂无可用结论。" : "";
  const isFallback = section.status === "success" && section.data ? section.data.meta?.is_fallback ?? true : true;

  return (
    <article className="result-card result-card--summary">
      <div className="result-card__header">
        <div>
          <p className="section-tag">Research Thesis</p>
          <h2>Closing Note</h2>
        </div>
        {providerLabel ? (
          <span className={`status-chip ${isFallback ? "status-chip--fallback" : "status-chip--live"}`}>
            {providerLabel}
          </span>
        ) : null}
      </div>

      {section.status === "idle" ? <p className="empty-copy">等待模型形成研究结论。</p> : null}
      {section.status === "loading" ? <p className="loading-copy">正在组织这只股票的最终判断...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}

      {section.status === "success" && section.data ? (
        <div className="thesis-grid">
          <section className="thesis-block">
            <h3>Long Case</h3>
            <ul className="bullet-list">
              {bullish.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="thesis-block">
            <h3>Risk Case</h3>
            <ul className="bullet-list">
              {bearish.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="thesis-block thesis-block--conclusion">
            <h3>Decision Memo</h3>
            <p className="conclusion-copy">{conclusion}</p>
          </section>
        </div>
      ) : null}
    </article>
  );
}
