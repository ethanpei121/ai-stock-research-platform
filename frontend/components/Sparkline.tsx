type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  className?: string;
};

export function Sparkline({
  data,
  width = 80,
  height = 28,
  positive = true,
  className = "",
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          opacity={0.2}
        />
      </svg>
    );
  }

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const pathData = points.map((point, i) => `${i === 0 ? "M" : "L"}${point}`).join(" ");

  const gradientId = `sparkline-gradient-${positive ? "up" : "down"}`;
  const fillPoints = [...points, `${padding + chartWidth},${height}`, `${padding},${height}`].join(" ");

  const strokeColor = positive ? "#10b981" : "#ef4444";
  const fillStartColor = positive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
  const fillEndColor = "rgba(0,0,0,0)";

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStartColor} />
          <stop offset="100%" stopColor={fillEndColor} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradientId})`} />
      <path d={pathData} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


/** Generate simple mock sparkline data for a price trend */
export function generateSparklineData(seed: string, points: number = 12): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }

  const data: number[] = [];
  let value = 100 + (hash % 50);

  for (let i = 0; i < points; i++) {
    hash = ((hash << 5) - hash + i * 7 + 13) | 0;
    const change = ((hash % 11) - 5) * 0.8;
    value = Math.max(50, value + change);
    data.push(value);
  }

  return data;
}
