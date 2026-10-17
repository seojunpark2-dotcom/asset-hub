import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {credentialOwner,providerCredentials,credentialDevice} from './credentials.ts';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const messages:Record<string,string>={SETUP_REQUIRED:'고정 IP 서버와 해당 기관 API 키 설정이 필요합니다.',KEY_OR_IP:'API 키·만료일·허용 IP 설정을 확인하세요.',RATE_LIMIT:'기관 조회 한도에 도달했습니다. 잠시 후 다시 시도하세요.',SYNC_BUSY:'계좌 동기화 중입니다. 잠시 후 다시 시도하세요.',INCOMPLETE_BALANCE:'잔고의 전체 페이지를 확인하지 못해 기존 자산을 유지합니다.',UNSUPPORTED_ASSET:'현재 자동 연동은 키움 국내 현금 주식·ETF와 업비트 KRW 기준 코인을 지원합니다.',INVALID_BALANCE:'잔고 응답을 검증하지 못해 기존 자산을 유지합니다.',TOO_MANY_ASSETS:'현재 최대 49개 보유자산을 지원합니다.'};
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'POST 요청만 허용됩니다.'},405);
 const url=Deno.env.get('SUPABASE_URL')!;
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 try{
  const raw=await req.text();if(raw.length>65536)return json({error:'요청 크기가 너무 큽니다.'},413);
  const body=JSON.parse(raw);let userId:string;
  const background=['background','local-background','local-snapshot'].includes(body.action);
  if(background){
   const token=req.headers.get('X-Widget-Token')??'';if(!/^[0-9a-f]{64}$/.test(token))return json({error:'기기 인증이 필요합니다.'},401);
   const {data,error}=await admin.from('portfolio_widget_devices').select('user_id,local_snapshots').eq('id',body.deviceId).eq('token_hash',await hash(token)).gt('expires_at',new Date().toISOString()).maybeSingle();
   if(error||!data)return json({error:'앱을 열어 위젯 계좌 연결을 갱신하세요.'},401);userId=data.user_id;
   if(body.action==='local-snapshot'&&!data.local_snapshots)return json({error:'앱에서 집 Wi-Fi 계좌 동기화를 등록하세요.'},403);
  }else{
   const bearer=req.headers.get('Authorization')??'';if(!bearer.startsWith('Bearer '))return json({error:'로그인이 필요합니다.'},401);
   const {data,error}=await admin.auth.getUser(bearer.slice(7));if(error||!data.user)return json({error:'로그인을 다시 확인하세요.'},401);userId=data.user.id;
  }
  if(!['status','connect','sync','disconnect','device','revoke-device','background','local-background','local-snapshot','credential-status','credentials'].includes(body.action))return json({error:'지원하지 않는 요청입니다.'},400);
  if(body.action==='credential-status'||body.action==='credentials'){
   const env=(name:string)=>Deno.env.get(name);
   if(!credentialOwner(userId,env))return json({error:'키 수신 권한이 없습니다. ACCOUNT_KEY_OWNER_USER_ID를 본인 로그인 사용자 ID로 설정하세요.'},403);
   if(body.action==='credential-status')return json({configured:{kiwoom:!!providerCredentials('kiwoom',env),upbit:!!providerCredentials('upbit',env)}});
   const token=req.headers.get('X-Widget-Token')??'';
   if(!/^[0-9a-f]{64}$/.test(token)||typeof body.deviceId!=='string')return json({error:'기기 인증이 필요합니다.'},401);
   const {data:device,error}=await admin.from('portfolio_widget_devices').select('user_id,local_snapshots').eq('id',body.deviceId).eq('token_hash',await hash(token)).gt('expires_at',new Date().toISOString()).maybeSingle();
   if(error||!credentialDevice(userId,device))return json({error:'앱의 기기 연결을 갱신하세요.'},403);
   if(!['kiwoom','upbit'].includes(body.provider))return json({error:'지원하지 않는 기관입니다.'},400);
   const credentials=providerCredentials(body.provider,env);
   if(!credentials)return json({error:'Supabase Edge Functions Secrets에 해당 기관 키 두 개를 등록하세요.'},422);
   return json({ok:true,...credentials});
  }
  if(body.action==='device'){
   const backgroundAuth=Deno.env.get('ACCOUNT_WIDGET_ANON_JWT')??Deno.env.get('SUPABASE_ANON_KEY')??'';
   let role='';try{role=JSON.parse(atob(backgroundAuth.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role;}catch{}
   if(role!=='anon')return json({error:'위젯의 공개 JWT 설정을 확인하세요.'},503);
   if(!/^[0-9a-f-]{36}$/.test(body.deviceId??'')||!/^[0-9a-f]{64}$/.test(body.token??''))return json({error:'기기 정보가 잘못되었습니다.'},400);
   const {data:existing,error:readError}=await admin.from('portfolio_widget_devices').select('user_id').eq('id',body.deviceId).maybeSingle();
   if(readError||existing&&existing.user_id!==userId)return json({error:'기기 등록 실패'},403);
   const {count,error:countError}=await admin.from('portfolio_widget_devices').select('id',{count:'exact',head:true}).eq('user_id',userId);
   if(countError||!existing&&(count??0)>=10)return json({error:'기기 등록 한도에 도달했습니다.'},422);
   const row={id:body.deviceId,user_id:userId,token_hash:await hash(body.token),expires_at:new Date(Date.now()+365*86400000).toISOString(),local_snapshots:body.localSnapshots===true};
   const {error}=existing?await admin.from('portfolio_widget_devices').update(row).eq('id',body.deviceId).eq('user_id',userId):await admin.from('portfolio_widget_devices').insert(row);
   return error?json({error:'기기 등록 실패'},500):json({ok:true,backgroundAuth});
  }
  if(body.action==='revoke-device'){
   const {error}=await admin.from('portfolio_widget_devices').delete().eq('user_id',userId).eq('id',body.deviceId);return error?json({error:'기기 연결 해제 실패'},500):json({ok:true});
  }
  if(body.action==='disconnect'){
   if(!['kiwoom','upbit'].includes(body.provider))return json({error:'지원하지 않는 기관입니다.'},400);
   const {error}=await admin.rpc('portfolio_disconnect_account',{p_user:userId,p_provider:body.provider});return error?json({error:'연결 해제 실패'},500):json({ok:true});
  }
  const {data:connections,error:connectionError}=await admin.from('portfolio_connections').select('id,provider,enabled,last_synced_at').eq('user_id',userId);
  if(connectionError)return json({error:'계좌 연결 정보를 읽지 못했습니다.'},500);
  if(body.action==='local-snapshot'){
   if(!['kiwoom','upbit'].includes(body.provider)||!Array.isArray(body.positions)||body.positions.length>49)return json({error:'잘못된 잔고 정보'},422);
   const amount=(v:unknown,maxDigits:number)=>typeof v==='string'&&/^\d+(\.\d{1,12})?$/.test(v)&&v.split('.')[0].replace(/^0+/,'').length<=maxDigits;
   const seen=new Set<string>();
   for(const p of body.positions){
    if(!p||p.purchase_currency!=='KRW'||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||
     !amount(p.quantity,18)||Number(p.quantity)<=0||!amount(p.average_purchase_price,18)||!amount(p.original_investment_krw,60)||
     typeof p.symbol!=='string'||seen.has(p.symbol)||
     (body.provider==='kiwoom'? !['domestic_stock','domestic_etf'].includes(p.asset_type)||!/^[A-Z0-9]{6}$/.test(p.symbol):p.asset_type!=='crypto'||!/^KRW-[A-Z0-9]{2,15}$/.test(p.symbol)))return json({error:'잔고 검증 실패. 기존 자산을 유지합니다.'},422);
    seen.add(p.symbol);
   }
   const enabled=(connections??[]).some(c=>c.provider===body.provider&&c.enabled);
   if(!enabled&&body.replaceManual!==true)return json({error:'앱에서 수동 자산 교체에 동의하세요.'},422);
   const {error}=await admin.rpc('portfolio_commit_account',{p_user:userId,p_provider:body.provider,p_positions:body.positions,p_connect:!enabled});
   return error?json({error:'잔고 저장 실패. 기존 자산을 유지합니다.'},422):json({ok:true});
  }
  if(body.action==='local-background'){
   const {data:holdings,error}=await admin.from('portfolio_holdings_read').select('*').eq('user_id',userId).order('created_at');
   return error?json({error:'자산 조회 실패'},500):json({ok:true,holdings});
  }
  const gatewayUrl=Deno.env.get('ACCOUNT_GATEWAY_URL');const secret=Deno.env.get('ACCOUNT_GATEWAY_SECRET');
  const gateway=async(path:string,provider?:string)=>{
   if(!gatewayUrl||!secret)throw Error('SETUP_REQUIRED');const target=new URL(gatewayUrl);
   if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash||target.pathname!=='/')throw Error('SETUP_REQUIRED');
   const r=await fetch(new URL(path,target),{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({userId,provider}),redirect:'error',signal:AbortSignal.timeout(120000)});
   const data=await r.json();if(!r.ok||data.error)throw Error(data.error??'PROVIDER_UNAVAILABLE');return data;
  };
  if(body.action==='status'){
   let configured={kiwoom:false,upbit:false};let setupError='';
   try{const result=await gateway('/status');configured={kiwoom:result.providers?.kiwoom===true,upbit:result.providers?.upbit===true};}catch(e){setupError=messages[e instanceof Error?e.message:'']??'고정 IP 서버에 연결하지 못했습니다.';}
   return json({connections,configured,setupError,userId});
  }
  if(body.action==='connect'&&!['kiwoom','upbit'].includes(body.provider))return json({error:'지원하지 않는 기관입니다.'},400);
  if(body.action==='connect'&&body.replaceManual!==true)return json({error:'기존 수동 자산 교체에 동의해야 합니다.'},422);
  const targets=body.action==='connect'?[body.provider]:(connections??[]).filter(c=>c.enabled).map(c=>c.provider);
  const errors:Record<string,string>={};
  for(const provider of targets){
   const c=(connections??[]).find(c=>c.provider===provider);
   if(body.action!=='connect'&&!body.force&&c?.last_synced_at&&Date.now()-Date.parse(c.last_synced_at)<300000)continue;
   const {data:claimed,error:claimError}=await admin.rpc('portfolio_claim_quote',{p_key:'account:'+userId+':'+provider,p_seconds:30});
   if(claimError||!claimed){errors[provider]='계좌 동기화 대기 중입니다.';continue;}
   try{
    const result=await gateway('/snapshot',provider);
    if(result.complete!==true||!Array.isArray(result.positions)||result.positions.length>49)throw Error('INCOMPLETE_BALANCE');
    const {error}=await admin.rpc('portfolio_commit_account',{p_user:userId,p_provider:provider,p_positions:result.positions,p_connect:body.action==='connect'});
    if(error)throw Error('INVALID_BALANCE');
   }catch(e){errors[provider]=messages[e instanceof Error?e.message:'']??'계좌 조회에 실패해 기존 자산을 유지합니다.';}
  }
  if(body.action==='connect'&&Object.keys(errors).length)return json({error:errors[body.provider]},422);
  const {data:holdings,error}=await admin.from('portfolio_holdings_read').select('*').eq('user_id',userId).order('created_at');
  if(error)return json({error:'자산 조회 실패'},500);
  return json({ok:Object.keys(errors).length===0,errors,holdings,hasConnections:(connections??[]).some(c=>c.enabled)||body.action==='connect'});
 }catch{return json({error:'계좌 연동 서버 오류입니다. 잠시 후 다시 시도하세요.'},500);}
});
