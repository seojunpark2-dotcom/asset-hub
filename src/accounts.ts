import {supabase} from './supabase';
import {requireOptionalNativeModule} from 'expo';
export interface HomeStatus {ssid:string;ip:string;backgroundPermission:boolean;providers:Record<AccountProvider,{configured:boolean;lastDay:string;lastSynced:string;error:string}>;}
interface HomeBridge {homeAccountStatus():Promise<string>;registerHomeWifi():Promise<string>;saveHomeAccount(provider:string,access:string,secret:string):Promise<void>;removeHomeAccount(provider:string):Promise<void>;syncHomeAccounts():Promise<string>;ensureHomeAccounts():Promise<void>;}
export const homeAccounts=requireOptionalNativeModule<HomeBridge>('AssetExpiry');
export async function homeStatus():Promise<HomeStatus>{if(!homeAccounts)throw Error('최신 Android APK를 설치하세요.');return JSON.parse(await homeAccounts.homeAccountStatus());}
export type AccountProvider='kiwoom'|'upbit';
export interface AccountStatus {connections:{id:string;provider:AccountProvider;enabled:boolean;last_synced_at:string|null}[];configured:Record<AccountProvider,boolean>;setupError:string;userId:string;}
export async function accountRequest<T=Record<string,unknown>>(body:Record<string,unknown>):Promise<T>{
 if(!supabase)throw Error('서비스 연결이 필요합니다.');
 const {data,error}=await supabase.functions.invoke('portfolio-accounts',{body});
 if(error){
  let message='계좌 연동 서버에 연결하지 못했습니다.';
  try{const detail=await error.context?.json();if(typeof detail?.error==='string')message=detail.error;}catch{}
  throw Error(message);
 }
 if(data?.error)throw Error(data.error);return data as T;
}
export async function syncAccounts(){
 const errors:Record<string,string>={};if(!homeAccounts)return {errors};
 try{const status:HomeStatus=JSON.parse(await homeAccounts.syncHomeAccounts());for(const p of ['kiwoom','upbit'] as const)if(status.providers?.[p]?.error)errors[p]=status.providers[p].error;}catch{/* Away from home, preserve holdings and continue public quote refresh. */}
 return {errors};
}
