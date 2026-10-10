export type AssetType = 'domestic_stock' | 'foreign_stock' | 'domestic_etf' | 'foreign_etf' | 'crypto';
export type Currency = 'KRW' | 'USD';
export type Market = 'KR' | 'US' | 'UPBIT' | 'FX';
export interface Holding {
  id: string; user_id: string; institution: string; asset_type: AssetType;
  symbol: string; name: string; quantity: string; average_purchase_price: string;
  purchase_currency: Currency; purchase_exchange_rate: string | null;
  original_investment_krw: string; created_at?: string; updated_at?: string;
}
export interface Quote {
  symbol: string; market: Market; currency: Currency; current_price: string;
  updated_at: string; fetched_at: string; source: string;
  delayed: boolean; stale?: boolean; error?: string;
}
export interface Settings { dark: boolean; interval: number; colors: 'kr' | 'global'; apiExpiry?: {date:string;enabled:boolean}; }
export const assetLabels: Record<AssetType, string> = {
  domestic_stock: '국내주식', foreign_stock: '미국주식', domestic_etf: '국내상장 ETF', foreign_etf: '미국상장 ETF', crypto: '암호화폐',
};
export const institutions = ['미래에셋증권', '키움증권', '업비트', '기타 증권사', '기타 거래소'];
export const marketOf = (type: AssetType): Market => type === 'crypto' ? 'UPBIT' : type.startsWith('domestic') ? 'KR' : 'US';
export const quoteKey = (market: Market, symbol: string) => market + ':' + symbol;
