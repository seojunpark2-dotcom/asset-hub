import { AssetType } from './types';
export const catalog: { name: string; symbol: string; type: AssetType }[] = [
  { name: 'NVIDIA', symbol: 'NVDA', type: 'foreign_stock' },
  { name: 'Apple', symbol: 'AAPL', type: 'foreign_stock' },
  { name: 'Microsoft', symbol: 'MSFT', type: 'foreign_stock' },
  { name: 'TIGER 미국S&P500', symbol: '360750', type: 'domestic_etf' },
  { name: 'TIGER 미국나스닥100', symbol: '133690', type: 'domestic_etf' },
  { name: 'KODEX 미국나스닥100', symbol: '379810', type: 'domestic_etf' },
  { name: 'KODEX 미국S&P500', symbol: '379800', type: 'domestic_etf' },
  { name: 'Bitcoin 비트코인', symbol: 'KRW-BTC', type: 'crypto' },
  { name: 'Ethereum 이더리움', symbol: 'KRW-ETH', type: 'crypto' },
  { name: 'XRP 리플', symbol: 'KRW-XRP', type: 'crypto' },
];
