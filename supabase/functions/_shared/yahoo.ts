import {json,validPrice,type Instrument,type Provider,type Quote} from './providers.ts';
export const yahooEtf:Provider={supports:i=>i.market==='KR'&&i.asset_type==='domestic_etf',ttl:300,async get(i:Instrument):Promise<Quote>{
 if(!/^[A-Z0-9]{6}$/.test(i.symbol))throw new Error('국내 ETF 종목코드 형식을 확인하세요.');
 const symbol=i.symbol+'.KS';
 const data=await json('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d');
 if(data.chart?.error)throw new Error('Yahoo Finance에서 이 ETF 시세를 제공하지 않습니다.');
 const result=data.chart?.result;if(!Array.isArray(result)||result.length!==1)throw new Error('Yahoo Finance ETF 시세가 없습니다.');
 const meta=result[0]?.meta;
 if(meta?.symbol!==symbol||meta.currency!=='KRW'||meta.instrumentType!=='ETF'||!['KSC','KOS'].includes(meta.exchangeName))throw new Error('Yahoo Finance ETF 종목·시장·통화 확인 실패');
 const time=Number(meta.regularMarketTime)*1000;
 if(!Number.isFinite(time)||time<=0||time>Date.now()+60000)throw new Error('Yahoo Finance 시세 기준시각 오류');
 return {symbol:i.symbol,market:'KR',currency:'KRW',current_price:validPrice(meta.regularMarketPrice),updated_at:new Date(time).toISOString(),fetched_at:new Date().toISOString(),source:'Yahoo Finance · 지연 가능 시세',delayed:true};
}};
