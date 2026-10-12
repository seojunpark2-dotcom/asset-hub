import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createKis,tokenExpiry,type KisStore,type KisSession} from '../supabase/functions/_shared/kis';
import {databaseKisStore} from '../supabase/functions/_shared/kis-store';
const original=globalThis.fetch;afterEach(()=>{globalThis.fetch=original;});
const env=(name:string)=>({KIS_APP_KEY:'fixture-app-key',KIS_APP_SECRET:'fixture-app-secret'} as Record<string,string>)[name];
const instrument={symbol:'360750',market:'KR',asset_type:'domestic_etf'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
function memory(clock:()=>number){
 const rows=new Map<string,{session:KisSession|null;owner:string;retry:number}>();
 const store:KisStore={async load(key){return rows.get(key)?.session??null;},async claim(key,owner){const row=rows.get(key);if(row&&(row.retry>clock()||(row.session&&Date.parse(row.session.expiresAt)>clock()+90000)))return false;rows.set(key,{session:row?.session??null,owner,retry:clock()+61000});return true;},async save(key,owner,session){const row=rows.get(key);if(!row||row.owner!==owner)return false;row.session=session;return true;},async invalidate(key,token){const row=rows.get(key);if(row?.session?.token===token)row.session=null;}};
 return {store,rows};
}
test('KIS tokens persist across workers, renew automatically and use ETF endpoint',async()=>{
 let now=Date.parse('2026-10-12T00:00:00Z');const {store}=memory(()=>now);let minted=0;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/oauth2/tokenP'){minted++;assert.equal(init?.method,'POST');assert.equal(JSON.parse(String(init.body)).appkey,'fixture-app-key');return response({access_token:'token-'+minted,token_type:'Bearer',expires_in:86400});}
  assert.equal(url.pathname,'/uapi/etfetn/v1/quotations/inquire-price');assert.equal(url.searchParams.get('FID_INPUT_ISCD'),'360750');assert.equal(url.searchParams.get('FID_COND_MRKT_DIV_CODE'),'J');assert.equal(new Headers(init?.headers).get('tr_id'),'FHPST02400000');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer token-'+minted);
  return response({rt_cd:'0',output:{stck_prpr:'25000'}});
 };
 const first=await createKis(env,store,()=>now).provider.get(instrument);assert.equal(first.current_price,'25000');assert.equal(first.time_basis,'retrieved');assert.equal(first.updated_at,new Date(now).toISOString());
 await createKis(env,store,()=>now).provider.get(instrument);assert.equal(minted,1);
 now+=86400000;
 await createKis(env,store,()=>now).provider.get(instrument);assert.equal(minted,2);
});
test('concurrent Edge workers issue one shared token and never expose it in quote/status',async()=>{
 const now=Date.now();const {store}=memory(()=>now);let minted=0;
 globalThis.fetch=async(input)=>{if(String(input).endsWith('/oauth2/tokenP')){minted++;await new Promise(r=>setTimeout(r,10));return response({access_token:'private-token',token_type:'Bearer',expires_in:86400});}return response({rt_cd:'0',output:{stck_prpr:'1'}});};
 const a=createKis(env,store,()=>now),b=createKis(env,store,()=>now);
 const quotes=await Promise.all([a.provider.get(instrument),b.provider.get(instrument)]);assert.equal(minted,1);assert.doesNotMatch(JSON.stringify([quotes,await a.status()]),/private-token|fixture-app/);
});
test('expired upstream token is invalidated and automatically retried once',async()=>{
 let now=Date.now();const {store}=memory(()=>now);let minted=0;let fail=false;
 globalThis.fetch=async(input)=>{if(String(input).endsWith('/oauth2/tokenP'))return response({access_token:'token-'+(++minted),token_type:'Bearer',expires_in:86400});if(fail){fail=false;return response({rt_cd:'1',msg_cd:'EGW00123'},401);}return response({rt_cd:'0',output:{stck_prpr:'1'}});};
 const api=createKis(env,store,()=>now);await api.provider.get(instrument);now+=62000;fail=true;await api.provider.get(instrument);assert.equal(minted,2);
});
test('missing keys, rejected keys and malformed token expiry fail safely without fabricated quotes',async()=>{
 const now=Date.now();const missing=createKis(()=>undefined,memory(()=>now).store,()=>now);assert.equal((await missing.status()).configured,false);await assert.rejects(()=>missing.provider.get(instrument),/최초 한 번/);
 globalThis.fetch=async()=>response({error_code:'EGW00105',message:'fixture-app-secret leaked-body'},403);
 await assert.rejects(()=>createKis(env,memory(()=>now).store,()=>now).provider.get(instrument),(e:Error)=>{assert.match(e.message,/인증이 거부/);assert.doesNotMatch(e.message,/fixture|leaked-body/);return true;});
 for(const invalid of [{},{expires_in:-1},{access_token_token_expired:'invalid'},{expires_in:8640000}])assert.throws(()=>tokenExpiry(invalid,now));
 assert.equal(tokenExpiry({expires_in:86400,access_token_token_expired:'2026-10-13 09:00:00'},Date.parse('2026-10-12T00:00:00Z')),'2026-10-13T00:00:00.000Z');
});
test('provider outages respect mint cooldown rather than retrying token issuance on every poll',async()=>{
 const now=Date.now();const {store}=memory(()=>now);let minted=0;
 globalThis.fetch=async()=>{minted++;throw Error('fixture-app-secret');};
 const api=createKis(env,store,()=>now,async()=>{});await assert.rejects(()=>api.provider.get(instrument),/연결/);await assert.rejects(()=>api.provider.get(instrument),/대기/);assert.equal(minted,1);
});
test('broker session RPC failures never forward database error details',async()=>{
 const store=databaseKisStore({rpc:async()=>({data:null,error:{message:'private-token'}})});
 await assert.rejects(()=>store.load('test'),(e:Error)=>{assert.match(e.message,/저장소/);assert.doesNotMatch(e.message,/private-token/);return true;});
});
