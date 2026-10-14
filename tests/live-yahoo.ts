import {yahooQuotes} from '../src/yahooQuotes';
import {valueHolding} from '../src/finance';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
async function main(){
 const env=await readFile('.env','utf8');const url=env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)![1]!.trim();const pub=env.match(/^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)![1]!.trim();
 const ref=new URL(url).hostname.split('.')[0]!;
 // The official CLI returns keys only to this process. No secrets are printed or written.
 const output=execFileSync('node',['node_modules/supabase/dist/supabase.js','projects','api-keys','--project-ref',ref,'--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 console.log("CLI key response received securely.");const keys=JSON.parse(output);
 const rows=Array.isArray(keys)?keys:keys.keys;
 const secret=rows.find((k:{name:string;type:string})=>k.name==='service_role')?.api_key ?? rows.find((k:{type:string})=>k.type==='secret')?.api_key;
 if(!secret)throw new Error('Test admin key unavailable');
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const cleanup:string[]=[];
 function check(error:unknown,stage:string){if(error){console.error("Failed step: "+stage);throw new Error(stage);}}
 try{
  const clients=[];
  for(let i=0;i<2;i++){
   const password=randomBytes(24).toString('base64url');const email='assethub-test-'+randomUUID()+'@example.com';
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});check(error,'Create test identity');cleanup.push(data.user!.id);
   const client=createClient(url,pub,{auth:{persistSession:false}});
   const login=await client.auth.signInWithPassword({email,password});check(login.error,'Email/password login');clients.push(client);
  }
  const [a,b]=clients;
  assert.ok(a&&b);
  const payload={user_id:cleanup[0],institution:'업비트',asset_type:'crypto',symbol:'KRW-BTC',name:'Live test BTC',quantity:'0.00000001',average_purchase_price:'100000000',purchase_currency:'KRW',original_investment_krw:'1'};
  const inserted=await a.from('portfolio_holdings').insert(payload).select('id').single();check(inserted.error,'Holdings insert');
  const id=inserted.data!.id;
  const loaded=await a.from('portfolio_holdings_read').select('*');check(loaded.error,'Read precision view');assert.equal(loaded.data![0].quantity,'0.00000001');
  const foreign=await b.from('portfolio_holdings_read').select('*');check(foreign.error,'Other user query');assert.equal(foreign.data!.length,0);
  const invalid=await a.from('portfolio_holdings').update({user_id:cleanup[1]}).eq('id',id);assert.ok(invalid.error);
  const changed=await a.from('portfolio_holdings').update({quantity:'0.00000002',original_investment_krw:'2'}).eq('id',id);check(changed.error,'Update holding');
  const settings=await a.from('portfolio_profiles').upsert({user_id:cleanup[0],settings:{dark:true,interval:300,colors:'kr'}});check(settings.error,'Save settings');
  const quoted=await a.functions.invoke('portfolio-quotes-yahoo-all',{body:{}});check(quoted.error,'Authenticated quote function');
  console.log('Initial quote symbols: '+quoted.data.quotes.map((q:any)=>q.symbol).join(','));console.log('Quote errors: '+JSON.stringify(quoted.data.errors));assert.ok(quoted.data.quotes.find((q:{symbol:string;current_price:string})=>q.symbol==='KRW-BTC'&&Number(q.current_price)>0));
  const etf=await a.from('portfolio_holdings').insert({...payload,institution:'키움증권',asset_type:'domestic_etf',symbol:'360750',name:'Yahoo live ETF',quantity:'10',average_purchase_price:'20000',original_investment_krw:'200000'}).select('id').single();check(etf.error,'ETF insert');
  for(const code of ['005930','247540'])check((await a.from('portfolio_holdings').insert({...payload,institution:'키움증권',asset_type:'domestic_stock',symbol:code,name:'Live stock '+code,quantity:'1',average_purchase_price:'100000',original_investment_krw:'100000'})).error,'Stock insert');
  for(const [code,type] of [['AAPL','foreign_stock'],['VOO','foreign_etf']])check((await a.from('portfolio_holdings').insert({...payload,institution:'미래에셋증권',asset_type:type,symbol:code,name:'US '+code,purchase_currency:'USD',quantity:'2',average_purchase_price:'100',original_investment_krw:'200000'})).error,'US holding insert');
  const yahoo=await a.functions.invoke('portfolio-quotes-yahoo-all',{body:{}});check(yahoo.error,'Yahoo endpoint');assert.deepEqual(yahoo.data.yahooInstruments.map((i:any)=>i.symbol).sort(),['005930','247540','360750','AAPL','VOO']);const ownYahoo=await yahooQuotes(yahoo.data.yahooInstruments);const etfQuote=ownYahoo.quotes['KR:360750'];assert.equal(ownYahoo.quotes['US:AAPL']?.currency,'USD');assert.equal(ownYahoo.quotes['US:VOO']?.currency,'USD');assert.ok(yahoo.data.quotes.some((q:any)=>q.market==='FX'));console.log('Yahoo US prices: '+ownYahoo.quotes['US:AAPL']?.current_price+' / '+ownYahoo.quotes['US:VOO']?.current_price);assert.equal(ownYahoo.quotes['KR:005930']?.currency,'KRW');assert.match(ownYahoo.quotes['KR:247540']?.source??'',/코스닥/);console.log('Direct Yahoo errors: '+JSON.stringify(ownYahoo.errors));console.log('ETF errors: '+JSON.stringify(yahoo.data.errors));assert.ok(etfQuote,'Live Yahoo ETF quote missing: '+JSON.stringify(yahoo.data.errors));assert.equal(etfQuote.currency,'KRW');assert.match(etfQuote.source,/Yahoo Finance/);const valuation=valueHolding({...payload,user_id:cleanup[0]!,id:etf.data!.id,asset_type:'domestic_etf',symbol:'360750',quantity:'10',average_purchase_price:'20000',purchase_currency:'KRW',original_investment_krw:'200000',purchase_exchange_rate:null},{'KR:360750':etfQuote});assert.equal(valuation.profit?.toString(),String(Number(etfQuote.current_price)*10-200000));assert.ok(Number(etfQuote.current_price)>0);assert.ok(Date.parse(etfQuote.updated_at)<=Date.now());console.log('Live Yahoo ETF verified: '+etfQuote.current_price+' KRW / '+etfQuote.updated_at);
  const blockedCache=await a.from('portfolio_quote_cache_yahoo').select('*');assert.ok(blockedCache.error);
  check((await a.from('portfolio_holdings').delete().eq('id',etf.data!.id)).error,'Delete ETF');
  const anonymous=await fetch(url+'/functions/v1/portfolio-quotes-yahoo-all',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:'{}'});assert.equal(anonymous.status,401);
  check((await a.from('portfolio_holdings').delete().eq('asset_type','domestic_stock')).error,'Delete test stocks');
  check((await a.from('portfolio_holdings').delete().in('asset_type',['foreign_stock','foreign_etf'])).error,'Delete US test holdings');
  const removed=await a.from('portfolio_holdings').delete().eq('id',id);check(removed.error,'Delete holding');
  assert.equal((await a.from('portfolio_holdings_read').select('*')).data!.length,0);
  for(const client of clients)await client.auth.signOut();
  console.log('PASS: real Auth login, CRUD, numeric precision, RLS isolation, settings, authenticated Upbit quote, anonymous rejection, logout.');
 }finally{
  for(const id of cleanup){const result=await admin.auth.admin.deleteUser(id);if(result.error)throw new Error('Test identity cleanup failed');}
  console.log('Disposable test identities removed.');
 }
}
main().catch(()=>{console.error('FAIL: live backend verification. No credentials are logged.');process.exitCode=1;});
