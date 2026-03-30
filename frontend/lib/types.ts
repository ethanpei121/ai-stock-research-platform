export type LoadState = "idle" | "loading" | "success" | "error";
export type RecommendationMode = "preset" | "live";

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

export type RecommendationEvidence = {
  momentum_1m: number | null;
  momentum_3m: number | null;
  volume_ratio: number | null;
  news_count_7d: number;
  analyst_target_upside: number | null;
  analyst_consensus: string | null;
  analyst_opinion_count: number | null;
  revenue_growth: number | null;
  earnings_growth: number | null;
};

export type RecommendationScorecard = {
  prosperity: number;
  valuation: number;
  fund_flow: number;
  catalyst: number;
  total: number;
  label: string;
};

export type RecommendationStock = {
  symbol: string;
  company_name: string;
  market: string;
  region: string;
  rationale: string;
  tags: string[];
  styles: string[];
  scorecard: RecommendationScorecard | null;
  evidence: RecommendationEvidence | null;
  data_sources: string[];
};

export type RecommendationGroup = {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  stocks: RecommendationStock[];
};

export type RecommendationsResponse = {
  mode: RecommendationMode;
  updated_at: string;
  categories: string[];
  style_filters: string[];
  methodology: string;
  data_sources: string[];
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
