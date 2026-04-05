const SYMBOL_PATTERN = /^[A-Z0-9.\-^=]{1,10}$/;

export function normalizeSymbolInput(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  if (normalized.endsWith(".HK")) {
    const base = normalized.slice(0, -3);
    if (/^\d+$/.test(base)) {
      const compact = base.replace(/^0+/, "") || "0";
      return `${compact.length <= 4 ? compact.padStart(4, "0") : compact}.HK`;
    }
    return normalized;
  }

  if (!/^\d+$/.test(normalized)) {
    return normalized;
  }

  if (normalized.length === 6) {
    if (normalized.startsWith("0") || normalized.startsWith("3")) {
      return `${normalized}.SZ`;
    }
    if (normalized.startsWith("5") || normalized.startsWith("6") || normalized.startsWith("9")) {
      return `${normalized}.SS`;
    }
    if (normalized.startsWith("4") || normalized.startsWith("8")) {
      return `${normalized}.BJ`;
    }
    return normalized;
  }

  if (normalized.length === 4 || normalized.length === 5) {
    const compact = normalized.replace(/^0+/, "") || "0";
    return `${compact.padStart(4, "0")}.HK`;
  }

  return normalized;
}

export function isValidNormalizedSymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol);
}
