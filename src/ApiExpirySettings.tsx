import React,{useEffect,useRef,useState} from 'react';
import {AppState,Linking} from 'react-native';
import {DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import {ApiExpiry,defaultApiExpiry,expiryLabel} from './apiExpiry';
import {allowExpiryNotifications,syncExpiryNotifications,openPhoneNotificationSettings} from './expiryNotifications';
import {Button,Card,Choices,Label} from './ui';
export function ApiExpirySettings({userId,value,ready,visible,onSave,onAutomatic}:{userId:string;value?:ApiExpiry;ready:boolean;visible:boolean;onSave:(value:ApiExpiry)=>Promise<void>;onAutomatic:(value:ApiExpiry)=>Promise<void>}){
 const date=value?.date??defaultApiExpiry.date;const enabled=value?.enabled??false;
 const [draft,setDraft]=useState(date);const [draftEnabled,setDraftEnabled]=useState(enabled);
 const [display,setDisplay]=useState<ApiExpiry>(value??defaultApiExpiry);const [message,setMessage]=useState('');const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [now,setNow]=useState(new Date());
 const pendingAutomatic=useRef<ApiExpiry|null>(null);
 const manualSaving=useRef(false);
 const automaticRef=useRef(onAutomatic);automaticRef.current=onAutomatic;
 useEffect(()=>{setDraft(date);setDraftEnabled(enabled);setDisplay(value??defaultApiExpiry);},[date,enabled,value?.lastNotifiedOn,value?.autoAdvancedFrom]);
 useEffect(()=>{
  if(!ready)return;let alive=true;let syncing=false;
  async function sync(){
   if(syncing||manualSaving.current)return;syncing=true;setNow(new Date());
   try{
    const result=await syncExpiryNotifications(userId,{date,enabled,lastNotifiedOn:value?.lastNotifiedOn,autoAdvancedFrom:value?.autoAdvancedFrom});
    if(!alive||manualSaving.current)return;setDisplay(result.expiry);
    setStatus(!enabled?'알림 꺼짐':!result.allowed?'휴대폰 알림 권한 또는 알림 채널이 꺼져 있습니다.':result.count?'만료 7일 전 알림 1개 예약됨':'예약할 알림이 없습니다. 만료일을 확인하세요.');
    if(result.expiry.date!==date||result.expiry.lastNotifiedOn!==value?.lastNotifiedOn||pendingAutomatic.current){
     pendingAutomatic.current=result.expiry;
     try{await automaticRef.current(result.expiry);pendingAutomatic.current=null;if(alive)setMessage('알림일 기준 2년 뒤로 자동 변경했습니다. 실제 이용기간은 포털에서 연장해주세요.');}
     catch{if(alive)setMessage('자동 변경 날짜는 이 휴대폰에 저장됐습니다. 서버 동기화는 연결 복구 후 진행됩니다.');}
    }
   }catch(e){if(alive)setStatus(e instanceof Error?e.message:'알림 예약에 실패했습니다.');}finally{syncing=false;}
  }
  void sync();const listener=AppState.addEventListener('change',state=>{if(state==='active')void sync();});
  const timer=setInterval(()=>{if(AppState.currentState==='active')void sync();},60000);
  return()=>{alive=false;listener.remove();clearInterval(timer);};
 },[userId,date,enabled,ready,value?.lastNotifiedOn,value?.autoAdvancedFrom]);
 async function save(){
  manualSaving.current=true;setBusy(true);setMessage('');
  try{
   const next={date:draft,enabled:draftEnabled};let allowed=true;if(next.enabled)allowed=await allowExpiryNotifications();
   await onSave(next);const result=await syncExpiryNotifications(userId,next,true);
   setDisplay(next);setStatus(!next.enabled?'알림 꺼짐':!result.allowed?'휴대폰 알림 권한이 꺼져 있습니다.':result.count?'만료 7일 전 알림 1개 예약됨':'예약할 알림이 없습니다. 날짜를 확인하세요.');
   setMessage(allowed?'저장했습니다.':'날짜는 저장했습니다. 아래 알림 설정에서 휴대폰 알림을 허용해주세요.');
  }catch(e){setMessage(e instanceof Error?e.message:'저장하지 못했습니다.');}finally{manualSaving.current=false;setBusy(false);}
 }
 function pick(){
  const parts=draft.split('-').map(Number);const selected=new Date(parts[0]!,parts[1]!-1,parts[2]!,12);
  DateTimePickerAndroid.open({value:selected,mode:'date',display:'calendar',minimumDate:new Date(2000,0,1),maximumDate:new Date(2099,11,31),positiveButton:{label:'선택'},negativeButton:{label:'취소'},onChange:(event,date)=>{
   if(event.type==='set'&&date)setDraft(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`);
  },onError:()=>setMessage('날짜 선택기를 열지 못했습니다. 다시 시도해주세요.')});
 }
 if(!visible)return null;
 let label='날짜 확인 필요';try{label=expiryLabel(display.date,now);}catch{}
 return <Card><Label bold>공공데이터 API 이용기간</Label><Label bold size={22}>{display.date}</Label><Label>{label}</Label>
  {!!display.lastNotifiedOn&&<Label muted size={12}>{display.lastNotifiedOn} 알림 후 앱의 만료예정일을 2년 뒤로 자동 변경했습니다.</Label>}
  <Button secondary title={'만료예정일 선택 · '+draft} disabled={busy||!ready} onPress={pick}/>
  <Label bold>만료 전 알림</Label><Choices items={[{value:'on',label:'켜기'},{value:'off',label:'끄기'}]} value={draftEnabled?'on':'off'} onChange={v=>setDraftEnabled(v==='on')}/>
  <Label muted size={12}>7일 전 오전 9시(한국시간)에 한 번 알립니다. 알림이 표시된 날을 기준으로 앱의 다음 만료일을 2년 뒤로 자동 설정합니다. 공공데이터포털의 실제 이용기간은 직접 연장해야 합니다.</Label>
  <Label size={13}>{status||'알림 상태 확인 중…'}</Label>{!!message&&<Label size={13}>{message}</Label>}
  <Button title={busy?'저장 중…':'만료일·알림 저장'} disabled={busy||!ready} onPress={()=>void save()}/>
  <Button secondary title="공공데이터포털 열기" onPress={()=>void Linking.openURL('https://www.data.go.kr').catch(()=>setMessage('브라우저에서 data.go.kr을 열어주세요.'))}/>
 </Card>;
}
export function NotificationSettings(){
 const [message,setMessage]=useState('');
 return <Card><Label bold>알림 설정</Label><Label muted size={12}>알림 허용과 소리는 휴대폰 설정에서 관리할 수 있습니다. 절전·강제 종료·알림 차단으로 알림이 지연되거나 표시되지 않을 수 있습니다.</Label>
 <Button secondary title="휴대폰 알림 설정 열기" onPress={()=>void openPhoneNotificationSettings().catch(()=>setMessage('휴대폰 설정 → 앱 → 통합 자산관리 → 알림에서 확인해주세요.'))}/>{!!message&&<Label size={13}>{message}</Label>}</Card>;
}
