import React,{useCallback,useEffect,useState} from 'react';
import {Alert} from 'react-native';
import {Button,Card,Label} from './ui';
import {accountRequest,type AccountProvider,type AccountStatus} from './accounts';
export function AccountConnections({onSynced}:{onSynced:()=>Promise<void>}){
 const [status,setStatus]=useState<AccountStatus|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const load=useCallback(async()=>{try{setStatus(await accountRequest<AccountStatus>({action:'status'}));}catch(e){setMessage(e instanceof Error?e.message:'연결 정보 조회 실패');}},[]);
 useEffect(()=>{void load();},[load]);
 async function run(body:Record<string,unknown>){
  setBusy(true);setMessage('');
  try{const result=await accountRequest<{errors?:Record<string,string>}>(body);setMessage(Object.values(result.errors??{}).join('\n')||'계좌 정보를 반영했습니다.');await load();await onSynced();}
  catch(e){setMessage(e instanceof Error?e.message:'계좌 연결 실패');}finally{setBusy(false);}
 }
 function connect(provider:AccountProvider){
  const label=provider==='kiwoom'?'키움증권 국내 주식·ETF':'업비트 코인';
  Alert.alert('보유자산 자동 연동',label+'의 수동 입력 자산을 실제 계좌 잔고로 교체합니다. 잔고 조회가 성공한 경우에만 적용하며 다른 기관의 자산은 유지됩니다.',[{text:'취소',style:'cancel'},{text:'계좌 연결',onPress:()=>void run({action:'connect',provider,replaceManual:true})}]);
 }
 return <Card><Label bold size={20}>계좌 자동 연동</Label>
  <Label muted size={12}>키움 국내 현금 주식·ETF와 업비트 KRW 기준 코인을 자동 등록합니다. API 비밀키는 본인 서버에 설정하며 앱에 입력하지 않습니다.</Label>
  {!!message&&<Label size={13}>{message}</Label>}
  {!!status?.setupError&&<Label size={13}>{status.setupError}</Label>}
  {(['kiwoom','upbit'] as const).map(provider=>{
   const account=status?.connections.find(c=>c.provider===provider&&c.enabled);const configured=status?.configured[provider]??false;
   return <Card key={provider}><Label bold>{provider==='kiwoom'?'키움증권':'업비트'} · {account?'연결됨':configured?'연결 가능':'연결 준비 필요'}</Label>
    {account?.last_synced_at&&<Label muted size={12}>최근 계좌 동기화 {new Date(account.last_synced_at).toLocaleString('ko-KR')}</Label>}
    {!configured&&<Label muted size={12}>고정 IP 서버와 API 키 설정을 완료한 뒤 연결 상태를 확인하세요.</Label>}
    {account?<><Button disabled={busy} title="지금 잔고 동기화" onPress={()=>void run({action:'sync',force:true})}/><Button secondary disabled={busy} title="계좌 연결 해제" onPress={()=>Alert.alert('연결 해제','자동 동기화를 중단하고 마지막 보유자산은 수동 자산으로 유지합니다.',[{text:'취소',style:'cancel'},{text:'연결 해제',onPress:()=>void run({action:'disconnect',provider})}])}/></>:<Button disabled={busy||!configured} title="계좌 연결 및 자산 가져오기" onPress={()=>connect(provider)}/>}
   </Card>;
  })}
  <Button secondary disabled={busy} title="연결 상태 다시 확인" onPress={()=>void load()}/>
  <Label muted size={12}>앱에서 시세를 갱신할 때 계좌 잔고도 동기화합니다(5분 재사용). 위젯은 자정 이후 계좌를 조회합니다. 매입원금이 0인 코인의 수익률은 —로 표시합니다. 예수금·신용거래·해외주식은 이번 자동 연동 범위에 포함하지 않습니다.</Label>
  {status&&<Label muted size={11}>서버 연결에 사용할 내 사용자 ID: {status.userId}</Label>}
 </Card>;
}
