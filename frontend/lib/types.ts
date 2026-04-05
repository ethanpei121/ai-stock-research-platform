export type LoadState = "idle" | "loading" | "success" | "error";
export type RecommendationMode = "preset" | "live";
export type ResearchStatus = "待研究" | "持续跟踪" | "观察结束";

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

export type AnnouncementItem = {
  title: string;
  url: string;
  published_at: string;
  source: string;
  category: string | null;
};

export type AnnouncementsResponse = {
  symbol: string;
  count: number;
  items: AnnouncementItem[];
  providers: string[];
};

export type FundamentalsResponse = {
  symbol: string;
  as_of: string;
  providers: string[];
  company_name: string | null;
  industry: string | null;
  listed_date: string | null;
  market_cap: number | null;
  float_market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  roe: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  debt_to_asset: number | null;
  revenue_growth: number | null;
  net_profit_growth: number | null;
  source_note: string | null;
};

export type CompareStockResponse = {
  symbol: string;
  company_name: string | null;
  quote: Quote;
  fundamentals: FundamentalsResponse | null;
  news_count: number;
  latest_news_time: string | null;
  announcement_count: number;
  latest_announcement_time: string | null;
  highlights: string[];
  data_sources: string[];
};

export type CompareResponse = {
  generated_at: string;
  items: CompareStockResponse[];
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
    force_refresh_used: boolean;
    quote_provider: string | null;
    quote_market_time: string | null;
    latest_news_time: string | null;
    news_providers: string[];
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

export type WatchlistItem = {
  symbol: string;
  company_name: string;
  market: string | null;
  region: string | null;
  tags: string[];
  status: ResearchStatus;
  added_at: string;
  updated_at: string;
};

export type RecentViewedItem = {
  symbol: string;
  company_name: string;
  viewed_at: string;
};

export type WatchlistResponse = {
  client_id: string;
  count: number;
  items: WatchlistItem[];
};

export type RecentViewsResponse = {
  client_id: string;
  count: number;
  items: RecentViewedItem[];
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
