import {test} from 'node:test';
import assert from 'node:assert/strict';
import {valueHolding} from '../src/finance';
import {widgetSnapshot} from '../src/widgetData';
import {Holding,Quote} from '../src/types';
const h:Holding={id:'one',user_id:'user',institution:'키움증권',asset_type:'domestic_etf',symbol:'123456',name:'ETF A',quantity:'2',average_purchase_price:'100',purchase_currency:'KRW',purchase_exchange_rate:null,original_investment_krw:'200'};
const q:Quote={symbol:'123456',market:'KR',currency:'KRW',current_price:'150',updated_at:'2026-10-10T00:00:00Z',fetched_at:'2026-10-11T00:00:00Z',source:'fixture',delayed:true};
test('widget shows weighted total return and holding returns without excluded fields',()=>{
 const rows=[valueHolding(h,{'KR:123456':q}),valueHolding({...h,id:'two',name:'ETF B',symbol:'654321',quantity:'1',original_investment_krw:'100'},{'KR:654321':{...q,symbol:'654321',current_price:'50'}})];
 const result=widgetSnapshot(rows,'kr','2026-10-11T00:00:00.000Z');
 assert.equal(result.totalValue,'₩350');assert.equal(result.totalProfit,'+₩50');assert.equal(result.totalPercent,'+16.67%');
 assert.deepEqual(result.rows.map(r=>r.percent),['+50.00%','-50.00%']);assert.equal(result.rows[0]?.color,'#FF727C');
 assert.deepEqual(Object.keys(result.rows[0]!).sort(),['color','id','institution','name','percent']);
 assert.equal('totalCost' in result,false);assert.equal(result.delayed,true);
});
test('missing quotes never turn into fabricated zero balances or returns',()=>{
 const result=widgetSnapshot([valueHolding(h,{})],'global');
 assert.equal(result.totalValue,'—');assert.equal(result.totalProfit,'—');assert.equal(result.totalPercent,'—');
 assert.equal(result.rows[0]?.percent,'—');assert.equal(result.stale,true);
 assert.equal(widgetSnapshot([],'kr').rows.length,0);
});
