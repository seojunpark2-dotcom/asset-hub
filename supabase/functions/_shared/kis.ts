import {validPrice, type Instrument, type Provider, type Quote, type Secrets} from './providers.ts';

const origin='https://openapi.koreainvestment.com:9443';
export interface KisSession {token:string;expiresAt:string;}
export interface KisStore {
  load(key:string):Promise<KisSession|null>;
  claim(key:string,owner:string):Promise<boolean>;
  save(key:string,owner:string,session:KisSession):Promise<boolean>;
  invalidate(key:string,token:string):Promise<void>;
}
export class KisError extends Error {
  constructor(public readonly code:string,message:string){super(message);this.name='KisError';}
}
const pending=()=>new KisError('TOKEN_PENDING','한국투자 인증 자동 갱신 대기 중입니다. 잠시 후 자동으로 다시 조회합니다.');
function object(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
async function request(url:URL|string,init:RequestInit):Promise<{response:Response;data:Record<string,unknown>}> {
  let response:Response;
  try{response=await fetch(url,{...init,signal:AbortSignal.timeout(12000)});}
  catch{throw new KisError('CONNECTION','한국투자 연결 또는 응답시간 오류입니다. 자동 조회 때 재시도합니다.');}
  let data:Record<string,unknown>;
  try{data=object(await response.json());}
  catch{if(response.ok)throw new KisError('RESPONSE','한국투자 응답 형식 오류입니다.');data={};}
  return {response,data};
}
export function tokenExpiry(data:Record<string,unknown>,now:number):string {
  const relative=Number(data.expires_in);
  const candidates:number[]=[];
  if(Number.isFinite(relative)&&relative>0&&relative<=90000)candidates.push(now+relative*1000);
  if(typeof data.access_token_token_expired==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(data.access_token_token_expired)){
    const absolute=Date.parse(data.access_token_token_expired.replace(' ','T')+'+09:00');
    if(Number.isFinite(absolute))candidates.push(absolute);
  }
  const expires=Math.min(...candidates);
  if(!Number.isFinite(expires)||expires<=now+5000||expires>now+90000000)throw new KisError('TOKEN_RESPONSE','한국투자 토큰 만료시각을 확인할 수 없습니다.');
  return new Date(expires).toISOString();
}
export function createKis(env:Secrets,store:KisStore,clock=()=>Date.now(),sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))) {
  const appkey=env('KIS_APP_KEY')?.trim(),appsecret=env('KIS_APP_SECRET')?.trim();
  let identity:Promise<string>|undefined;
  let flight:Promise<KisSession>|undefined;
  const configured=Boolean(appkey&&appsecret);
  async function keyId(){
    if(!configured)throw new KisError('NOT_CONFIGURED','한국투자 앱키·시크릿을 서버에 최초 한 번 설정해야 국내 시세가 활성화됩니다.');
    identity??=crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([appkey,appsecret]))).then(bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''));
    return identity;
  }
  const usable=(s:KisSession|null)=>s&&Date.parse(s.expiresAt)>clock()+90000?s:null;
  async function acquire():Promise<KisSession>{
    const key=await keyId();
    const cached=usable(await store.load(key));if(cached)return cached;
    const owner=crypto.randomUUID();
    if(!await store.claim(key,owner)){
      // Other Edge workers may be issuing the shared token. Do not mint one per request.
      for(let i=0;i<10;i++){await sleep(200);const shared=usable(await store.load(key));if(shared)return shared;}
      throw pending();
    }
    const {response,data}=await request(origin+'/oauth2/tokenP',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',appkey,appsecret})});
    if(response.status===429||data.error_code==='EGW00133')throw pending();
    if(response.status===401||response.status===403||data.error_code==='EGW00103'||data.error_code==='EGW00105')throw new KisError('KEY_REJECTED','한국투자 앱키 인증이 거부됐습니다. 서버의 실전용 키와 한국투자 서비스 신청 상태를 확인하세요.');
    if(!response.ok||typeof data.access_token!=='string'||!data.access_token.trim()||String(data.token_type).toLowerCase()!=='bearer')throw new KisError('TOKEN_RESPONSE','한국투자 인증 실패입니다. 키 유효기간과 서비스 상태를 확인하세요.');
    const session={token:data.access_token,expiresAt:tokenExpiry(data,clock())};
    if(!await store.save(key,owner,session))throw pending();
    return session;
  }
  async function session(){if(flight)return flight;flight=acquire();try{return await flight;}finally{flight=undefined;}}
  const provider:Provider={supports:i=>i.market==='KR',ttl:60,async get(i:Instrument):Promise<Quote>{
    if(!/^[A-Z0-9]{6}$/.test(i.symbol))throw new KisError('SYMBOL','국내 종목코드 형식을 확인하세요.');
    const etf=i.asset_type==='domestic_etf';
    const url=new URL(origin+(etf?'/uapi/etfetn/v1/quotations/inquire-price':'/uapi/domestic-stock/v1/quotations/inquire-price'));
    url.search=new URLSearchParams({FID_COND_MRKT_DIV_CODE:'J',FID_INPUT_ISCD:i.symbol}).toString();
    for(let attempt=0;attempt<2;attempt++){
      const active=await session();
      const {response,data}=await request(url,{headers:{authorization:'Bearer '+active.token,appkey:appkey!,appsecret:appsecret!,tr_id:etf?'FHPST02400000':'FHKST01010100',custtype:'P'}});
      if(response.status===401||data.msg_cd==='EGW00123'||data.msg_cd==='EGW00121'){
        await store.invalidate(await keyId(),active.token);
        if(attempt===0)continue;
        throw new KisError('TOKEN_REJECTED','한국투자 토큰 인증을 복구하지 못했습니다. 다음 자동 조회 때 다시 확인합니다.');
      }
      if(response.status===429)throw new KisError('RATE_LIMIT','한국투자 호출 한도에 도달했습니다. 다음 자동 조회 때 재시도합니다.');
      if(!response.ok||String(data.rt_cd)!=='0')throw new KisError('QUOTE_RESPONSE','한국투자 시세 조회 실패입니다. 종목과 서비스 신청 상태를 확인하세요.');
      const price=validPrice(object(data.output).stck_prpr);
      // This REST response does not contain a last-trade timestamp. Explicitly label retrieval time.
      const time=new Date(clock()).toISOString();
      return {symbol:i.symbol,market:'KR',currency:'KRW',current_price:price,updated_at:time,fetched_at:time,source:'한국투자증권 · 조회 시점 현재가',delayed:false,time_basis:'retrieved'};
    }
    throw new KisError('QUOTE_RESPONSE','한국투자 시세 조회 실패입니다.');
  }};
  return {provider,async status(){if(!configured)return {configured:false,tokenExpiresAt:null};const active=await store.load(await keyId());return {configured:true,tokenExpiresAt:active?.expiresAt??null};}};
}
