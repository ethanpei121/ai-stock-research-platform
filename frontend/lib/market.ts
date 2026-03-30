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
      badgeClassName: "border border-slate-200 bg-slate-100 text-slate-700",
      textClassName: "text-slate-900",
    };
  }

  const isChinaMarket = isChinaMarketSymbol(symbol);
  const isPositive = changePercent > 0;

  if (isChinaMarket) {
    return isPositive
      ? {
          badgeClassName: "border border-red-100 bg-red-50 text-red-600",
          textClassName: "text-red-600",
        }
      : {
          badgeClassName: "border border-green-100 bg-green-50 text-green-600",
          textClassName: "text-green-600",
        };
  }

  return isPositive
    ? {
        badgeClassName: "border border-green-100 bg-green-50 text-green-600",
        textClassName: "text-green-600",
      }
    : {
        badgeClassName: "border border-red-100 bg-red-50 text-red-600",
        textClassName: "text-red-600",
      };
}
