import {test} from 'node:test';
import assert from 'node:assert/strict';
import {costBasis,valueHolding,summarize,positive} from '../src/finance';
import type {Holding,Quote} from '../src/types';
const h:Holding={id:'a',user_id:'u',institution:'미래에셋증권',asset_type:'foreign_stock',symbol:'NVDA',name:'NVIDIA',quantity:'10',average_purchase_price:'170',purchase_currency:'USD',purchase_exchange_rate:'1380',original_investment_krw:'2346000'};
const q:Quote={symbol:'NVDA',market:'US',currency:'USD',current_price:'190',updated_at:'2026-10-09T20:00:00Z',fetched_at:'2026-10-10T00:00:00Z',source:'test fixture',delayed:true};
const fx:Quote={...q,symbol:'USD/KRW',market:'FX',currency:'KRW',current_price:'1420'};
test('USD holdings include FX gain and exact additive decomposition',()=>{
 const v=valueHolding(h,{'US:NVDA':q,'FX:USD/KRW':fx});
 assert.equal(v.value?.toString(),'2698000');assert.equal(v.profit?.toString(),'352000');
 assert.equal(v.stockProfit?.toString(),'276000');assert.equal(v.fxProfit?.toString(),'76000');
 assert.equal(v.stockProfit?.plus(v.fxProfit!).toString(),v.profit?.toString());
});
test('fractional crypto math uses decimals',()=>{
 assert.equal(costBasis('0.00000001','123456789','KRW','',''),'1.234567890000');
 const btc={...h,asset_type:'crypto' as const,symbol:'KRW-BTC',quantity:'0.05',average_purchase_price:'140000000',purchase_currency:'KRW' as const,original_investment_krw:'7000000'};
 const v=valueHolding(btc,{'UPBIT:KRW-BTC':{...q,market:'UPBIT',symbol:'KRW-BTC',currency:'KRW',current_price:'150000000'}});
 assert.equal(v.value?.toString(),'7500000');assert.equal(v.profit?.toString(),'500000');
});
test('explicit original KRW cost takes precedence over purchase FX',()=>{
 assert.equal(costBasis('10','170','USD','1380','2500000'),'2500000.000000000000');
});
test('missing quote or FX prevents misleading whole portfolio return',()=>{
 assert.equal(valueHolding(h,{'US:NVDA':q}).value,null);
 const complete=valueHolding(h,{'US:NVDA':q,'FX:USD/KRW':fx});const missing=valueHolding({...h,id:'b',symbol:'AAPL'},{'FX:USD/KRW':fx});
 const s=summarize([complete,missing]);assert.equal(s.value,null);assert.equal(s.percent,null);assert.equal(s.knownValue.toString(),'2698000');assert.equal(s.cost.toString(),'4692000');
});
test('portfolio returns are weighted by cost, not averaged',()=>{
 const a=valueHolding({...h,purchase_currency:'KRW',asset_type:'domestic_etf',symbol:'360750',quantity:'1',original_investment_krw:'100',average_purchase_price:'100'},{'KR:360750':{...q,symbol:'360750',market:'KR',currency:'KRW',current_price:'200'}});
 const b=valueHolding({...a.h,id:'b',original_investment_krw:'900'},{'KR:360750':{...q,symbol:'360750',market:'KR',currency:'KRW',current_price:'900'}});
 assert.equal(summarize([a,b]).percent?.toString(),'10');
});
test('invalid values are rejected and precision retained for large input',()=>{
 for(const value of ['0','-1','NaN','Infinity','1e9','1,000','0.0000000000001','1000000000000000000'])assert.throws(()=>positive(value,'수량'));
 assert.equal(costBasis('999999999999999999','0.1','KRW','',''),'99999999999999999.900000000000');
 assert.equal(summarize([]).percent,null);
});
