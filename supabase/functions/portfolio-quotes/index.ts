import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { providers, Quote, Instrument } from '../_shared/providers.ts';
const headers={'Content-Type':'application/json'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req)=>{
  if(req.method!=='POST')return respond({error:'POST 요청만 허용됩니다.'},405);
  const authorization=req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return respond({error:'로그인이 필요합니다.'},401);
  try {
    const url=Deno.env.get('SUPABASE_URL')!;
    const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:userData,error:authError}=await client.auth.getUser();
    if(authError||!userData.user)return respond({error:'로그인을 다시 확인하세요.'},401);
    const {data:holdings,error}=await client.from('portfolio_holdings_read').select('symbol,asset_type,purchase_currency').eq('user_id',userData.user.id);
    if(error)return respond({error:'자산 데이터를 불러올 수 없습니다.'},500);
    const instruments=new Map<string,Instrument>();
    for(const h of holdings??[]){
      const market=h.asset_type==='crypto'?'UPBIT':h.asset_type.startsWith('domestic')?'KR':'US';
      instruments.set(market+':'+h.symbol,{symbol:h.symbol,market,asset_type:h.asset_type});
      if(h.purchase_currency==='USD')instruments.set('FX:USD/KRW',{symbol:'USD/KRW',market:'FX'});
    }
    if(instruments.size>50)return respond({error:'최대 49개의 서로 다른 종목을 지원합니다.'},422);
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const available=providers(name=>Deno.env.get(name));
    const quotes:Quote[]=[];const errors:Record<string,string>={};
    // Sequential requests keep provider bursts below the personal-use limits.
    for(const [key,instrument] of instruments){
      const provider=available.find(p=>p.supports(instrument));
      if(!provider){errors[key]='지원하지 않는 시장입니다.';continue;}
      const {data:cached,error:cacheError}=await admin.from('portfolio_quote_cache').select('*').eq('market',instrument.market).eq('symbol',instrument.symbol).maybeSingle();
      if(cacheError){errors[key]='시세 캐시를 읽지 못했습니다.';continue;}
      if(cached && Date.now()-Date.parse(cached.fetched_at)<provider.ttl*1000){quotes.push(cached);continue;}
      const {data:claimed,error:lockError}=await admin.rpc('portfolio_claim_quote',{p_key:key,p_seconds:Math.min(provider.ttl,60)});
      if(lockError||!claimed){if(cached)quotes.push({...cached,stale:true});errors[key]='시세 갱신 대기 중입니다.';continue;}
      try {
        const budgets:Record<string,[number,number]>={US:[55,60],KR:[100,3600],UPBIT:[120,60],FX:[4,3600]};
        const [limit,window]=budgets[instrument.market]!;
        const {data:budget,error:budgetError}=await admin.rpc('portfolio_claim_budget',{p_provider:instrument.market,p_limit:limit,p_window:window});
        if(budgetError||!budget){if(cached)quotes.push({...cached,stale:true});errors[key]='공급자 호출 한도에 도달했습니다. 잠시 후 갱신됩니다.';continue;}
        const q=await provider.get(instrument);
        const {error:writeError}=await admin.from('portfolio_quote_cache').upsert(q,{onConflict:'market,symbol'});
        if(writeError)errors[key]='시세를 조회했지만 캐시 저장에 실패했습니다.';
        quotes.push(q);
      }catch(e){
        if(cached)quotes.push({...cached,stale:true});
        errors[key]=instrument.symbol+': '+(e instanceof Error?e.message:'시세 조회 실패');
      }
    }
    return respond({quotes,errors});
  }catch{return respond({error:'시세 서버 오류입니다. 잠시 후 다시 시도하세요.'},500);}
});
