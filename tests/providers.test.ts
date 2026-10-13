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
