import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {providers,validPrice} from '../supabase/functions/_shared/providers';
const original=globalThis.fetch;
afterEach(()=>{globalThis.fetch=original;});
test('Upbit provider selects exact market and retains price timestamp',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify([{market:'KRW-BTC',trade_price:150000000,trade_timestamp:Date.now()-1000}]));
 const p=providers(()=>undefined).find(p=>p.supports({symbol:'KRW-BTC',market:'UPBIT'}))!;
 const q=await p.get({symbol:'KRW-BTC',market:'UPBIT'});assert.equal(q.current_price,'150000000');assert.equal(q.source,'Upbit');assert.ok(q.updated_at);
});
test('missing US key returns explicit configuration failure',async()=>{
 const p=providers(()=>undefined).find(p=>p.supports({symbol:'NVDA',market:'US'}))!;
 await assert.rejects(()=>p.get({symbol:'NVDA',market:'US'}),/키/);
});
test('domestic ETF uses KRX ETF endpoint, selects exact symbol and latest close',async()=>{
 globalThis.fetch=async(url)=>{
  assert.match(String(url),/GetSecuritiesProductInfoService\/getETFPriceInfo/);
  return new Response(JSON.stringify({response:{header:{resultCode:'00'},body:{items:{item:[
   {srtnCd:'360750',clpr:'21000',basDt:'20261008'},{srtnCd:'360750',clpr:'22000',basDt:'20261009'},{srtnCd:'360751',clpr:'99999',basDt:'20261009'}
  ]}}}}));
 };
 const p=providers(()=> 'fixture-key').find(p=>p.supports({symbol:'360750',market:'KR'}))!;
 const q=await p.get({symbol:'360750',market:'KR',asset_type:'domestic_etf'});assert.equal(q.current_price,'22000');assert.equal(q.updated_at,'2026-10-09T06:30:00.000Z');assert.equal(q.delayed,true);
});
test('provider failures and non-positive prices never produce fabricated quotes',async()=>{
 globalThis.fetch=async()=>new Response('unavailable',{status:429});
 const p=providers(()=>undefined).find(p=>p.supports({symbol:'KRW-BTC',market:'UPBIT'}))!;
 await assert.rejects(()=>p.get({symbol:'KRW-BTC',market:'UPBIT'}));
 for(const value of [0,-1,NaN,'not-price'])assert.throws(()=>validPrice(value));
});
test('Frankfurter daily reference rate validates the currency pair',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({base:'USD',quote:'EUR',rate:1,date:'2026-10-09'}));
 const p=providers(()=>undefined).find(p=>p.supports({symbol:'USD/KRW',market:'FX'}))!;
 await assert.rejects(()=>p.get({symbol:'USD/KRW',market:'FX'}),/통화/);
});

test('gateway errors expose only known codes and never credentials or response bodies',async()=>{
 globalThis.fetch=async()=>new Response('<error>SERVICE_KEY_IS_NOT_REGISTERED_ERROR secret-fixture-key https://example.com?serviceKey=secret-fixture-key</error>',{status:401});
 const p=providers(()=> 'secret-fixture-key').find(p=>p.supports({symbol:'360750',market:'KR'}))!;
 await assert.rejects(()=>p.get({symbol:'360750',market:'KR',asset_type:'domestic_etf'}),(e:Error)=>{
  assert.match(e.message,/SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);assert.match(e.message,/401/);assert.doesNotMatch(e.message,/secret-fixture-key|example.com/);return true;
 });
});
test('domestic provider accepts encoded or decoded portal keys without double encoding',async()=>{
 for(const stored of [' fixture+/= ', 'fixture%2B%2F%3D']){
  globalThis.fetch=async(url)=>{
   assert.equal(new URL(String(url)).searchParams.get('serviceKey'),'fixture+/=');
   return new Response(JSON.stringify({response:{header:{resultCode:'00'},body:{items:{item:[{srtnCd:'360750',clpr:'22000',basDt:'20261009'}]}}}}));
  };
  const p=providers(()=>stored).find(p=>p.supports({symbol:'360750',market:'KR'}))!;
  assert.equal((await p.get({symbol:'360750',market:'KR',asset_type:'domestic_etf'})).current_price,'22000');
 }
});