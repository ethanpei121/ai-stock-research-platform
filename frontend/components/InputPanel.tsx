type InputPanelProps = {
  symbol: string;
  activeSymbol: string;
  apiBase: string;
  isSubmitting: boolean;
  error: string | null;
  summarySourceLabel: string | null;
  onSymbolChange: (value: string) => void;
  onSubmit: () => void;
};


export function InputPanel({
  symbol,
  activeSymbol,
  apiBase,
  isSubmitting,
  error,
  summarySourceLabel,
  onSymbolChange,
  onSubmit,
}: InputPanelProps) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__headline">
        <div className="masthead-copy">
          <p className="eyebrow">Research Desk / Live Memo</p>
          <h1>AI Stock Research Platform</h1>
          <p className="hero-copy">
            用一页研究简报的方式看一只股票，而不是一个千篇一律的 AI 面板。支持美股代码，也兼容像 300750、600519 这样的 A 股输入；页面会同时组织行情、事件和结论，适合演示也适合继续往真实产品迭代。
          </p>
        </div>

        <aside className="focus-panel">
          <span className="focus-panel__label">Current Focus</span>
          <strong>{activeSymbol}</strong>
          <p>{summarySourceLabel ?? "首屏会自动分析默认股票，并同步最新研究结果。"}</p>
        </aside>
      </div>

      <div className="control-deck">
        <div className="control-deck__left">
          <label className="field-label" htmlFor="symbol-input">
            输入股票代码
          </label>
          <div className="input-row">
            <input
              id="symbol-input"
              className="symbol-input"
              value={symbol}
              maxLength={10}
              placeholder="例如 AAPL 或 300750"
              onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
            <button className="primary-button" type="button" disabled={isSubmitting} onClick={onSubmit}>
              {isSubmitting ? "更新中..." : "重新分析"}
            </button>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </div>

        <div className="control-deck__right">
          <div className="signal-chip">
            <span>数据源</span>
            <strong>yfinance + Render API</strong>
          </div>
          <div className="signal-chip">
            <span>摘要引擎</span>
            <strong>{summarySourceLabel ?? "等待模型返回"}</strong>
          </div>
          <div className="signal-chip signal-chip--wide">
            <span>API Base</span>
            <strong>{apiBase}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

