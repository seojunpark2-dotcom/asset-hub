export interface Quote {
  symbol: string; market: string; currency: string; current_price: string;
  updated_at: string; fetched_at: string; source: string; delayed: boolean;
  stale?: boolean; error?: string;
}
export interface Instrument { symbol: string; market: string; asset_type?: string; }
export interface Provider { supports(i: Instrument): boolean; ttl: number; get(i: Instrument): Promise<Quote>; }
export type Secrets = (name: string) => string | undefined;
export async function json(url: string, headers: Record<string,string> = {}) {
  let response: Response;
  try { response = await fetch(url, {headers,signal:AbortSignal.timeout(12000)}); }
  catch { throw new Error('공급자 연결 또는 응답시간 오류'); }
  if(!response.ok) throw new ProviderHttpError(response.status);
  try { return await response.json(); }
  catch { throw new Error('공급자 응답 형식 오류 (HTTP '+response.status+')'); }
}
export class ProviderHttpError extends Error {constructor(public readonly status:number){super('공급자 응답 오류 (HTTP '+status+')');}}
export function validPrice(value: unknown): string {
  const s=String(value);
  if(!/^\d+(\.\d+)?$/.test(s)||!Number.isFinite(Number(s))||Number(s)<=0)throw new Error('유효한 시세가 없습니다.');
  return s;
}
function quote(i: Instrument, price: unknown, time: string, source: string, delayed: boolean, currency='KRW'): Quote {
  if(!Number.isFinite(Date.parse(time))||Date.parse(time)>Date.now()+60000)throw new Error('시세 기준시각 오류');
  return {symbol:i.symbol,market:i.market,currency,current_price:validPrice(price),updated_at:new Date(time).toISOString(),fetched_at:new Date().toISOString(),source,delayed};
}
export function providers(env: Secrets): Provider[] {
  return [
    { supports:i=>i.market==='UPBIT',ttl:60,async get(i){
      if(!/^KRW-[A-Z0-9]{2,15}$/.test(i.symbol))throw new Error('지원하지 않는 업비트 마켓');
      const data=await json('https://api.upbit.com/v1/ticker?markets='+encodeURIComponent(i.symbol));
      const item=data.find((r:{market:string})=>r.market===i.symbol);
      if(!item)throw new Error('업비트 종목을 찾을 수 없습니다.');
      return quote(i,item.trade_price,new Date(item.trade_timestamp).toISOString(),'Upbit',false);
    }},
    { supports:i=>i.market==='FX',ttl:21600,async get(i){
      const data=await json('https://api.frankfurter.dev/v2/rate/USD/KRW');
      if(data.base!=='USD'||data.quote!=='KRW')throw new Error('환율 통화 오류');
      return quote(i,data.rate,data.date+'T00:00:00Z','Frankfurter · 일별 기준환율',true);
    }},
    { supports:i=>i.market==='US',ttl:60,async get(i){
      const key=env('FINNHUB_API_KEY');
      if(!key)throw new Error('미국주식 시세 키를 서버에 설정하세요.');
      const data=await json('https://finnhub.io/api/v1/quote?symbol='+encodeURIComponent(i.symbol),{'X-Finnhub-Token':key});
      if(!data.t)throw new Error('미국주식 시세를 확인할 수 없습니다.');
      return quote(i,data.c,new Date(data.t*1000).toISOString(),'Finnhub · 최근 거래가격',true,'USD');
    }},
  ];
}
