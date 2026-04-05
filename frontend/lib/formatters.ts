export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1e12) {
    return `${(value / 1e12).toFixed(maximumFractionDigits)}万亿`;
  }
  if (absoluteValue >= 1e8) {
    return `${(value / 1e8).toFixed(maximumFractionDigits)}亿`;
  }
  if (absoluteValue >= 1e4) {
    return `${(value / 1e4).toFixed(maximumFractionDigits)}万`;
  }

  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits,
  }).format(value);
}

export function formatMetricNumber(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits,
  }).format(value);
}

export function formatMetricPercent(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(maximumFractionDigits)}%`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < -5 * 60 * 1000) {
    return formatDateTime(value);
  }

  const safeDiffMs = Math.max(diffMs, 0);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (safeDiffMs < minuteMs) {
    return "刚刚";
  }
  if (safeDiffMs < hourMs) {
    return `${Math.floor(safeDiffMs / minuteMs)}分钟前`;
  }
  if (safeDiffMs < dayMs) {
    return `${Math.floor(safeDiffMs / hourMs)}小时前`;
  }
  if (safeDiffMs < 7 * dayMs) {
    return `${Math.floor(safeDiffMs / dayMs)}天前`;
  }

  return formatDateTime(value);
}
