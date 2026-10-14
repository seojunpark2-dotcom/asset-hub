import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {yahooUS} from '../supabase/functions/_shared/yahoo';
import {yahooQuotes} from '../src/yahooQuotes';
import {valueHolding,summarize} from '../src/finance';
import {widgetSnapshot} from '../src/widgetData';
const original=fetch;afterEach(()=>{globalThis.fetch=original;});
const meta={symbol:'AAPL',currency:'USD',instrumentType:'EQUITY',exchangeName:'NMS',regularMarketPrice:110,regularMarketTime:Math.floor(Date.now()/1000)-10};
const reply=(m:unknown)=>new Response(JSON.stringify({chart:{result:[{meta:m}],error:null}}));
test('US equities and ETFs retain USD price and normalized class ticker without a key',async()=>{
 for(const [input,ticker,kind,exchange] of [['AAPL','AAPL','foreign_stock','NMS'],['VOO','VOO','foreign_etf','PCX'],['BRK.B','BRK-B','foreign_stock','NYQ']]){
  globalThis.fetch=async url=>{assert.equal(new URL(String(url)).pathname,'/v8/finance/chart/'+ticker);return reply({...meta,symbol:ticker,instrumentType:kind==='foreign_etf'?'ETF':'EQUITY',exchangeName:exchange});};
  const q=await yahooUS.get({symbol:input!,market:'US',asset_type:kind!});assert.equal(q.symbol,input);assert.equal(q.currency,'USD');assert.equal(q.market,'US');assert.equal(q.current_price,'110');
 }
});
test('US lookup rejects non-US listing, wrong currency, wrong asset and malformed price',async()=>{
 for(const change of [{currency:'KRW'},{symbol:'MSFT'},{exchangeName:'LSE'},{instrumentType:'ETF'},{regularMarketPrice:0},{regularMarketTime:0}]){
  globalThis.fetch=async()=>reply({...meta,...change});await assert.rejects(()=>yahooUS.get({symbol:'AAPL',market:'US',asset_type:'foreign_stock'}));
 }
});
test('Yahoo USD prices and FX update KRW valuation, weighted return and widget',async()=>{
 for(const type of ['foreign_stock','foreign_etf'] as const){
  const symbol=type==='foreign_stock'?'AAPL':'VOO';globalThis.fetch=async()=>reply({...meta,symbol,instrumentType:type==='foreign_stock'?'EQUITY':'ETF',exchangeName:type==='foreign_stock'?'NMS':'PCX'});
  const data=await yahooQuotes([{symbol,market:'US',asset_type:type}]);const q=data.quotes['US:'+symbol]!;assert.ok(q);
  const h={id:'one',user_id:'user',institution:'미래에셋증권',asset_type:type,symbol,name:symbol,quantity:'2',average_purchase_price:'100',purchase_currency:'USD' as const,purchase_exchange_rate:'1000',original_investment_krw:'200000'};
  const fx={...q,symbol:'USD/KRW',market:'FX' as const,currency:'KRW' as const,current_price:'1300'};const v=valueHolding(h,{...data.quotes,'FX:USD/KRW':fx});
  assert.equal(v.value?.toString(),'286000');assert.equal(v.profit?.toString(),'86000');assert.equal(summarize([v]).percent?.toString(),'43');assert.equal(widgetSnapshot([v],'kr').totalPercent,'+43.00%');
 }
});
