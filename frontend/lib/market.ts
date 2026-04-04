export function isChinaMarketSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return /^\d{6}$/.test(normalized) || /\.(SZ|SS|SH)$/.test(normalized);
}

type ChangeTone = {
  badgeClassName: string;
  textClassName: string;
};

export function getChangeTone(symbol: string, changePercent: number): ChangeTone {
  if (!Number.isFinite(changePercent) || changePercent === 0) {
    return {
      badgeClassName: "rounded-md bg-terminal-card px-2 py-0.5 text-terminal-muted border border-terminal-border",
      textClassName: "text-terminal-text",
    };
  }

  const isChinaMarket = isChinaMarketSymbol(symbol);
  const isPositive = changePercent > 0;

  if (isChinaMarket) {
    // A-share: red = gain, green = loss
    return isPositive
      ? {
          badgeClassName: "rounded-md bg-loss-bg px-2 py-0.5 text-loss border border-loss-border",
          textClassName: "text-loss",
        }
      : {
          badgeClassName: "rounded-md bg-gain-bg px-2 py-0.5 text-gain border border-gain-border",
          textClassName: "text-gain",
        };
  }

  // US/international: green = gain, red = loss
  return isPositive
    ? {
        badgeClassName: "rounded-md bg-gain-bg px-2 py-0.5 text-gain border border-gain-border",
        textClassName: "text-gain",
      }
    : {
        badgeClassName: "rounded-md bg-loss-bg px-2 py-0.5 text-loss border border-loss-border",
        textClassName: "text-loss",
      };
}
