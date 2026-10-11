import { supabase } from './supabase';
import { Holding, Quote, Settings, quoteKey } from './types';
import { secureStorage } from './storage';
import { positive } from './finance';
const db = () => { if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.'); return supabase; };
export function normalizeHolding(row: Record<string, unknown>): Holding {
  const h = { ...row };
  for (const field of ['quantity', 'average_purchase_price', 'original_investment_krw', 'purchase_exchange_rate']) {
    if (h[field] != null) h[field] = String(h[field]);
  }
  return h as unknown as Holding;
}
export async function loadHoldings(userId: string) {
  const { data, error } = await db().from('portfolio_holdings_read').select('*').eq('user_id', userId).order('created_at');
  if (error) throw error;
  const holdings = (data ?? []).map(normalizeHolding);
  await secureStorage.setItem('portfolio-' + userId, JSON.stringify(holdings));
  return holdings;
}
export async function cachedHoldings(userId: string): Promise<Holding[]> {
  const cached = await secureStorage.getItem('portfolio-' + userId);
  return cached ? JSON.parse(cached) : [];
}
export async function saveHolding(h: Omit<Holding, 'id'> & { id?: string }) {
  const { error } = h.id ? await db().from('portfolio_holdings').update(h).eq('id', h.id).eq('user_id', h.user_id)
    : await db().from('portfolio_holdings').insert(h);
  if (error) throw error;
}
export async function deleteHolding(h: Holding) {
  const { error } = await db().from('portfolio_holdings').delete().eq('id', h.id).eq('user_id', h.user_id);
  if (error) throw error;
}
export async function getQuotes(): Promise<{ quotes: Record<string, Quote>; errors: Record<string, string> }> {
  const { data, error } = await db().functions.invoke('portfolio-quotes', { body: {} });
  if (error) throw new Error('시세 서버에 연결하지 못했습니다. 마지막 정상 시세를 표시합니다.');
  const quotes: Record<string, Quote> = {};
  for (const q of (data.quotes ?? []) as Quote[]) {
    try { positive(String(q.current_price), '현재가격'); quotes[quoteKey(q.market, q.symbol)] = { ...q, current_price: String(q.current_price) }; } catch { /* invalid upstream values are excluded */ }
  }
  return { quotes, errors: data.errors ?? {} };
}
export async function loadSettings(userId: string): Promise<Settings | null> {
  const { data, error } = await db().from('portfolio_profiles').select('settings').eq('user_id', userId).maybeSingle();
  if(error){const cached=await secureStorage.getItem('settings-'+userId);if(cached)return JSON.parse(cached) as Settings;throw error;}
  if(data?.settings)await secureStorage.setItem('settings-'+userId,JSON.stringify(data.settings));
  return data?.settings ?? null;
}
export async function saveSettings(userId: string, settings: Settings) {
  const { error } = await db().from('portfolio_profiles').upsert({ user_id: userId, settings });
  if (error) throw error;
  await secureStorage.setItem('settings-'+userId,JSON.stringify(settings));
}
export const cacheQuotes = (userId: string, quotes: Record<string, Quote>) => secureStorage.setItem('quotes-' + userId, JSON.stringify(quotes));
export async function readQuotes(userId: string): Promise<Record<string, Quote>> {
  const saved = await secureStorage.getItem('quotes-' + userId);
  if (!saved) return {};
  return Object.fromEntries(Object.entries(JSON.parse(saved) as Record<string, Quote>).map(([k, q]) => [k, { ...q, stale: true }]));
}
export async function clearCache(userId: string) {
  await secureStorage.removeItem('portfolio-' + userId); await secureStorage.removeItem('quotes-' + userId); await secureStorage.removeItem('settings-'+userId);
}

export const cacheSettings=(userId:string,settings:Settings)=>secureStorage.setItem('settings-'+userId,JSON.stringify(settings));
