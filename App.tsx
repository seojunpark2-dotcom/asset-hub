import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Pressable, RefreshControl, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './src/supabase';
import { Holding, Quote, Settings, assetLabels, marketOf, quoteKey } from './src/types';
import { valueHolding, summarize, money, pct, signedMoney, Valuation } from './src/finance';
import { cachedHoldings, loadHoldings, deleteHolding, getQuotes, readQuotes, cacheQuotes, loadSettings, saveSettings, clearCache } from './src/portfolio';
import { ThemeContext, Theme, Button, Card, Label, Field, Choices, useTheme } from './src/ui';
import { HoldingForm } from './src/HoldingForm';
import { Analysis } from './src/Charts';
import { NotificationSettings } from './src/NotificationSettings';
import { cleanupLegacyNotifications } from './src/legacyCleanup';
import {widgetSnapshot} from './src/widgetData';
import {AccountConnections,AccountSyncSummary} from './src/AccountConnections';
import {syncAccounts} from './src/accounts';
import {setWidgetUser,syncPortfolioWidget,syncWidgetRefreshInput,pinPortfolioWidget,registerWidgetAccountSync,clearWidgetAccountSync} from './src/portfolioWidget';
const light={bg:'#F4F6FA',card:'#FFFFFF',text:'#182337',muted:'#6D7A90',line:'#E7EBF2',accent:'#3366FF',gain:'#E44853',loss:'#2876DF'};
const dark={bg:'#101723',card:'#1B2536',text:'#F4F7FC',muted:'#A2AFC3',line:'#2C384E',accent:'#6488FF',gain:'#FF727C',loss:'#65A4FF'};
const defaults:Settings={dark:false,interval:60,colors:'kr'};
function errorMessage(e:unknown){return e instanceof Error?e.message:'연결하지 못했습니다. 잠시 후 다시 시도하세요.';}
function AuthScreen() {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [signup,setSignup]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function submit(){
    setBusy(true);setMessage('');
    try {
      if(!email.includes('@')||password.length<8)throw new Error('이메일과 8자 이상의 비밀번호를 입력하세요.');
      const result=signup?await supabase!.auth.signUp({email:email.trim(),password}):await supabase!.auth.signInWithPassword({email:email.trim(),password});
      if(result.error)throw result.error;
      if(signup&&!result.data.session)setMessage('인증 메일을 확인한 다음 로그인하세요.');
    } catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,paddingTop:60,gap:24}}>
    <Label color="#3366FF" bold>ASSET HUB</Label><Label bold size={32}>흩어진 자산을{ '\n' }하나의 화면으로</Label>
    <Label muted>주식 · ETF · 비트코인의 투자 현황을 확인하세요.</Label>
    <Card><Label bold size={22}>{signup?'계정 만들기':'로그인'}</Label><Field label="이메일" value={email} onChange={setEmail}/><Field label="비밀번호 (8자 이상)" value={password} onChange={setPassword} password/>
    {!!message&&<Label color="#E44853">{message}</Label>}<Button disabled={busy} title={busy?'처리 중…':signup?'회원가입':'로그인'} onPress={()=>void submit()}/>
    <Button disabled={busy} secondary title={signup?'기존 계정으로 로그인':'새 계정 만들기'} onPress={()=>{setSignup(!signup);setMessage('');}}/></Card>
    <Label muted size={12}>증권사 비밀번호나 인증서는 입력하지 않습니다. 보유수량과 매입가격을 직접 등록하는 앱입니다.</Label>
  </ScrollView>;
}
function Row({row,onPress}: {row:Valuation;onPress:()=>void}) {
  const t=useTheme();const color=row.profit?.gte(0)?t.gain:t.loss;
  return <Pressable accessibilityRole="button" accessibilityLabel={row.h.name+' 상세정보'} onPress={onPress}><Card><View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><View style={{flex:1}}><Label bold size={18}>{row.h.name}</Label><Label muted size={12}>{row.h.institution} · {row.h.symbol}</Label></View><View style={{alignItems:'flex-end'}}><Label bold size={18}>{money(row.value)}</Label><Label color={color}>{pct(row.percent)}</Label></View></View>
    <View style={{flexDirection:'row',justifyContent:'space-between'}}><Label muted size={12}>현재가 {money(row.quote?.current_price??null,row.h.purchase_currency)}</Label><Label size={13} color={color}>{signedMoney(row.profit)}</Label></View>
    <Label muted size={11}>{row.quote?(row.quote.stale?'마지막 정상 시세 · ':row.quote.delayed?'지연 / 일별 시세 · ':'최근 시세 · ')+new Date(row.quote.updated_at).toLocaleString('ko-KR'): '시세 확인 필요'}{row.fx?.stale?' · 환율 캐시':''}</Label>
  </Card></Pressable>;
}
function Detail({row,total,onEdit,onDelete,onClose}: {row:Valuation;total:ReturnType<typeof summarize>;onEdit:()=>void;onDelete:()=>void;onClose:()=>void}) {
  const fields=[['종목코드',row.h.symbol],['금융기관',row.h.institution],['자산 종류',assetLabels[row.h.asset_type]],['현재가격',money(row.quote?.current_price??null,row.h.purchase_currency)],['평균매입단가',money(row.h.average_purchase_price,row.h.purchase_currency)],['보유수량',row.h.quantity],['원화 투자원금',money(row.cost)],['평가금액',money(row.value)],['평가손익',signedMoney(row.profit)],['수익률',pct(row.percent)],['전체 비중',total.value?.gt(0)&&row.value?row.value.div(total.value).mul(100).toFixed(2)+'%':'—']];
  if(row.h.purchase_currency==='USD')fields.push(['적용 USD/KRW',row.fx?.current_price??'—'],['주가 변동 손익',signedMoney(row.stockProfit)],['환율 변동 손익',signedMoney(row.fxProfit)]);
  return <ScrollView contentContainerStyle={{padding:20,gap:18}}><Label bold size={28}>{row.h.name}</Label><Card>{fields.map(([label,value])=><View key={label} style={{flexDirection:'row',justifyContent:'space-between',gap:10}}><Label muted>{label}</Label><Label bold>{value}</Label></View>)}</Card>
    <Card><Label muted size={12}>시세 출처: {row.quote?.source??'조회 전'}{ '\n' }가격 기준: {row.quote?new Date(row.quote.updated_at).toLocaleString('ko-KR'):'—'}{ '\n' }조회 시각: {row.quote?new Date(row.quote.fetched_at).toLocaleString('ko-KR'):'—'}{ '\n' }{row.quote?.stale?'캐시 가격입니다. 최신 조회에 실패했습니다.':row.quote?.delayed?'일별 또는 지연 데이터입니다.':'공급자의 최근 거래가격입니다.'}</Label>{row.fx&&<Label muted size={12}>환율 기준일: {row.fx.updated_at.slice(0,10)} · 일별 기준환율</Label>}</Card>
    <Label muted size={12}>수수료·세금·배당은 계산에서 제외합니다. 주가/환율 손익은 원화 원금으로부터 산출한 매입 환율을 기준으로 분해합니다.</Label>
    {row.h.connection_id?<Label muted>계좌에서 자동으로 관리하는 자산입니다. 수량·매입원금은 계좌 동기화로 변경됩니다.</Label>:<><Button title="자산 수정" onPress={onEdit}/><Button title="자산 삭제" secondary onPress={onDelete}/></>}<Button title="닫기" secondary onPress={onClose}/>
  </ScrollView>;
}
function Portfolio({session}: {session:Session}) {
  const userId=session.user.id;
  const [settings,setSettings]=useState<Settings>(defaults);
  const [settingsReady,setSettingsReady]=useState(false);
  const theme:Theme={...(settings.dark?dark:light),...(settings.colors==='global'?{gain:'#15AB82',loss:'#E44853'}:{})};
  const [tab,setTab]=useState('홈');const [holdings,setHoldings]=useState<Holding[]>([]);const [quotes,setQuotes]=useState<Record<string,Quote>>({});
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [ready,setReady]=useState(false);
  const [form,setForm]=useState<Holding|true|null>(null);const [selected,setSelected]=useState<string|null>(null);
  const [sort,setSort]=useState('value');const running=useRef(false);const mounted=useRef(true);const quoteRef=useRef(quotes);
  useEffect(()=>{void cleanupLegacyNotifications().catch(()=>{if(mounted.current)setNotice('이전 알림 정리에 실패했습니다. 앱을 다시 열어주세요.');});},[userId]);
  useEffect(()=>{quoteRef.current=quotes;},[quotes]);
  const refresh=useCallback(async()=>{
    if(running.current||!mounted.current)return;running.current=true;setBusy(true);
    const notices:string[]=[];
    try {
      try{await registerWidgetAccountSync(userId);const sync=await syncAccounts();notices.push(...Object.values(sync.errors));}catch(e){notices.push(errorMessage(e));}
      try {const data=await loadHoldings(userId);if(mounted.current)setHoldings(data);}catch(e){notices.push('자산 동기화에 실패했습니다. 저장된 데이터를 표시합니다.');}
      try {
        const result=await getQuotes(quoteRef.current);
        const next=Object.fromEntries(Object.entries(quoteRef.current).map(([k,q])=>[k,{...q,stale:true}]));
        Object.assign(next,result.quotes);
        if(mounted.current){quoteRef.current=next;setQuotes(next);await cacheQuotes(userId,next);}
        notices.push(...Object.values(result.errors));
      }catch(e){
        if(mounted.current)setQuotes(prev=>Object.fromEntries(Object.entries(prev).map(([k,q])=>[k,{...q,stale:true}])));
        notices.push(errorMessage(e));
      }
      if(mounted.current)setNotice([...new Set(notices)].join('\n'));
    }finally{running.current=false;if(mounted.current){setBusy(false);setReady(true);}}
  },[userId]);
  useEffect(()=>{
    mounted.current=true;
    void (async()=>{try{
      const [hs,qs]=await Promise.all([cachedHoldings(userId),readQuotes(userId)]);
      if(mounted.current){setHoldings(hs);setQuotes(qs);quoteRef.current=qs;}
      try{const pref=await loadSettings(userId);if(mounted.current){setSettings({...defaults,...pref});setSettingsReady(true);}}catch{if(mounted.current)setNotice('설정을 불러오지 못했습니다. 앱을 다시 열어주세요.');}
    }catch{/* corrupted cache does not prevent loading server state */}finally{if(mounted.current)void refresh();}})();
    return()=>{mounted.current=false;};
  },[refresh,userId]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},settings.interval*1000);
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
    return()=>{clearInterval(timer);listener.remove();};
  },[refresh,settings.interval]);
  async function updateSettings(next:Settings){setSettings(next);try{await saveSettings(userId,next);}catch(e){setNotice('설정 저장 실패: '+errorMessage(e));}}
  const rows=useMemo(()=>holdings.map(h=>valueHolding(h,quotes)),[holdings,quotes]);const total=summarize(rows);
  const banks=[...new Set(holdings.map(h=>h.institution))].map(bank=>({bank,summary:summarize(rows.filter(r=>r.h.institution===bank))})).sort((a,b)=>a.summary.value===null?(b.summary.value===null?0:1):b.summary.value===null?-1:b.summary.value.cmp(a.summary.value));
  useEffect(()=>{if(ready)void syncPortfolioWidget(userId,widgetSnapshot(rows,settings.colors)).catch(()=>setNotice('위젯 갱신에 실패했습니다. 앱에서 다시 조회해주세요.'));},[userId,rows,ready,settings.colors]);
  useEffect(()=>{if(ready)void syncWidgetRefreshInput(userId,holdings,quotes,settings.colors).then(()=>registerWidgetAccountSync(userId)).catch(()=>setNotice('위젯 계좌 동기화 설정을 저장하지 못했습니다. 앱을 다시 열어주세요.'));},[userId,holdings,quotes,ready,settings.colors]);
  const ordered=[...rows].sort((a,b)=>{
    if(sort==='value')return (b.value?.toNumber()??-Infinity)-(a.value?.toNumber()??-Infinity);
    if(a.percent===null)return b.percent===null?0:1;if(b.percent===null)return -1;
    return sort==='low'?a.percent.cmp(b.percent):b.percent.cmp(a.percent);
  });
  useEffect(()=>{
    const openUrl=(url:string|null)=>{if(url?.startsWith('assethub://widget')){setTab('홈');void refresh();}};
    void Linking.getInitialURL().then(openUrl);
    const link=Linking.addEventListener('url',event=>openUrl(event.url));
    return()=>{link.remove();};
  },[refresh]);
  const detail=rows.find(r=>r.h.id===selected);
  function remove(h:Holding){
    Alert.alert('자산 삭제',h.name+'을 삭제할까요?',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void(async()=>{try{await deleteHolding(h);setHoldings(prev=>prev.filter(item=>item.id!==h.id));setSelected(null);await refresh();}catch(e){Alert.alert('삭제 실패',errorMessage(e));}})()}]);
  }
  return <ThemeContext.Provider value={theme}><SafeAreaView style={{flex:1,backgroundColor:theme.bg}} edges={['top','bottom']}><StatusBar barStyle={settings.dark?'light-content':'dark-content'}/>
    <View style={{paddingHorizontal:22,paddingTop:10,paddingBottom:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View><Label color={theme.accent} bold size={12}>ASSET HUB</Label><Label bold size={24}>{tab==='홈'?'내 투자 현황':tab}</Label></View>{busy&&<ActivityIndicator color={theme.accent}/>}</View>
    <ScrollView contentContainerStyle={{padding:18,gap:16,paddingBottom:30}} refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>void refresh()} tintColor={theme.accent}/>}>
      {!!notice&&<Card><Label size={13} color={theme.muted}>{notice}</Label><Button title="다시 조회" secondary disabled={busy} onPress={()=>void refresh()}/></Card>}
      {!ready&&!holdings.length&&<Label muted>자산을 불러오는 중입니다…</Label>}
      {tab==='홈'&&<>
        <Card style={{backgroundColor:theme.accent,borderColor:theme.accent}}><Label color="#DCE6FF">총 평가금액</Label><Label bold size={34} color="#FFFFFF">{money(total.value)}</Label>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}><Label color="#DCE6FF">총 투자원금</Label><Label color="#FFFFFF">{money(total.cost)}</Label></View>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}><Label color="#DCE6FF">평가손익</Label><View style={{backgroundColor:theme.card,borderRadius:8,paddingHorizontal:8,paddingVertical:3}}><Label bold color={total.profit?.gte(0)?theme.gain:theme.loss}>{signedMoney(total.profit)} ({pct(total.percent)})</Label></View></View>
          {total.missing>0&&<Label color="#FFFFFF" size={12}>시세 미확인 {total.missing}건 · 확인된 평가금액 {money(total.knownValue)}</Label>}
        </Card>
        {Object.values(quotes).some(q=>q.stale)&&<Label muted size={12}>일부 자산에 마지막 정상 시세를 사용합니다. 각 종목의 기준 시각을 확인하세요.</Label>}
        <Label bold size={20}>보유자산</Label>
      </>}
      {tab==='분석'&&<Analysis rows={rows}/>}
      {(tab==='홈'||tab==='자산')&&<>
        <Choices items={[{value:'value',label:'평가금액순'},{value:'high',label:'수익률 높은순'},{value:'low',label:'수익률 낮은순'}]} value={sort} onChange={setSort}/>
        {ordered.map(row=><Row key={row.h.id} row={row} onPress={()=>setSelected(row.h.id)}/>)}
        {ready&&!rows.length&&<Card><Label bold>{tab==='홈'?'자산 탭에서 첫 자산을 등록하세요':'첫 자산을 등록하세요'}</Label><Label muted>보유종목, 수량, 평균매입단가를 입력하면 투자 현황을 계산합니다.</Label></Card>}
        {tab==='자산'&&<Button title="+ 자산 추가" onPress={()=>setForm(true)}/>}
      </>}
      {tab==='홈'&&<>
        <Label bold size={20}>금융기관별 자산</Label>
        {banks.map(({bank,summary:s})=><Card key={bank}><Label bold>{bank}</Label><View style={{flexDirection:'row',justifyContent:'space-between'}}><Label bold>{money(s.value)}</Label><Label color={s.profit?.gte(0)?theme.gain:theme.loss}>{signedMoney(s.profit)} · {pct(s.percent)}</Label></View></Card>)}
      </>}
      {tab==='설정'&&<AccountSyncSummary/>}
      {tab==='설정'?<Card><Label bold>주식·ETF 시세 · Yahoo Finance</Label><Label muted>국내·미국 주식과 ETF는 휴대폰에서 야후 파이낸스로 직접 조회합니다. 별도 API 키나 계좌 등록은 필요하지 않습니다. 가격은 5분간 재사용하며 지연 시세일 수 있습니다. 종목별 가격 기준시각을 확인하세요.</Label></Card>:null}
      {tab==='설정'&&<>
        <AccountConnections onSynced={refresh}/>
        <Card><Label bold>화면 모드</Label><Choices items={[{value:'light',label:'라이트'},{value:'dark',label:'다크'}]} value={settings.dark?'dark':'light'} onChange={v=>void updateSettings({...settings,dark:v==='dark'})}/>
        <Label bold>수익·손실 색상</Label><Choices items={[{value:'kr',label:'수익 빨강 · 손실 파랑'},{value:'global',label:'수익 초록 · 손실 빨강'}]} value={settings.colors} onChange={v=>void updateSettings({...settings,colors:v as Settings['colors']})}/></Card>
        <Card><Label bold>시세 갱신 간격</Label><Choices items={[60,300,900].map(n=>({value:String(n),label:n===60?'1분':n/60+'분'}))} value={String(settings.interval)} onChange={v=>void updateSettings({...settings,interval:Number(v)})}/><Label muted size={12}>앱 화면의 자동 갱신 간격입니다. 주식·ETF는 Yahoo 시세를 5분간 재사용하며 기준환율은 일별 데이터입니다.</Label></Card>
        <Card><Label bold>위젯 자동 갱신</Label><Label>매일 자정 00:00 이후 · 한국 시간</Label><Label muted size={12}>위젯이 있으면 앱을 열지 않아도 하루 한 번 시세와 수익률을 갱신합니다. 절전이나 인터넷 연결 상태에 따라 늦어질 수 있습니다. 로그아웃하거나 위젯을 모두 삭제하면 중단합니다.</Label></Card>
        <NotificationSettings/>
        <Card><Label bold>보유자산 위젯</Label><Label muted size={12}>총평가금액, 전체 평가손익·수익률, 종목별 수익률을 홈 화면에서 확인합니다. 목록은 스크롤할 수 있습니다. 앱에서 조회한 최근 데이터를 표시하며 위젯을 누르면 앱을 열어 갱신합니다.</Label><Button title="홈 화면에 위젯 추가" onPress={()=>void pinPortfolioWidget().then(requested=>Alert.alert('위젯 추가',requested?'휴대폰에서 위젯 추가를 확인해주세요.':'홈 화면의 빈 공간을 길게 누른 뒤 위젯 → 통합 자산관리 → 보유자산을 선택해주세요.')).catch(e=>Alert.alert('위젯 추가',errorMessage(e)))}/></Card>
        <Card><Label bold>내 계정</Label><Label muted>{session.user.email}</Label><Button secondary title="로그아웃" onPress={()=>void(async()=>{try{await cleanupLegacyNotifications();await clearWidgetAccountSync().catch(()=>{});await clearCache(userId);const {error}=await supabase!.auth.signOut({scope:'local'});if(error)throw error;}catch(e){Alert.alert('로그아웃 실패',errorMessage(e));}})()}/></Card>
        <Card><Label bold>데이터 관리</Label><Button secondary title="기기 캐시 삭제" onPress={()=>void(async()=>{try{await clearCache(userId);setQuotes({});quoteRef.current={};setHoldings([]);await refresh();}catch(e){Alert.alert('오류',errorMessage(e));}})()}/><Label muted size={12}>서버에 저장된 자산은 유지됩니다. 자산 삭제는 상세화면에서 가능합니다.</Label></Card>
        <Label muted size={12}>수수료·세금·배당 제외. 미국주식은 USD, 국내주식·ETF와 업비트는 KRW 기준입니다. 자동 연동 자산의 수량·매입원금은 계좌 동기화로 변경됩니다.</Label>
      </>}
    </ScrollView>
    <View style={{flexDirection:'row',backgroundColor:theme.card,borderTopWidth:1,borderTopColor:theme.line,paddingVertical:12}}>{['홈','자산','분석','설정'].map((name,i)=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:tab===name}} onPress={()=>setTab(name)} style={{flex:1,alignItems:'center',paddingVertical:5,gap:3}}><Label size={21} color={tab===name?theme.accent:theme.muted}>{['⌂','▤','◉','⚙'][i]}</Label><Label bold size={12} color={tab===name?theme.accent:theme.muted}>{name}</Label></Pressable>)}</View>
    <Modal visible={form!==null} animationType="slide" onRequestClose={()=>setForm(null)}><SafeAreaView style={{flex:1,backgroundColor:theme.bg}}>{form&&<HoldingForm userId={userId} holding={form===true?undefined:form} onCancel={()=>setForm(null)} onDone={()=>{setForm(null);void(async()=>{try{setHoldings(await loadHoldings(userId));}catch(e){setNotice(errorMessage(e));}void refresh();})();}}/>}</SafeAreaView></Modal>
    <Modal visible={!!detail} animationType="slide" onRequestClose={()=>setSelected(null)}><SafeAreaView style={{flex:1,backgroundColor:theme.bg}}>{detail&&<Detail row={detail} total={total} onClose={()=>setSelected(null)} onEdit={()=>{setSelected(null);setForm(detail.h);}} onDelete={()=>remove(detail.h)}/>}</SafeAreaView></Modal>
  </SafeAreaView></ThemeContext.Provider>;
}
export default function App(){
  const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(true);const [failure,setFailure]=useState('');
  const authUser=useRef<string|null>(null);
  useEffect(()=>{
    if(!supabase){void setWidgetUser(null);setLoading(false);return;}
    let alive=true;
    void supabase.auth.getSession().then(({data,error})=>{if(alive){if(error)setFailure(error.message);authUser.current=data.session?.user.id??null;void setWidgetUser(authUser.current).catch(()=>{});setSession(data.session);setLoading(false);}}).catch(e=>{if(alive){void setWidgetUser(null).catch(()=>{});setFailure(errorMessage(e));setLoading(false);}});
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(alive){const previous=authUser.current;if(previous&&previous!==next?.user.id)void cleanupLegacyNotifications().catch(()=>{});authUser.current=next?.user.id??null;void setWidgetUser(authUser.current).catch(()=>{});setSession(next);}});
    if(AppState.currentState==='active')supabase.auth.startAutoRefresh();
    const listener=AppState.addEventListener('change',state=>{if(state==='active')supabase!.auth.startAutoRefresh();else supabase!.auth.stopAutoRefresh();});
    return()=>{alive=false;data.subscription.unsubscribe();listener.remove();supabase!.auth.stopAutoRefresh();};
  },[]);
  return <SafeAreaProvider>{session?<Portfolio key={session.user.id} session={session}/>:<ThemeContext.Provider value={light}><SafeAreaView style={{flex:1,backgroundColor:light.bg}}>{loading?<ActivityIndicator style={{flex:1}} color={light.accent}/>:!configured?<View style={{padding:24,gap:18}}><Label bold size={28}>통합 자산관리</Label><Card><Label bold>서비스 연결이 필요합니다</Label><Label muted>Supabase 프로젝트 URL과 공개 클라이언트 키를 설정한 후 앱을 다시 빌드하세요. 실제 연결 전에는 시세와 잔고를 표시하지 않습니다.</Label></Card></View>:<>{!!failure&&<Label color="#E44853">{failure}</Label>}<AuthScreen/></>}</SafeAreaView></ThemeContext.Provider>}</SafeAreaProvider>;
}
