export type LoadState = "idle" | "loading" | "success" | "error";

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  currency: string;
  market_time: string;
  provider: string;
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
  providers: string[];
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
  meta: {
    provider: string;
    model: string | null;
    is_fallback: boolean;
  };
};

export type RecommendationStock = {
  symbol: string;
  company_name: string;
  market: string;
  region: string;
  rationale: string;
  tags: string[];
};

export type RecommendationGroup = {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  stocks: RecommendationStock[];
};

export type RecommendationsResponse = {
  updated_at: string;
  categories: string[];
  groups: RecommendationGroup[];
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
