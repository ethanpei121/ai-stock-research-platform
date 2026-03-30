export type LoadState = "idle" | "loading" | "success" | "error";

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  currency: string;
  market_time: string;
};

export type NewsItem = {
  title: string;
  url: string;
  published_at: string;
  source: string;
};

export type NewsResponse = {
  symbol: string;
  count: number;
  items: NewsItem[];
};

export type SummaryResponse = {
  symbol: string;
  generated_at: string;
  summary: {
    bullish: string[];
    bearish: string[];
    conclusion: string;
  };
  data_points: {
    price: number;
    change_percent: number;
    news_count: number;
  };
};

export type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export type AsyncSection<T> = {
  status: LoadState;
  data: T | null;
  error: string | null;
};
