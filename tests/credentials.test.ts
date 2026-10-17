import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {credentialOwner,providerCredentials,credentialDevice} from '../supabase/functions/portfolio-accounts/credentials';

test('credential endpoint requires owner JWT plus valid scoped, unexpired device; never exposes other provider keys',async()=>{
 const env:Record<string,string>={ACCOUNT_KEY_OWNER_USER_ID:'owner',KIWOOM_APP_KEY:'dummy-access',KIWOOM_APP_SECRET:'dummy-secret',UPBIT_ACCESS_KEY:'dummy-upbit',UPBIT_SECRET_KEY:'dummy-upbit-secret'};
 let handler:(req:Request)=>Promise<Response>;
 let valid=true,scope=true,deviceOwner='owner';
 const admin={auth:{getUser:async(jwt:string)=>({data:{user:jwt==='owner-jwt'?{id:'owner'}:jwt==='other-jwt'?{id:'other'}:null},error:null})},from:()=>{
  const q={select:()=>q,eq:()=>q,gt:()=>q,maybeSingle:async()=>({data:valid?{user_id:deviceOwner,local_snapshots:scope}:null,error:null})};return q;
 }};
 const source=fs.readFileSync('supabase/functions/portfolio-accounts/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
 const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
 new Function('Deno','createClient','credentialOwner','providerCredentials','credentialDevice',compiled)({env:{get:(k:string)=>env[k]},serve:(h:typeof handler)=>{handler=h;}},()=>admin,credentialOwner,providerCredentials,credentialDevice);
 const call=async(jwt='owner-jwt',action='credentials',provider='kiwoom',token='a'.repeat(64))=>handler!(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer '+jwt,'X-Widget-Token':token},body:JSON.stringify({action,provider,deviceId:'device'})}));
 assert.equal((await call('anon')).status,401);
 assert.equal((await call('other-jwt')).status,403);
 assert.equal((await call('owner-jwt','credentials','kiwoom','')).status,401);
 valid=false;assert.equal((await call()).status,403);valid=true;
 scope=false;assert.equal((await call()).status,403);scope=true;
 deviceOwner='other';assert.equal((await call()).status,403);deviceOwner='owner';
 const status=await call('owner-jwt','credential-status');assert.deepEqual(await status.json(),{configured:{kiwoom:true,upbit:true}});
 const allowed=await call();assert.equal(allowed.status,200);assert.equal(allowed.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(await allowed.json(),{ok:true,access:'dummy-access',secret:'dummy-secret'});
 assert.deepEqual(await (await call('owner-jwt','credentials','upbit')).json(),{ok:true,access:'dummy-upbit',secret:'dummy-upbit-secret'});
 assert.equal((await call('owner-jwt','credentials','unknown')).status,400);
 delete env.KIWOOM_APP_SECRET;assert.equal((await call()).status,422);
 delete env.ACCOUNT_KEY_OWNER_USER_ID;assert.equal((await call()).status,403);
 assert.equal((await handler!(new Request('https://example.com'))).status,405);
});
