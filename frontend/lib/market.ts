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
      badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-900/5",
      textClassName: "text-slate-900",
    };
  }

  const isChinaMarket = isChinaMarketSymbol(symbol);
  const isPositive = changePercent > 0;

  if (isChinaMarket) {
    return isPositive
      ? {
          badgeClassName: "bg-red-50 text-red-600 ring-1 ring-red-100",
          textClassName: "text-red-600",
        }
      : {
          badgeClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
          textClassName: "text-emerald-600",
        };
  }

  return isPositive
    ? {
        badgeClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
        textClassName: "text-emerald-600",
      }
    : {
        badgeClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
        textClassName: "text-rose-600",
      };
}
