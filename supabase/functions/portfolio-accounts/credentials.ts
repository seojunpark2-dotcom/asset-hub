type Env=(name:string)=>string|undefined;
export function credentialOwner(userId:string,env:Env){
 const owner=env('ACCOUNT_KEY_OWNER_USER_ID')?.trim();
 return !!owner&&owner===userId;
}
export function providerCredentials(provider:unknown,env:Env){
 const names=provider==='kiwoom'?['KIWOOM_APP_KEY','KIWOOM_APP_SECRET']:provider==='upbit'?['UPBIT_ACCESS_KEY','UPBIT_SECRET_KEY']:null;
 if(!names)return null;
 const access=env(names[0]!)?.trim()??'',secret=env(names[1]!)?.trim()??'';
 return access.length>0&&access.length<=2048&&secret.length>0&&secret.length<=2048?{access,secret}:null;
}
export function credentialDevice(userId:string,device:{user_id:string;local_snapshots:boolean}|null){
 return !!device&&device.user_id===userId&&device.local_snapshots===true;
}
