import type {KisStore,KisSession} from './kis.ts';
interface RpcClient {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>;}
export function databaseKisStore(client:RpcClient):KisStore {
  async function rpc(name:string,args:Record<string,unknown>){const result=await client.rpc(name,args);if(result.error)throw new Error('한국투자 인증 저장소 연결 오류');return result.data;}
  return {
    async load(key){const data=await rpc('portfolio_kis_session_read',{p_key:key});if(!data||typeof data!=='object')return null;const s=data as Record<string,unknown>;return typeof s.token==='string'&&typeof s.expiresAt==='string'?{token:s.token,expiresAt:s.expiresAt}:null;},
    async claim(key,owner){return await rpc('portfolio_kis_session_claim',{p_key:key,p_owner:owner})===true;},
    async save(key,owner,session:KisSession){return await rpc('portfolio_kis_session_save',{p_key:key,p_owner:owner,p_token:session.token,p_expires:session.expiresAt})===true;},
    async invalidate(key,token){await rpc('portfolio_kis_session_invalidate',{p_key:key,p_token:token});},
  };
}
