import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Linking,PermissionsAndroid,Platform} from 'react-native';
import {Button,Card,Field,Label} from './ui';
import {accountRequest,homeAccounts,homeStatus,type AccountProvider,type HomeStatus,type AccountWifi} from './accounts';

import {importSupabaseAccount} from './portfolioWidget';
const koreanTime=(value:number|string)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'기록 없음';
export function AccountSyncSummary(){
 const [status,setStatus]=useState<HomeStatus|null>(null);const [error,setError]=useState('');const [checking,setChecking]=useState(false);
 const alive=useRef(true);const loading=useRef(false);
 const load=useCallback(async()=>{if(loading.current)return;loading.current=true;try{const next=await homeStatus();if(alive.current){setStatus(next);setError('');}}catch{if(alive.current)setError('조회 기록을 불러오지 못했습니다.');}finally{loading.current=false;}},[]);
 useEffect(()=>{
  alive.current=true;let active=true;const update=()=>{if(active&&AppState.currentState==='active')void load();};
  update();const timer=setInterval(update,10000);const listener=AppState.addEventListener('change',s=>{if(s==='active')update();});
  return()=>{active=false;alive.current=false;clearInterval(timer);listener.remove();};
 },[load]);
 async function check(){setChecking(true);setError('');try{if(!homeAccounts)throw Error('최신 Android APK를 설치하세요.');setStatus(JSON.parse(await homeAccounts.checkHomeNetwork()));}catch(e){setError(e instanceof Error?e.message:'IP 확인 실패');}finally{setChecking(false);}}
 async function retry(){setChecking(true);setError('');try{if(!homeAccounts)throw Error('최신 Android APK를 설치하세요.');setStatus(JSON.parse(await homeAccounts.retryHomeWidget()));}catch(e){setError(e instanceof Error?e.message:'위젯 재시도 실패');await load();}finally{setChecking(false);}}
 return <Card><Label bold size={20}>계좌 조회 현황</Label>
  <Label muted size={12}>한국 시간 · 등록 Wi-Fi에서 계좌·시세·위젯 하루 한 번 통합 갱신</Label>
  {(['kiwoom','upbit'] as const).map(p=>{const r=status?.providers[p];return <Card key={p}>
   <Label bold>{p==='kiwoom'?'키움증권':'업비트'}{r?.configured?'':' · 자동 조회 미설정'}</Label>
   <Label size={13}>최근 계좌 조회 실행: {koreanTime(r?.lastAttempt??0)}</Label>
   <Label size={13}>최근 동기화 성공: {koreanTime(r?.lastSynced??'')}</Label>
   <Label size={13}>최근 조회 사용 IP: {r?.usedIp||'조회 기록 없음'}</Label>
   <Label size={13}>최근 Supabase 키 수신: {koreanTime(r?.lastKeyFetched??0)}</Label>
   {!!r?.error&&<Label size={12}>{r.error}</Label>}
  </Card>;})}
  <Label size={13}>등록한 Wi-Fi: {status?.networks?.length??0}곳 · 아래 목록에서 이름과 IP 확인</Label>
  <Label size={13}>최근 확인 공인 IP: {status?.observedIp||'확인 전'}</Label>
  {!!status?.observedIp&&<Label muted size={12}>{status.observedSsid} · {koreanTime(status.ipCheckedAt)} 확인</Label>}
  {!!status?.networks?.length&&!!status.observedIp&&<Label size={13}>{status.networks.some(w=>w.ssid===status.observedSsid&&w.ip===status.observedIp)?'최근 확인 Wi-Fi와 IP가 등록 목록에 일치합니다.':'최근 확인 Wi-Fi·IP가 등록 목록에 없습니다. 등록 목록과 기관 허용 IP를 확인하세요.'}</Label>}
  <Button secondary disabled={checking} title={checking?'IP 확인 중…':'현재 Wi-Fi IP 확인'} onPress={()=>void check()}/>
  <Label size={13}>최근 통합 갱신일: {status?.dailyWifiDay||'완료 기록 없음'}</Label>
  <Label size={13}>하루 통합 위젯: {status?.widgetPending?'갱신 대기 · 계좌 재조회 없이 재시도':status?.widgetSyncedAt?'반영 완료':'반영 기록 없음'}</Label>
  {!!status?.widgetStage&&<Label size={13}>위젯 처리 단계: {status.widgetStage}</Label>}
  {!!status?.widgetAttempt&&<Label size={13}>최근 위젯 시도: {koreanTime(status.widgetAttempt)}</Label>}
  {!!status?.widgetError&&<Label size={13}>위젯 갱신 오류: {status.widgetError}</Label>}
  {status?.widgetPending&&<><Button secondary disabled={checking} title={checking?'확인 중…':'위젯 갱신 다시 시도'} onPress={()=>void retry()}/><Label muted size={12}>등록 Wi-Fi에서 저장된 계좌 자료로 재시도합니다. 계좌를 다시 조회하지 않으며 연속 재시도는 1분 간격입니다.</Label></>}
  {!!status?.widgetSyncedAt&&<Label muted size={12}>최근 위젯 반영: {koreanTime(status.widgetSyncedAt)}</Label>}
  {!!error&&<Label size={13}>{error}</Label>}
 </Card>;
}

