import {json,validPrice,ProviderHttpError,type Instrument,type Provider,type Quote} from './providers.ts';
export const yahooDomestic:Provider={supports:i=>i.market==='KR'&&['domestic_etf','domestic_stock'].includes(i.asset_type??''),ttl:300,async get(i:Instrument):Promise<Quote>{
 if(!this.supports(i)||!/^[A-Z0-9]{6}$/.test(i.symbol))throw new Error('국내 종목코드·자산 종류를 확인하세요.');
 const etf=i.asset_type==='domestic_etf';
 for(const suffix of etf?['KS']:['KS','KQ']){
  const symbol=i.symbol+'.'+suffix;let data;
  try{data=await json('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d');}
  catch(e){if(!etf&&suffix==='KS'&&e instanceof ProviderHttpError&&e.status===404)continue;throw e;}
  if(data.chart?.error){if(!etf&&suffix==='KS'&&data.chart.error.code==='Not Found')continue;throw new Error('Yahoo Finance에서 이 종목 시세를 제공하지 않습니다.');}
  const result=data.chart?.result;if(!Array.isArray(result)||result.length!==1)throw new Error('Yahoo Finance 종목 시세가 없습니다.');
  const meta=result[0]?.meta;
  if(meta?.symbol!==symbol||meta.currency!=='KRW')throw new Error('Yahoo Finance 종목·통화 확인 실패');
  const exchanges=suffix==='KS'?['KSC','KOS']:['KOE','KQ'];
  if(meta.instrumentType!==(etf?'ETF':'EQUITY')||!exchanges.includes(meta.exchangeName)){
   if(!etf&&suffix==='KS')continue;
   throw new Error('Yahoo Finance 자산 종류·거래소 확인 실패');
  }
  const time=Number(meta.regularMarketTime)*1000;
  if(!Number.isFinite(time)||time<=0||time>Date.now()+60000)throw new Error('Yahoo Finance 시세 기준시각 오류');
  return {symbol:i.symbol,market:'KR',currency:'KRW',current_price:validPrice(meta.regularMarketPrice),updated_at:new Date(time).toISOString(),fetched_at:new Date().toISOString(),source:'Yahoo Finance · '+(suffix==='KS'?'코스피':'코스닥')+' · 지연 가능 시세',delayed:true};
 }
 throw new Error('Yahoo Finance에서 해당 국내주식 시세를 확인할 수 없습니다.');
}};
export const yahooUS:Provider={supports:i=>i.market==='US'&&['foreign_stock','foreign_etf'].includes(i.asset_type??''),ttl:300,async get(i:Instrument):Promise<Quote>{
 if(!this.supports(i)||!/^[A-Z][A-Z0-9.-]{0,14}$/.test(i.symbol))throw new Error('미국 종목 티커·자산 종류를 확인하세요.');
 const symbol=i.symbol.replaceAll('.','-');
 const data=await json('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d');
 if(data.chart?.error)throw new Error('Yahoo Finance에서 이 미국 종목을 제공하지 않습니다.');
 const result=data.chart?.result;if(!Array.isArray(result)||result.length!==1)throw new Error('Yahoo Finance 미국 시세가 없습니다.');
 const meta=result[0]?.meta;
 if(meta?.symbol!==symbol||meta.currency!=='USD'||meta.instrumentType!==(i.asset_type==='foreign_etf'?'ETF':'EQUITY')||!['NMS','NGM','NCM','NYQ','PCX','ASE','BTS','BATS'].includes(meta.exchangeName))throw new Error('Yahoo Finance 미국 종목·통화·자산 종류·거래소 확인 실패');
 const time=Number(meta.regularMarketTime)*1000;
 if(!Number.isFinite(time)||time<=0||time>Date.now()+60000)throw new Error('Yahoo Finance 시세 기준시각 오류');
 return {symbol:i.symbol,market:'US',currency:'USD',current_price:validPrice(meta.regularMarketPrice),updated_at:new Date(time).toISOString(),fetched_at:new Date().toISOString(),source:'Yahoo Finance · 미국 정규장 가격 · 지연 가능 시세',delayed:true};
}};
