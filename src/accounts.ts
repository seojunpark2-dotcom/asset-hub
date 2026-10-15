import {supabase} from './supabase';
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
export async function syncAccounts(force=false){return accountRequest<{errors:Record<string,string>}>({action:'sync',force});}
