import Decimal from 'decimal.js';
import { Holding, Quote, marketOf, quoteKey } from './types';
Decimal.set({ precision: 40 });
export const decimal = (value: string | number) => new Decimal(value);
export function positive(value: string, label: string) {
  if (!/^\d+(\.\d+)?$/.test(value) || !decimal(value).isFinite() || !decimal(value).gt(0)) throw new Error(label + '는 0보다 큰 숫자로 입력하세요.');
  if ((value.split('.')[1]?.length ?? 0) > 12 || decimal(value).gte('1e18')) throw new Error(label + '의 입력 범위를 확인하세요. 소수점은 12자리까지 지원합니다.');
  return value;
}
export function costBasis(quantity: string, average: string, currency: string, rate: string, original: string) {
  positive(quantity, '보유수량'); positive(average, '평균매입단가');
  if (currency === 'KRW') return decimal(quantity).mul(average).toFixed(12);
  if (original.trim()) { positive(original, '원화 투자원금'); return decimal(original).toFixed(12); }
  positive(rate, '매입 당시 환율');
  return decimal(quantity).mul(average).mul(rate).toFixed(12);
}
export function valueHolding(h: Holding, quotes: Record<string, Quote>) {
  const quote = quotes[quoteKey(marketOf(h.asset_type), h.symbol)];
  const fx = h.purchase_currency === 'USD' ? quotes['FX:USD/KRW'] : undefined;
  const cost = decimal(h.original_investment_krw);
  if (!quote || (h.purchase_currency === 'USD' && !fx)) return { h, cost, value: null, profit: null, percent: null, quote, fx, stockProfit: null, fxProfit: null };
  const currentFx = fx ? decimal(fx.current_price) : decimal(1);
  const value = decimal(quote.current_price).mul(h.quantity).mul(currentFx);
  const profit = value.minus(cost);
  const percent = cost.gt(0) ? profit.div(cost).mul(100) : null;
  const purchaseFx = cost.div(decimal(h.average_purchase_price).mul(h.quantity));
  const stockProfit = decimal(quote.current_price).minus(h.average_purchase_price).mul(h.quantity).mul(purchaseFx);
  const fxProfit = decimal(quote.current_price).mul(h.quantity).mul(currentFx.minus(purchaseFx));
  return { h, cost, value, profit, percent, quote, fx, stockProfit, fxProfit };
}
export type Valuation = ReturnType<typeof valueHolding>;
export function summarize(rows: Valuation[]) {
  const cost = rows.reduce((a, r) => a.plus(r.cost), decimal(0));
  const missing = rows.filter(r => r.value === null).length;
  const knownValue = rows.reduce((a, r) => a.plus(r.value ?? 0), decimal(0));
  const value = missing ? null : knownValue;
  const profit = value?.minus(cost) ?? null;
  return { cost, value, knownValue, profit, missing, percent: profit && cost.gt(0) ? profit.div(cost).mul(100) : null };
}
export function money(value: Decimal | string | null, currency = 'KRW') {
  if (value === null) return '—';
  const fixed = decimal(value.toString()).toFixed(currency === 'KRW' ? 0 : 2);
  const [whole, fraction] = fixed.split('.');
  return (currency === 'KRW' ? '₩' : '$') + whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
}
export const pct = (value: Decimal | null) => value === null ? '—' : (value.gt(0) ? '+' : '') + value.toFixed(2) + '%';
export const signedMoney = (value: Decimal | null) => value === null ? '—' : (value.gt(0) ? '+' : '') + money(value);
