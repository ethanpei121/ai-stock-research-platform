import type { AsyncSection, SummaryResponse } from "@/lib/types";

type SummaryCardProps = {
  section: AsyncSection<SummaryResponse>;
};


export function SummaryCard({ section }: SummaryCardProps) {
  return (
    <article className="result-card summary-card">
      <div className="result-card__header">
        <div>
          <p className="section-tag">AI 总结</p>
          <h2>中文观点</h2>
        </div>
      </div>

      {section.status === "idle" ? <p className="empty-copy">分析完成后，这里会生成利好、风险和结论。</p> : null}
      {section.status === "loading" ? <p className="loading-copy">正在生成中文总结...</p> : null}
      {section.status === "error" ? <p className="error-copy">{section.error}</p> : null}

      {section.status === "success" && section.data ? (
        <div className="summary-layout">
          <section>
            <h3>利好</h3>
            <ul className="bullet-list">
              {section.data.summary.bullish.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3>风险</h3>
            <ul className="bullet-list">
              {section.data.summary.bearish.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3>结论</h3>
            <p className="conclusion-copy">{section.data.summary.conclusion}</p>
          </section>
        </div>
      ) : null}
    </article>
  );
}
