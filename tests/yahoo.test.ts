import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {yahooDomestic} from '../supabase/functions/_shared/yahoo';
import {valueHolding,summarize} from '../src/finance';
import {widgetSnapshot} from '../src/widgetData';
import {yahooQuotes} from '../src/yahooQuotes';
const original=fetch;afterEach(()=>{globalThis.fetch=original;});
const i={symbol:'360750',market:'KR',asset_type:'domestic_etf'};
const meta={symbol:'360750.KS',currency:'KRW',instrumentType:'ETF',exchangeName:'KSC',regularMarketPrice:25000,regularMarketTime:Math.floor(Date.now()/1000)-1200};
function reply(m:unknown){return new Response(JSON.stringify({chart:{result:[{meta:m}],error:null}}));}
test('Yahoo ETF uses exact KOSPI symbol, KRW and actual price time without a key',async()=>{
 globalThis.fetch=async url=>{assert.equal(new URL(String(url)).pathname,'/v8/finance/chart/360750.KS');return reply(meta);};
 const q=await yahooDomestic.get(i);assert.equal(q.current_price,'25000');assert.equal(q.symbol,'360750');assert.equal(q.updated_at,new Date(meta.regularMarketTime*1000).toISOString());assert.equal(q.delayed,true);
});
test('mobile Yahoo cache avoids repeat calls and failure retains only stale real prices',async()=>{
 let count=0;globalThis.fetch=async()=>{count++;return reply(meta);};const first=await yahooQuotes([i]);assert.equal(count,1);
 await yahooQuotes([i],first.quotes);assert.equal(count,1);
 globalThis.fetch=async()=>new Response('blocked',{status:429});const failed=await yahooQuotes([i],{'KR:360750':{...first.quotes['KR:360750']!,fetched_at:new Date(Date.now()-360000).toISOString()}});assert.equal(failed.quotes['KR:360750']?.current_price,'25000');assert.equal(failed.quotes['KR:360750']?.stale,true);assert.match(failed.errors['KR:360750']!,/429/);
 const empty=await yahooQuotes([i]);assert.equal(Object.keys(empty.quotes).length,0);
});
test('Yahoo rejects wrong currency, wrong ticker, non ETF, bad prices and timestamps',async()=>{
 for(const change of [{symbol:'SPY'},{currency:'USD'},{instrumentType:'EQUITY'},{exchangeName:'NYQ'},{regularMarketPrice:0},{regularMarketPrice:null},{regularMarketTime:NaN},{regularMarketTime:Date.now()/1000+3600}]){globalThis.fetch=async()=>reply({...meta,...change});await assert.rejects(()=>yahooDomestic.get(i));}
 globalThis.fetch=async()=>new Response('blocked', {status:429});await assert.rejects(()=>yahooDomestic.get(i),/HTTP 429/);
 globalThis.fetch=async()=>new Response(JSON.stringify({chart:{result:null,error:{description:'unknown'}}}));await assert.rejects(()=>yahooDomestic.get(i),/제공하지/);
});
test('domestic stocks select validated KOSPI or KOSDAQ and never use stale wrong-type KS data',async()=>{
 const stock={symbol:'247540',market:'KR',asset_type:'domestic_stock'};const calls:string[]=[];
 globalThis.fetch=async url=>{const symbol=new URL(String(url)).pathname.split('/').pop()!;calls.push(symbol);return reply({...meta,symbol,instrumentType:symbol.endsWith('.KS')?'MUTUALFUND':'EQUITY',exchangeName:'KOE',regularMarketPrice:symbol.endsWith('.KS')?194000:115600});};
 const q=await yahooDomestic.get(stock);assert.deepEqual(calls,['247540.KS','247540.KQ']);assert.equal(q.current_price,'115600');assert.match(q.source,/코스닥/);
 globalThis.fetch=async()=>reply({...meta,symbol:'005930.KS',instrumentType:'EQUITY'});assert.match((await yahooDomestic.get({...stock,symbol:'005930'})).source,/코스피/);
 let count=0;globalThis.fetch=async()=>{count++;return new Response('limited',{status:429});};await assert.rejects(()=>yahooDomestic.get(stock),/429/);assert.equal(count,1);
 globalThis.fetch=async url=>String(url).includes('.KS')?new Response('{}',{status:404}):reply({...meta,symbol:'247540.KQ',instrumentType:'EQUITY',exchangeName:'KOE'});assert.match((await yahooDomestic.get(stock)).source,/코스닥/);
});
test('Yahoo price changes propagate to valuation, profit and weighted returns',async()=>{
 const h={id:'x',user_id:'u',institution:'키움증권',asset_type:'domestic_etf' as const,symbol:'360750',name:'TIGER 미국S&P500',quantity:'10',average_purchase_price:'20000',purchase_currency:'KRW' as const,original_investment_krw:'200000',purchase_exchange_rate:null};
 globalThis.fetch=async()=>reply(meta);const q=await yahooDomestic.get(i);const v=valueHolding(h,{'KR:360750':{...q,market:'KR',currency:'KRW'}});const total=summarize([v]);assert.equal(v.value?.toString(),'250000');assert.equal(v.profit?.toString(),'50000');assert.equal(v.percent?.toString(),'25');assert.equal(total.percent?.toString(),'25');
 assert.equal(widgetSnapshot([v],'kr').totalPercent,'+25.00%');
 globalThis.fetch=async()=>reply({...meta,regularMarketPrice:18000});const next=valueHolding(h,{'KR:360750':{...await yahooDomestic.get(i),market:'KR',currency:'KRW'}});assert.equal(next.profit?.toString(),'-20000');assert.equal(next.percent?.toString(),'-10');assert.equal(widgetSnapshot([next],'kr').totalPercent,'-10.00%');
});
