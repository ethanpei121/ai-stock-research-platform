import type { AsyncSection, SummaryResponse } from "@/lib/types";

type SummaryCardProps = {
  section: AsyncSection<SummaryResponse>;
};


function getProviderLabel(section: AsyncSection<SummaryResponse>): string | null {
  if (section.status !== "success" || !section.data) {
    return null;
  }

  if (section.data.meta.is_fallback) {
    return "模板回退";
  }

  const provider = section.data.meta.provider === "dashscope" ? "阿里云千问" : "OpenAI";
  const model = section.data.meta.model ? ` / ${section.data.meta.model}` : "";
  return `${provider}${model}`;
}


export function SummaryCard({ section }: SummaryCardProps) {
  const providerLabel = getProviderLabel(section);

  return (
    <article className="result-card result-card--summary">
      <div className="result-card__header">
        <div>
          <p className="section-tag">Research Thesis</p>
          <h2>Closing Note</h2>
        </div>
        {providerLabel ? (
          <span className={`status-chip ${section.data?.meta.is_fallback ? "status-chip--fallback" : "status-chip--live"}`}>
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
              {section.data.summary.bullish.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="thesis-block">
            <h3>Risk Case</h3>
            <ul className="bullet-list">
              {section.data.summary.bearish.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="thesis-block thesis-block--conclusion">
            <h3>Decision Memo</h3>
            <p className="conclusion-copy">{section.data.summary.conclusion}</p>
          </section>
        </div>
      ) : null}
    </article>
  );
}
