import {requireOptionalNativeModule} from 'expo';
import {widgetSnapshot} from './widgetData';
import type {Holding,Quote} from './types';
import {accountRequest,homeAccounts,homeStatus} from './accounts';
import {supabase} from './supabase';
import type {AccountProvider} from './accounts';
interface WidgetBridge {setWidgetUser(userId:string):Promise<void>;updateWidget(userId:string,json:string):Promise<void>;setWidgetRefreshInput(userId:string,json:string):Promise<void>;pinWidget():Promise<boolean>;prepareWidgetAccountSync(userId:string,url:string,key:string):Promise<string>;setWidgetAccountAuthorization(userId:string,token:string):Promise<void>;clearWidgetAccountSync():Promise<void>;}
const native=requireOptionalNativeModule<WidgetBridge>('AssetExpiry');
let currentUser:string|null=null;let queue:Promise<unknown>=Promise.resolve();
let registeredUser:string|null=null;
let registeredDevice:string|null=null;
function serial<T>(task:()=>Promise<T>):Promise<T>{const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
export function setWidgetUser(userId:string|null){if(currentUser!==userId){registeredUser=null;registeredDevice=null;}currentUser=userId;return serial(async()=>{await native?.setWidgetUser(userId??'');});}
export function syncPortfolioWidget(userId:string,snapshot:ReturnType<typeof widgetSnapshot>){return serial(async()=>{if(currentUser===userId)await native?.updateWidget(userId,JSON.stringify(snapshot));});}
export function syncWidgetRefreshInput(userId:string,holdings:Holding[],quotes:Record<string,Quote>,colors:'kr'|'global'){
 const input=holdings.map(({id,name,asset_type,symbol,quantity,purchase_currency,original_investment_krw})=>({id,name,asset_type,symbol,quantity,purchase_currency,original_investment_krw}));
 return serial(async()=>{if(currentUser===userId)await native?.setWidgetRefreshInput(userId,JSON.stringify({holdings:input,quotes,colors}));});
}
export function registerWidgetAccountSync(userId:string){return serial(async()=>{
 if(currentUser!==userId||!native)return;
 if(registeredUser===userId){await homeAccounts?.ensureHomeAccounts();return;}
 const url=process.env.EXPO_PUBLIC_SUPABASE_URL;const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return;
 const data=JSON.parse(await native.prepareWidgetAccountSync(userId,url+'/functions/v1/portfolio-accounts',key));
 const local=await homeStatus();
 const credentialProviders=(['kiwoom','upbit'] as const).filter(p=>local.providers[p]?.configured);
 if(currentUser!==userId)return;
 const result=await accountRequest<{backgroundAuth:string}>({action:'device',...data,localSnapshots:true,credentialProviders});
 if(currentUser===userId){await native.setWidgetAccountAuthorization(userId,result.backgroundAuth);registeredUser=userId;registeredDevice=data.deviceId;await homeAccounts?.ensureHomeAccounts();}
});}
export async function clearWidgetAccountSync(){
 const deviceId=registeredDevice;registeredUser=null;registeredDevice=null;
 try{if(deviceId)await accountRequest({action:'revoke-device',deviceId});}finally{await native?.clearWidgetAccountSync();}
}
export async function pinPortfolioWidget(){if(!native)throw Error('업데이트 APK를 설치해주세요.');return native.pinWidget();}
export async function importSupabaseAccount(provider:AccountProvider){
 if(!supabase||!homeAccounts)throw Error('최신 Android APK에서 로그인하세요.');
 const {data,error}=await supabase.auth.getSession();const session=data.session;
 if(error||!session||currentUser!==session.user.id)throw Error('로그인을 다시 확인하세요.');
 await registerWidgetAccountSync(session.user.id);
 if(currentUser!==session.user.id)throw Error('로그인 계정이 변경되었습니다.');
 await homeAccounts.importSupabaseAccount(session.user.id,provider,session.access_token);
}
