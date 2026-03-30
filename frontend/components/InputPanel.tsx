type InputPanelProps = {
  symbol: string;
  apiBase: string;
  isSubmitting: boolean;
  error: string | null;
  onSymbolChange: (value: string) => void;
  onSubmit: () => void;
};


export function InputPanel({
  symbol,
  apiBase,
  isSubmitting,
  error,
  onSymbolChange,
  onSubmit,
}: InputPanelProps) {
  return (
    <section className="input-panel">
      <div className="input-panel__copy">
        <p className="eyebrow">AI Stock Research Platform</p>
        <h1>输入一个股票代码，快速拿到行情、新闻和中文总结。</h1>
        <p className="subtle-copy">
          使用免费行情与新闻源进行演示，适合快速验证 Render + Vercel + Supabase 架构链路。
        </p>
      </div>

      <div className="input-panel__controls">
        <label className="field-label" htmlFor="symbol-input">
          股票代码
        </label>
        <div className="input-row">
          <input
            id="symbol-input"
            className="symbol-input"
            value={symbol}
            maxLength={10}
            placeholder="例如 AAPL"
            onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          <button className="primary-button" type="button" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting ? "分析中..." : "开始分析"}
          </button>
        </div>
        <p className="api-base">API Base: {apiBase}</p>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
