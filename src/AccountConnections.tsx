import React,{useCallback,useEffect,useState} from 'react';
import {Alert,AppState,Linking,PermissionsAndroid,Platform} from 'react-native';
import {Button,Card,Field,Label} from './ui';
import {accountRequest,homeAccounts,homeStatus,type AccountProvider,type HomeStatus} from './accounts';

export function AccountConnections({onSynced}:{onSynced:()=>Promise<void>}){
 const [status,setStatus]=useState<HomeStatus|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [provider,setProvider]=useState<AccountProvider|null>(null);const [access,setAccess]=useState('');const [secret,setSecret]=useState('');
 const load=useCallback(async()=>{try{setStatus(await homeStatus());}catch(e){setMessage(e instanceof Error?e.message:'설정 조회 실패');}},[]);
 useEffect(()=>{void load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void load();});return()=>sub.remove();},[load]);
 async function run(task:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{await task();setMessage(success);await load();}catch(e){setMessage(e instanceof Error?e.message:'설정 실패');}finally{setBusy(false);}}
 async function register(){
  if(Platform.OS!=='android'||!homeAccounts)throw Error('Android APK에서 이용하세요.');
  const permissions=await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
  if(permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]!=='granted')throw Error('Wi-Fi 확인을 위해 정확한 위치 권한을 허용하세요.');
  await homeAccounts.registerHomeWifi();
 }
 function save(){if(!provider||!homeAccounts)return;const selected=provider;const bridge=homeAccounts;
  Alert.alert('계좌 자동 연동',`${selected==='kiwoom'?'키움 국내 현금 주식·ETF':'업비트 KRW 코인'}의 수동 자산을 실제 잔고로 교체합니다. API 키는 이 휴대폰에 암호화해 보관합니다. 집 Wi-Fi에서 하루 한 번 성공한 잔고만 반영합니다.`,[{text:'취소',style:'cancel'},{text:'동의하고 저장',onPress:()=>void run(async()=>{
   await bridge.saveHomeAccount(selected,access,secret);setAccess('');setSecret('');setProvider(null);await bridge.syncHomeAccounts();await onSynced();
  },'설정을 저장했습니다. 아래 기관별 최근 동기화와 오류를 확인하세요.')}]);
 }
 return <Card><Label bold size={20}>계좌 자동 연동</Label>
  <Label muted size={12}>등록한 집 Wi-Fi와 공인 IP가 일치할 때 휴대폰에서 직접 조회합니다. 한국 날짜 기준 기관별 하루 한 번 성공하면 그날은 다시 조회하지 않습니다. 별도 중계 서버는 필요하지 않습니다.</Label>
  <Label bold>집 Wi-Fi · {status?.ssid||'등록 전'}</Label>
  {!!status?.ip&&<Label size={13}>기관 API 허용 IP에 등록할 주소: {status.ip}</Label>}
  <Button disabled={busy} title="현재 Wi-Fi를 집 Wi-Fi로 등록" onPress={()=>void run(register,'집 Wi-Fi를 등록했습니다. 표시된 공인 IP를 키움·업비트에 등록하세요.')}/>
  <Label muted size={12}>집 Wi-Fi에 연결하고 위치 기능을 켜세요. IP가 변경되면 기관의 허용 IP를 수정한 뒤 다시 등록하세요. IP 확인에는 ipify를 사용하며 API 키를 보내지 않습니다.</Label>
  <Label muted size={12}>화면이 꺼져 있을 때도 집 Wi-Fi를 확인하려면 Android 앱 권한에서 위치 → 항상 허용, 정확한 위치 사용을 켜주세요. 위치 좌표는 수집하지 않습니다.</Label>
  {status&&!status.backgroundPermission&&<Label>백그라운드 위치 권한이 필요합니다.</Label>}
  <Button secondary disabled={busy} title="위치 권한 설정 열기" onPress={()=>void Linking.openSettings()}/>
  {!!message&&<Label size={13}>{message}</Label>}
  {(['kiwoom','upbit'] as const).map(p=>{const record=status?.providers[p];return <Card key={p}>
   <Label bold>{p==='kiwoom'?'키움증권':'업비트'} · {record?.configured?'자동 조회 설정됨':'API 키 등록 필요'}</Label>
   <Label muted size={12}>{record?.lastSynced?'최근 동기화 '+new Date(record.lastSynced).toLocaleString('ko-KR'):'아직 계좌 동기화에 성공하지 않았습니다.'}</Label>
   {!!record?.error&&<Label size={13}>{record.error}</Label>}
   <Button secondary disabled={busy||!status?.ssid} title={record?.configured?'API 키 변경':'API 키 입력'} onPress={()=>{setAccess('');setSecret('');setProvider(p);}}/>
   {record?.configured&&<Button secondary disabled={busy} title="계좌 연결 해제" onPress={()=>Alert.alert('연결 해제','휴대폰의 API 키를 삭제하고 마지막 잔고를 수동 자산으로 유지합니다.',[{text:'취소',style:'cancel'},{text:'연결 해제',onPress:()=>void run(async()=>{await homeAccounts?.removeHomeAccount(p);await accountRequest({action:'disconnect',provider:p});await onSynced();},'자동 조회를 중단했습니다.')}])}/>}
  </Card>;})}
  {provider&&<Card><Label bold>{provider==='kiwoom'?'키움 실전 REST App Key·Secret':'업비트 자산조회 전용 Access Key·Secret'}</Label>
   <Field label={provider==='kiwoom'?'App Key':'Access Key'} value={access} onChange={setAccess} password/>
   <Field label={provider==='kiwoom'?'App Secret':'Secret Key'} value={secret} onChange={setSecret} password/>
   <Button disabled={busy||!access.trim()||!secret.trim()} title="동의 후 키 저장" onPress={save}/>
   <Button secondary disabled={busy} title="입력 취소" onPress={()=>{setAccess('');setSecret('');setProvider(null);}}/>
  </Card>}
  <Button secondary disabled={busy} title="오늘 동기화 상태 확인" onPress={()=>void run(async()=>{await homeAccounts?.syncHomeAccounts();await onSynced();},'오늘 상태를 확인했습니다. 이미 조회한 기관은 다시 조회하지 않습니다.')}/>
  <Label muted size={12}>Android가 약 15분 간격의 작업 기회에 집 Wi-Fi 여부를 확인하며 절전 상태에서는 지연됩니다. 조회 실패는 30분 이상 뒤 재시도합니다. 집에 연결되지 않은 날은 건너뛰고 과거 날짜를 몰아서 조회하지 않습니다. 시세 갱신 주기는 별도로 유지됩니다. 미래에셋·예수금·신용·해외주식 계좌 연동은 지원하지 않습니다.</Label>
 </Card>;
}
