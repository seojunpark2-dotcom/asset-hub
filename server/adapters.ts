import Decimal from 'decimal.js';
import {createHmac,randomUUID} from 'node:crypto';
Decimal.set({precision:40});
export type Provider='kiwoom'|'upbit';
export interface Position {symbol:string;name:string;asset_type:'domestic_stock'|'domestic_etf'|'crypto';quantity:string;average_purchase_price:string;original_investment_krw:string;purchase_currency:'KRW'}
type Fetch=typeof fetch;
export class AccountError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
function amount(value:unknown):Decimal {
 const text=String(value??'').trim();
 if(!/^\d+(\.\d+)?$/.test(text))throw new AccountError('INVALID_BALANCE');
 const n=new Decimal(text);if(!n.isFinite()||n.lt(0)||n.gte('1e18')||n.decimalPlaces()>12)throw new AccountError('INVALID_BALANCE');return n;
}
function position(symbol:string,name:string,type:Position['asset_type'],quantity:Decimal,cost:Decimal):Position {
 if(!name||name.length>120||quantity.lte(0)||cost.gte('1e60'))throw new AccountError('INVALID_BALANCE');
 return {symbol,name,asset_type:type,quantity:quantity.toFixed(),average_purchase_price:cost.div(quantity).toDecimalPlaces(12).toFixed(),original_investment_krw:cost.toDecimalPlaces(12).toFixed(),purchase_currency:'KRW'};
}
async function response(url:string,options:RequestInit,http:Fetch){
 const r=await http(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new AccountError(r.status===429?'RATE_LIMIT':r.status===401||r.status===403?'KEY_OR_IP':'PROVIDER_UNAVAILABLE');
 return {r,data:await r.json()};
}
export function upbitJWT(access:string,secret:string){
 const header=Buffer.from(JSON.stringify({alg:'HS512',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({access_key:access,nonce:randomUUID()})).toString('base64url');
 return header+'.'+payload+'.'+createHmac('sha512',secret).update(header+'.'+payload).digest('base64url');
}
export function normalizeUpbit(data:unknown,names:Map<string,string>=new Map()):Position[]{
 if(!Array.isArray(data))throw new AccountError('INVALID_BALANCE');
 const result:Position[]=[];const seen=new Set<string>();
 for(const row of data){
  if(!row||typeof row.currency!=='string')throw new AccountError('INVALID_BALANCE');
  if(row.currency==='KRW')continue;
  const qty=amount(row.balance).add(amount(row.locked));if(qty.isZero())continue;
  if(row.unit_currency!=='KRW'||!/^[A-Z0-9]{2,15}$/.test(row.currency))throw new AccountError('UNSUPPORTED_ASSET');
  const symbol='KRW-'+row.currency;if(seen.has(symbol))throw new AccountError('INVALID_BALANCE');seen.add(symbol);
  const cost=qty.mul(amount(row.avg_buy_price));
  if(cost.gte(1))result.push(position(symbol,names.get(symbol)??row.currency,'crypto',qty,cost));
 }
 if(result.length>49)throw new AccountError('TOO_MANY_ASSETS');return result;
}
export function normalizeKiwoom(rows:unknown,etfs:Set<string>):Position[]{
 if(!Array.isArray(rows))throw new AccountError('INVALID_BALANCE');
 const merged=new Map<string,{qty:Decimal;cost:Decimal;name:string}>();
 for(const row of rows){
  const qty=amount(row.rmnd_qty);if(qty.isZero())continue;
  const symbol=String(row.stk_cd??'').replace(/^A/,'');
  if(!/^[A-Z0-9]{6}$/.test(symbol)||Number(row.crd_tp??0)!==0)throw new AccountError('UNSUPPORTED_ASSET');
  const old=merged.get(symbol);const cost=amount(row.pur_amt);
  merged.set(symbol,{qty:(old?.qty??new Decimal(0)).add(qty),cost:(old?.cost??new Decimal(0)).add(cost),name:String(row.stk_nm??'')});
 }
 const kept=[...merged].filter(([,p])=>p.cost.gte(1));
 if(kept.length>49)throw new AccountError('TOO_MANY_ASSETS');
 return kept.map(([symbol,p])=>position(symbol,p.name,etfs.has(symbol)?'domestic_etf':'domestic_stock',p.qty,p.cost));
}
export class AccountAdapters {
 private env:Record<string,string|undefined>;private http:Fetch;
 private token?:{value:string;expires:number};private etfs?:{codes:Set<string>;expires:number};
 constructor(env:Record<string,string|undefined>,http:Fetch=fetch){this.env=env;this.http=http;}
 configured(provider:Provider){return provider==='kiwoom'?!!(this.env.KIWOOM_APP_KEY&&this.env.KIWOOM_APP_SECRET):!!(this.env.UPBIT_ACCESS_KEY&&this.env.UPBIT_SECRET_KEY);}
 private async kiwoomToken(){
  if(this.token&&this.token.expires>Date.now()+60000)return this.token.value;
  const {data}=await response('https://api.kiwoom.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',appkey:this.env.KIWOOM_APP_KEY,secretkey:this.env.KIWOOM_APP_SECRET})},this.http);
  const expiry=String(data.expires_dt??'');
  if(data.return_code!==0||typeof data.token!=='string'||!/^\d{14}$/.test(expiry))throw new AccountError('KEY_OR_IP');
  const expires=Date.parse(expiry.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3T$4:$5:$6+09:00'));
  if(!Number.isFinite(expires)||expires<=Date.now())throw new AccountError('KEY_OR_IP');
  this.token={value:data.token,expires};return data.token;
 }
 private async pages(api:string,path:string,body:Record<string,string>,key:string){
  const rows:Record<string,unknown>[]=[];let next='';const seen=new Set<string>();
  for(let page=0;page<30;page++){
   const token=await this.kiwoomToken();
   const {r,data}=await response('https://api.kiwoom.com'+path,{method:'POST',headers:{'Content-Type':'application/json','authorization':'Bearer '+token,'api-id':api,'cont-yn':page?'Y':'N','next-key':next},body:JSON.stringify(body)},this.http);
   if(data.return_code!==0){this.token=undefined;throw new AccountError('KEY_OR_IP');}
   if(!Array.isArray(data[key]))throw new AccountError('INVALID_BALANCE');rows.push(...data[key]);
   if(r.headers.get('cont-yn')!=='Y')return rows;
   next=r.headers.get('next-key')??'';if(!next||seen.has(next))throw new AccountError('INCOMPLETE_BALANCE');seen.add(next);
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new AccountError('INCOMPLETE_BALANCE');
 }
 async snapshot(provider:Provider):Promise<Position[]>{
  if(!this.configured(provider))throw new AccountError('SETUP_REQUIRED');
  if(provider==='upbit'){
   const {data}=await response('https://api.upbit.com/v1/accounts',{headers:{Authorization:'Bearer '+upbitJWT(this.env.UPBIT_ACCESS_KEY!,this.env.UPBIT_SECRET_KEY!)}},this.http);
   const names=new Map<string,string>();
   try{const markets=await response('https://api.upbit.com/v1/market/all',{},this.http);for(const m of markets.data)if(typeof m.market==='string'&&typeof m.korean_name==='string')names.set(m.market,m.korean_name);}catch{/* A display-name failure must not replace the account snapshot. */}
   return normalizeUpbit(data,names);
  }
  if(!this.etfs||this.etfs.expires<Date.now()){
   const rows=await this.pages('ka10099','/api/dostk/stkinfo',{mrkt_tp:'8'},'list');
   const codes=new Set<string>();for(const row of rows){const code=String(row.code??'');if(!/^[A-Z0-9]{6}$/.test(code))throw new AccountError('INVALID_BALANCE');codes.add(code);}
   this.etfs={codes,expires:Date.now()+86400000};
  }
  const rows=await this.pages('kt00018','/api/dostk/acnt',{qry_tp:'1',dmst_stex_tp:'KRX'},'acnt_evlt_remn_indv_tot');
  return normalizeKiwoom(rows,this.etfs.codes);
 }
}
