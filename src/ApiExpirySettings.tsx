import React,{useEffect,useState} from 'react';
import {AppState,Linking} from 'react-native';
import {ApiExpiry,defaultApiExpiry,expiryDate,expiryLabel} from './apiExpiry';
import {allowExpiryNotifications,syncExpiryNotifications,testExpiryNotification} from './expiryNotifications';
import {Button,Card,Choices,Field,Label} from './ui';
export function ApiExpirySettings({userId,value,ready,visible,onSave}:{userId:string;value?:ApiExpiry;ready:boolean;visible:boolean;onSave:(value:ApiExpiry)=>Promise<void>}){
 const date=value?.date??defaultApiExpiry.date;const enabled=value?.enabled??false;
 const [draft,setDraft]=useState(date);const [draftEnabled,setDraftEnabled]=useState(enabled);
 const [message,setMessage]=useState('');const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [now,setNow]=useState(new Date());
 useEffect(()=>{setDraft(date);setDraftEnabled(enabled);},[date,enabled]);
 useEffect(()=>{
  if(!ready)return;
  let alive=true;
  async function sync(){
   setNow(new Date());
   try{const result=await syncExpiryNotifications(userId,{date,enabled});if(alive)setStatus(!enabled?'알림 꺼짐':!result.allowed?'휴대폰 알림 권한이 꺼져 있습니다.':result.count?'예약된 알림 '+result.count+'개':'앞으로 예약할 알림이 없습니다. 만료일을 확인하세요.');}
   catch{if(alive)setStatus('알림 예약에 실패했습니다. 알림 설정을 확인한 뒤 다시 저장해주세요.');}
  }
  void sync();
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void sync();});
  const timer=setInterval(()=>{if(AppState.currentState==='active')setNow(new Date());},60000);
  return()=>{alive=false;listener.remove();clearInterval(timer);};
 },[userId,date,enabled,ready]);
 async function save(){
  setBusy(true);setMessage('');
  try{
   const next={date:expiryDate(draft.trim()),enabled:draftEnabled};
   let allowed=true;if(next.enabled)allowed=await allowExpiryNotifications();
   await onSave(next);
   const result=await syncExpiryNotifications(userId,next);
   setStatus(!next.enabled?'알림 꺼짐':!result.allowed?'휴대폰 알림 권한이 꺼져 있습니다.':'예약된 알림 '+result.count+'개');
   setMessage(allowed?'저장했습니다. 연장 후에는 새 만료일을 입력해주세요.':'만료일은 저장했습니다. 휴대폰 설정에서 알림을 허용해주세요.');
  }catch(e){setMessage(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해주세요.');}finally{setBusy(false);}
 }
 if(!visible)return null;
 let label='날짜 확인 필요';try{label=expiryLabel(date,now);}catch{/* corrupted settings can be corrected with the form */}
 return <Card><Label bold>공공데이터 API 이용기간</Label><Label bold size={22}>{date}</Label><Label>{label}</Label>
  <Label muted size={12}>공공데이터포털에서 확인한 만료예정일입니다. 실제 승인 상태나 키 만료 여부를 자동 조회하지 않습니다.</Label>
  <Field label="만료예정일 (YYYY-MM-DD)" value={draft} onChange={setDraft}/>
  <Label bold>만료 전 알림</Label><Choices items={[{value:'on',label:'켜기'},{value:'off',label:'끄기'}]} value={draftEnabled?'on':'off'} onChange={v=>setDraftEnabled(v==='on')}/>
  <Label muted size={12}>30일 전 · 7일 전 · 1일 전 · 당일 오전 9시(한국시간). 지나간 알림은 예약하지 않습니다. 절전·알림 차단·강제 종료로 알림이 지연되거나 표시되지 않을 수 있습니다.</Label>
  <Label size={13}>{status||'알림 상태 확인 중…'}</Label>{!!message&&<Label size={13}>{message}</Label>}
  <Button title={busy?'저장 중…':'만료일·알림 저장'} disabled={busy||!ready} onPress={()=>void save()}/>
  <Button secondary title="테스트 알림 보내기 (5초 후)" disabled={busy} onPress={()=>void testExpiryNotification().then(()=>setMessage('5초 뒤 테스트 알림을 보냅니다.')).catch(e=>setMessage(e instanceof Error?e.message:'테스트 알림 실패'))}/>
  <Button secondary title="휴대폰 알림 설정 열기" onPress={()=>void Linking.openSettings().catch(()=>setMessage('휴대폰 설정 → 앱 → 통합 자산관리 → 알림에서 허용해주세요.'))}/>
  <Button secondary title="공공데이터포털 열기" onPress={()=>void Linking.openURL('https://www.data.go.kr').catch(()=>setMessage('브라우저에서 data.go.kr을 열어주세요.'))}/>
 </Card>;
}