export function AccountConnections({onSynced}:{onSynced:()=>Promise<void>}){
 const [status,setStatus]=useState<HomeStatus|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [cloud,setCloud]=useState<Record<AccountProvider,boolean>|null>(null);const [cloudError,setCloudError]=useState('');
 const [editing,setEditing]=useState<AccountWifi|null>(null);
 const load=useCallback(async()=>{const [local,remote]=await Promise.allSettled([homeStatus(),accountRequest<{configured:Record<AccountProvider,boolean>}>({action:'credential-status'})]);if(local.status==='fulfilled')setStatus(local.value);else setMessage('설정 조회 실패');if(remote.status==='fulfilled'){setCloud(remote.value.configured);setCloudError('');}else{setCloud(null);setCloudError(remote.reason instanceof Error?remote.reason.message:'서버 키 설정 조회 실패');}},[]);
 useEffect(()=>{void load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void load();});return()=>sub.remove();},[load]);
 async function run(task:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{await task();setMessage(success);await load();}catch(e){setMessage(e instanceof Error?e.message:'설정 실패');}finally{setBusy(false);}}
 async function register(){
  if(Platform.OS!=='android'||!homeAccounts)throw Error('Android APK에서 이용하세요.');
  const permissions=await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
  if(permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]!=='granted')throw Error('Wi-Fi 확인을 위해 정확한 위치 권한을 허용하세요.');
  await homeAccounts.registerHomeWifi();
 }
 function save(selected:AccountProvider){if(!homeAccounts)return;const bridge=homeAccounts;
  Alert.alert('계좌 자동 조회 연결',`이 기기가 계좌 조회 전 Supabase에서 해당 기관의 최신 키를 자동 수신하도록 허용합니다. ${selected==='kiwoom'?'키움 국내 현금 주식·ETF':'업비트 KRW 코인'}의 수동 자산을 실제 잔고로 교체하는 데 동의합니다.`,[{text:'취소',style:'cancel'},{text:'동의하고 연결',onPress:()=>void run(async()=>{
   await importSupabaseAccount(selected);await bridge.syncHomeAccounts();await onSynced();
  },'키를 안전하게 저장했습니다. 기관별 최근 동기화와 오류를 확인하세요.')}]);
 }
 return <Card><Label bold size={20}>계좌 자동 연동</Label>
  <Label muted size={12}>등록한 Wi-Fi 이름과 공인 IP 조합이 일치할 때 휴대폰에서 직접 조회합니다. 여러 장소를 이동해도 한국 날짜 기준 기관별 하루 한 번만 정상 잔고를 가져옵니다. 별도 중계 서버는 필요하지 않습니다.</Label>
  <Label bold>조회 허용 Wi-Fi · {status?.networks?.length??0}/10곳</Label>
  <Button disabled={busy} title="현재 Wi-Fi 추가" onPress={()=>void run(register,'현재 Wi-Fi를 목록에 추가했습니다. 해당 공인 IP를 키움·업비트에도 등록하세요.')}/>
  {(status?.networks??[]).map(w=><Card key={w.id}>
   <Label bold>{w.label}</Label><Label size={13}>Wi-Fi 이름: {w.ssid}</Label><Label size={13}>공인 IPv4: {w.ip}</Label>
   <Button secondary disabled={busy} title={`${w.label} 수정`} onPress={()=>setEditing({...w})}/>
   <Button secondary disabled={busy} title={`${w.label} 삭제`} onPress={()=>Alert.alert('Wi-Fi 삭제',`${w.label}을 조회 허용 목록에서 삭제합니다. API 키와 오늘의 조회 기록은 유지합니다. 마지막 Wi-Fi를 삭제하면 계좌 자동 조회가 중단됩니다.`,[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>void run(async()=>{await homeAccounts?.removeAccountWifi(w.id);if(editing?.id===w.id)setEditing(null);},'Wi-Fi를 목록에서 삭제했습니다.')}])}/>
  </Card>)}
  {editing&&<Card><Label bold>Wi-Fi 등록 정보 수정</Label>
   <Field label="별칭 (예: 집, 회사)" value={editing.label} onChange={v=>setEditing({...editing,label:v})}/>
   <Field label="Wi-Fi 이름 (SSID)" value={editing.ssid} onChange={v=>setEditing({...editing,ssid:v})}/>
   <Field label="공인 IPv4" value={editing.ip} onChange={v=>setEditing({...editing,ip:v})}/>
   <Button disabled={busy} title="Wi-Fi 수정 저장" onPress={()=>void run(async()=>{if(!homeAccounts)throw Error('최신 APK를 설치하세요.');await homeAccounts.updateAccountWifi(editing.id,editing.label,editing.ssid,editing.ip);setEditing(null);},'Wi-Fi를 수정했습니다. 변경한 IP를 기관 허용 목록에도 등록하세요.')}/>
   <Button secondary disabled={busy} title="수정 취소" onPress={()=>setEditing(null)}/>
  </Card>}
  <Label muted size={12}>추가할 Wi-Fi에 연결하고 위치 기능을 켜세요. 최대 10개 조합을 등록할 수 있으며 같은 이름에 여러 IP도 등록 가능합니다. 각 공인 IP는 키움·업비트의 허용 목록에도 등록해야 합니다. IP 변경 시 목록에서 수정하세요. IP 확인에는 ipify를 사용하며 API 키를 보내지 않습니다.</Label>
  <Label muted size={12}>화면이 꺼져 있을 때도 Wi-Fi를 확인하려면 Android 앱 권한에서 위치 → 항상 허용, 정확한 위치 사용을 켜주세요. 위치 좌표는 수집하지 않습니다.</Label>
  {status&&!status.backgroundPermission&&<Label>백그라운드 위치 권한이 필요합니다.</Label>}
  <Button secondary disabled={busy} title="위치 권한 설정 열기" onPress={()=>void Linking.openSettings()}/>
  {!!message&&<Label size={13}>{message}</Label>}
  {(['kiwoom','upbit'] as const).map(p=>{const record=status?.providers[p];return <Card key={p}>
   <Label bold>{p==='kiwoom'?'키움증권':'업비트'} · {record?.configured?(status?.networks?.length?'자동 조회 설정됨':'Wi-Fi 등록 대기'):'API 키 등록 필요'}</Label>
   <Label muted size={12}>{record?.lastSynced?'최근 동기화 '+new Date(record.lastSynced).toLocaleString('ko-KR'):'아직 계좌 동기화에 성공하지 않았습니다.'}</Label>
   <Label muted size={12}>Supabase 키: {cloud?.[p]?'등록됨':'미등록 또는 확인 필요'}</Label>
   {!!record?.error&&<Label size={13}>{record.error}</Label>}
   <Button secondary disabled={busy||!status?.networks?.length||!cloud?.[p]} title={record?.configured?'자동 조회 연결 갱신':'계좌 자동 조회 연결'} onPress={()=>save(p)}/>
   {(record?.configured||record?.lastSynced)&&<Button secondary disabled={busy} title="계좌 연결 해제" onPress={()=>Alert.alert('연결 해제','휴대폰의 API 키를 삭제하고 마지막 잔고를 수동 자산으로 유지합니다.',[{text:'취소',style:'cancel'},{text:'연결 해제',onPress:()=>void run(async()=>{await homeAccounts?.removeHomeAccount(p);await accountRequest({action:'disconnect',provider:p});await onSynced();},'자동 조회를 중단했습니다.')}])}/>}
  </Card>;})}
  <Label muted size={12}>최초 한 번 기관별 자동 조회를 연결하면 실제 계좌 조회 전마다 Supabase에서 최신 키를 받습니다. 이후 Secrets에서 키를 교체해도 앱에 다시 입력할 필요가 없습니다. 키 수신 실패 시 이전 키로 조회하지 않고 기존 자산을 유지합니다. 연결 해제는 이 기관의 자동 키 수신 권한도 해제하며 서버 Secrets는 유지합니다.</Label>
  <Label muted size={12}>키움: KIWOOM_APP_KEY · KIWOOM_APP_SECRET{ '\n' }업비트: UPBIT_ACCESS_KEY · UPBIT_SECRET_KEY</Label>
  {!!cloudError&&<Label size={13}>{cloudError}</Label>}
  <Button secondary disabled={busy} title="Supabase 키 등록 상태 확인" onPress={()=>void run(load,'서버 키 등록 상태를 확인했습니다.')}/>
  <Button secondary disabled={busy} title="오늘 동기화 상태 확인" onPress={()=>void run(async()=>{await homeAccounts?.syncHomeAccounts();await onSynced();},'오늘 상태를 확인했습니다. 이미 조회한 기관은 다시 조회하지 않습니다.')}/>
  <Label muted size={12}>Android가 약 15분 간격의 작업 기회에 등록 Wi-Fi 여부를 확인하며 절전 상태에서는 지연됩니다. 조회 실패는 30분 이상 뒤 재시도합니다. 등록된 곳에 연결되지 않은 날은 건너뛰고 과거 날짜를 몰아서 조회하지 않습니다. Wi-Fi 추가·수정·삭제로 하루 한 번 제한이 초기화되지 않습니다. 계좌·위젯 시세·수익률을 한 작업으로 하루 한 번 갱신합니다. 별도 자정 위젯 작업은 없으며 앱 화면의 1·5·15분 시세 갱신은 위젯을 변경하지 않습니다. 미래에셋·예수금·신용·해외주식 계좌 연동은 지원하지 않습니다.</Label>
 </Card>;
}
