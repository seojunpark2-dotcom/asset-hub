import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {normalizeKiwoom,normalizeUpbit,upbitJWT,AccountAdapters} from '../server/adapters';
import {gateway} from '../server/gateway';
import {valueHolding} from '../src/finance';
import type {Holding,Quote} from '../src/types';
import {keepAccountHolding} from '../src/accountDust';

test('Upbit includes locked coins and removes account assets costing less than one won',()=>{
 const rows=normalizeUpbit([{currency:'KRW',balance:'10000',locked:'0'},
  {currency:'BTC',balance:'0.00001',locked:'0.00002',avg_buy_price:'100000000',unit_currency:'KRW'},
  {currency:'ETH',balance:'1',locked:'0',avg_buy_price:'0',unit_currency:'KRW'}]);
 assert.equal(rows[0]?.quantity,'0.00003');assert.equal(rows[0]?.original_investment_krw,'3000');
 assert.equal(rows.length,1);
 const h={...rows[0],id:'gift',user_id:'user',institution:'업비트',symbol:'KRW-ETH',quantity:'1',average_purchase_price:'0',original_investment_krw:'0',purchase_exchange_rate:null} as Holding;
 const q={current_price:'100',market:'UPBIT',symbol:'KRW-ETH'} as Quote;
 const valuation=valueHolding(h,{'UPBIT:KRW-ETH':q});assert.equal(valuation.percent,null);assert.equal(valuation.stockProfit?.toFixed(),'100');
 assert.throws(()=>normalizeUpbit([{currency:'BTC',balance:'1',locked:'0',avg_buy_price:'1',unit_currency:'USDT'}]));
 assert.throws(()=>normalizeUpbit([{currency:'BTC',balance:'-1',locked:'0',avg_buy_price:'1',unit_currency:'KRW'}]));
});
test('Account cost threshold is exact, merges lots first, and preserves manual holdings',()=>{
 const coin=(currency:string,cost:string)=>({currency,balance:'1',locked:'0',avg_buy_price:cost,unit_currency:'KRW'});
 assert.deepEqual(normalizeUpbit([coin('AAA','0.999999999999'),coin('BBB','1'),coin('CCC','1.000000000001'),coin('DDD','0')]).map(p=>p.symbol),['KRW-BBB','KRW-CCC']);
 const lot=(code:string,cost:string)=>({stk_cd:code,stk_nm:'ETF',rmnd_qty:'1',pur_amt:cost});
 assert.deepEqual(normalizeKiwoom([lot('A360750','0.6'),lot('A360750','0.4'),lot('A005930','0.999999999999')],new Set()).map(p=>p.original_investment_krw),['1']);
 for(const cost of ['0','0.999999999999','1','1.000000000001']){
  const h={connection_id:'connected',original_investment_krw:cost} as Holding;
  assert.equal(keepAccountHolding(h),Number(cost)>=1);
  assert.equal(keepAccountHolding({...h,connection_id:null}),true);
 }
});
test('Kiwoom strips stock prefix, classifies ETFs from official list and combines duplicate cash lots',()=>{
 const rows=normalizeKiwoom([{stk_cd:'A360750',stk_nm:'ETF',rmnd_qty:'2',pur_amt:'40000',crd_tp:'00'},
  {stk_cd:'A360750',stk_nm:'ETF',rmnd_qty:'1',pur_amt:'30000',crd_tp:'0'}],new Set(['360750']));
 assert.equal(rows[0]?.asset_type,'domestic_etf');assert.equal(rows[0]?.quantity,'3');assert.equal(rows[0]?.original_investment_krw,'70000');
 assert.throws(()=>normalizeKiwoom([{stk_cd:'Q123456',rmnd_qty:'1',pur_amt:'1'}],new Set()));
 assert.throws(()=>normalizeKiwoom([{stk_cd:'A005930',rmnd_qty:'1',pur_amt:'1',crd_tp:'03'}],new Set()));
});
test('Upbit JWT uses HS512 with a fresh nonce and unmodified secret',()=>{
 const first=upbitJWT('access','secret'),second=upbitJWT('access','secret');assert.notEqual(first,second);
 const [head,payload,signature]=first.split('.');assert.equal(JSON.parse(Buffer.from(head!,'base64url').toString()).alg,'HS512');
 assert.equal(JSON.parse(Buffer.from(payload!,'base64url').toString()).access_key,'access');
 assert.equal(signature,createHmac('sha512','secret').update(head+'.'+payload).digest('base64url'));
});
test('Kiwoom consumes every continuation page and caches short-lived OAuth token',async()=>{
 let tokens=0,balanceCalls=0;
 const http:typeof fetch=async(url,options)=>{
  const path=String(url);
  if(path.endsWith('/oauth2/token')){tokens++;return Response.json({return_code:0,token:'token',expires_dt:'20990101000000'});}
  const headers=options?.headers as Record<string,string>;
  assert.equal(headers.authorization,'Bearer token');
  if(headers['api-id']==='ka10099')return Response.json({return_code:0,list:[{code:'360750'}]});
  balanceCalls++;const more=headers['cont-yn']==='N';
  return Response.json({return_code:0,acnt_evlt_remn_indv_tot:[{stk_cd:more?'A360750':'A005930',stk_nm:more?'ETF':'삼성전자',rmnd_qty:'1',pur_amt:'100'}]},
    {headers:{'cont-yn':more?'Y':'N','next-key':more?'page2':''}});
 };
 const adapter=new AccountAdapters({KIWOOM_APP_KEY:'key',KIWOOM_APP_SECRET:'secret'},http);
 assert.equal((await adapter.snapshot('kiwoom')).length,2);assert.equal((await adapter.snapshot('kiwoom')).length,2);
 assert.equal(tokens,1);assert.equal(balanceCalls,4);
});
test('Gateway requires both shared secret and owner identity, exposes no trading routes',async()=>{
 const owner='00000000-0000-0000-0000-000000000001',secret='a'.repeat(40);
 const server=gateway({GATEWAY_SHARED_SECRET:secret,ACCOUNT_OWNER_USER_ID:owner});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const address=server.address() as {port:number};const url='http://127.0.0.1:'+address.port;
  assert.equal((await fetch(url+'/status',{method:'POST',body:'{}'})).status,401);
  assert.equal((await fetch(url+'/status',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({userId:'wrong'})})).status,403);
  assert.equal((await fetch(url+'/orders',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({userId:owner})})).status,404);
  const status=await fetch(url+'/status',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({userId:owner})});
  assert.deepEqual(await status.json(),{providers:{kiwoom:false,upbit:false}});
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
test('Account snapshots are atomic, owner-isolated, read-only to app users and safe on disconnect',async()=>{
 const db=new PGlite();const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261010091417_portfolio_schema.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261015132411_portfolio_account_connections.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261017082059_home_account_device_scope.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261017171555_device_credential_refresh_scope.sql',import.meta.url),'utf8'));
  assert.equal((await db.query<{column_default:string}>("select column_default from information_schema.columns where table_name='portfolio_widget_devices' and column_name='local_snapshots'")).rows[0]?.column_default,'false');
  await db.exec(`insert into auth.users values('${a}'),('${b}');set role service_role;`);
  const device='00000000-0000-0000-0000-000000000010';
  await db.query("insert into portfolio_widget_devices(id,user_id,token_hash) values($1,$2,$3)",[device,a,'a'.repeat(64)]);
  assert.deepEqual((await db.query<{credential_providers:string[]}>('select credential_providers from portfolio_widget_devices')).rows[0]?.credential_providers,[]);
  const grant=async(user:string,provider:string,enable=true,id:string|null=device)=>(await db.query<{ok:boolean}>('select portfolio_device_credentials($1,$2,$3,$4) as ok',[user,id,provider,enable])).rows[0]?.ok;
  assert.equal(await grant(a,'kiwoom'),false);
  await db.query('update portfolio_widget_devices set local_snapshots=true where id=$1',[device]);
  assert.equal(await grant(b,'kiwoom'),false);assert.equal(await grant(a,'invalid'),false);
  assert.equal(await grant(a,'kiwoom'),true);assert.equal(await grant(a,'kiwoom'),true);assert.equal(await grant(a,'upbit'),true);
  assert.deepEqual((await db.query<{credential_providers:string[]}>('select credential_providers from portfolio_widget_devices')).rows[0]?.credential_providers.sort(),['kiwoom','upbit']);
  assert.equal(await grant(a,'kiwoom',false,null),true);
  assert.deepEqual((await db.query<{credential_providers:string[]}>('select credential_providers from portfolio_widget_devices')).rows[0]?.credential_providers,['upbit']);
  await db.query("update portfolio_widget_devices set expires_at=now()-interval '1 day' where id=$1",[device]);
  assert.equal(await grant(a,'kiwoom'),false);
  const positions=normalizeKiwoom([{stk_cd:'A360750',stk_nm:'ETF',rmnd_qty:'2',pur_amt:'40000'}],new Set(['360750']));
  await db.query('select portfolio_commit_account($1,$2,$3,true)',[a,'kiwoom',JSON.stringify(positions)]);
  assert.equal((await db.query('select quantity from portfolio_holdings')).rows.length,1);
  // Seed legacy account dust plus a manual position, then run the actual cleanup migration.
  await db.exec(`insert into portfolio_holdings(user_id,connection_id,institution,asset_type,symbol,name,quantity,average_purchase_price,purchase_currency,original_investment_krw)
   select '${a}',id,'키움증권','domestic_stock','005930','dust',1,0,'KRW',0 from portfolio_connections where user_id='${a}';
   insert into portfolio_holdings(user_id,institution,asset_type,symbol,name,quantity,average_purchase_price,purchase_currency,original_investment_krw)
   values('${b}','업비트','crypto','KRW-BTC','manual',1,0,'KRW',0);`);
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261018071958_exclude_account_dust.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  assert.equal((await db.query('select * from portfolio_holdings where connection_id is not null and original_investment_krw < 1')).rows.length,0);
  assert.equal((await db.query('select * from portfolio_holdings where user_id=$1',[b])).rows.length,1);
  const commit=async(cost:string)=>db.query('select portfolio_commit_account($1,$2,$3,false)',[a,'kiwoom',JSON.stringify([{...positions[0],original_investment_krw:cost}])]);
  await commit('0.999999999999');assert.equal((await db.query('select * from portfolio_holdings where user_id=$1',[a])).rows.length,0);
  await commit('1');assert.equal((await db.query('select * from portfolio_holdings where user_id=$1',[a])).rows.length,1);
  await commit('0');assert.equal((await db.query('select * from portfolio_holdings where user_id=$1',[a])).rows.length,0);
  await commit('40000');await db.query('delete from portfolio_holdings where user_id=$1',[b]);
  const broken=[{...positions[0],quantity:'-1'}];
  await assert.rejects(()=>db.query('select portfolio_commit_account($1,$2,$3,false)',[a,'kiwoom',JSON.stringify(broken)]));
  assert.equal((await db.query<{quantity:string}>('select quantity::text from portfolio_holdings')).rows[0]?.quantity,'2');
  await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);
  assert.equal((await db.query('select * from portfolio_connections')).rows.length,1);
  assert.equal((await db.query('delete from portfolio_holdings returning id')).rows.length,0);
  assert.equal((await db.query('update portfolio_holdings set quantity=99 returning id')).rows.length,0);
  await assert.rejects(()=>db.exec(`insert into portfolio_holdings(user_id,institution,asset_type,symbol,name,quantity,average_purchase_price,purchase_currency,original_investment_krw)
   values('${a}','키움증권','domestic_etf','360750','duplicate',1,100,'KRW',100)`));
  await assert.rejects(()=>db.query('select * from portfolio_widget_devices'));
  await assert.rejects(()=>db.query('select portfolio_device_credentials($1,$2,$3,true)',[a,device,'kiwoom']));
  await assert.rejects(()=>db.query('select portfolio_commit_account($1,$2,$3,true)',[a,'kiwoom','[]']));
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
  assert.equal((await db.query('select * from portfolio_connections')).rows.length,0);
  assert.equal((await db.query('select * from portfolio_holdings_read')).rows.length,0);
  await db.exec('reset role;set role service_role');
  await db.query('select portfolio_disconnect_account($1,$2)',[a,'kiwoom']);
  assert.equal((await db.query<{connection_id:string|null}>('select connection_id from portfolio_holdings')).rows[0]?.connection_id,null);
  await assert.rejects(()=>db.query('select portfolio_commit_account($1,$2,$3,false)',[a,'kiwoom','[]']));
  assert.equal((await db.query('select * from portfolio_holdings')).rows.length,1);
 }finally{await db.close();}
});
