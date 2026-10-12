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
  const quoted=await a.functions.invoke('portfolio-quotes',{body:{}});check(quoted.error,'Authenticated quote function');
  assert.ok(quoted.data.quotes.find((q:{symbol:string;current_price:string})=>q.symbol==='KRW-BTC'&&Number(q.current_price)>0));
  const apiQuoted=await a.functions.invoke('portfolio-quotes-kis',{body:{}});check(apiQuoted.error,'API branch quote function');
  assert.ok(apiQuoted.data.quotes.find((q:{symbol:string;current_price:string})=>q.symbol==='KRW-BTC'&&Number(q.current_price)>0));
  assert.equal(typeof apiQuoted.data.kis.configured,'boolean');
  assert.doesNotMatch(JSON.stringify(apiQuoted.data),/access_token|appsecret|Bearer /);
  const privateCache=await a.from('portfolio_quote_cache_kis').select('*');assert.ok(privateCache.error);
  const privateToken=await a.rpc('portfolio_kis_session_read',{p_key:'a'.repeat(64)});assert.ok(privateToken.error);
  const etf={...payload,asset_type:'domestic_etf',symbol:'360750',name:'API branch test ETF',institution:'키움증권',quantity:'1',average_purchase_price:'100',original_investment_krw:'100'};
  const etfInsert=await a.from('portfolio_holdings').insert(etf).select('id').single();check(etfInsert.error,'API test ETF insert');
  const missing=await a.functions.invoke('portfolio-quotes-kis',{body:{}});check(missing.error,'API branch missing-key response');
  if(!missing.data.kis.configured){assert.match(missing.data.errors['KR:360750'],/최초 한 번/);assert.equal(missing.data.quotes.some((q:{market:string})=>q.market==='KR'),false);}
  check((await a.from('portfolio_holdings').delete().eq('id',etfInsert.data!.id)).error,'API test ETF delete');
  const apiAnonymous=await fetch(url+'/functions/v1/portfolio-quotes-kis',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:'{}'});assert.equal(apiAnonymous.status,401);
  const anonymous=await fetch(url+'/functions/v1/portfolio-quotes',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:'{}'});assert.equal(anonymous.status,401);
  const removed=await a.from('portfolio_holdings').delete().eq('id',id);check(removed.error,'Delete holding');
  assert.equal((await a.from('portfolio_holdings_read').select('*')).data!.length,0);
  for(const client of clients)await client.auth.signOut();
  console.log('PASS: Auth/CRUD/RLS, original and API branch Upbit endpoints, private token/cache access denied, missing KIS key explicitly reported, anonymous rejection. Real KIS prices require one-time key setup.');
 }finally{
  for(const id of cleanup){const result=await admin.auth.admin.deleteUser(id);if(result.error)throw new Error('Test identity cleanup failed');}
  console.log('Disposable test identities removed.');
 }
}
main().catch(()=>{console.error('FAIL: live backend verification. No credentials are logged.');process.exitCode=1;});
