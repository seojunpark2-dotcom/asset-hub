import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {AccountAdapters,AccountError,type Provider} from './adapters.ts';
export function gateway(env:Record<string,string|undefined>,adapters=new AccountAdapters(env)){
 if(!env.GATEWAY_SHARED_SECRET||env.GATEWAY_SHARED_SECRET.length<32||!/^[-0-9a-f]{36}$/i.test(env.ACCOUNT_OWNER_USER_ID??''))throw Error('Set gateway secret and owner user ID');
 let busy=false;
 const server=createServer(async(req:IncomingMessage,res:ServerResponse)=>{
  const send=(data:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const supplied=Buffer.from(req.headers.authorization??'');const expected=Buffer.from('Bearer '+env.GATEWAY_SHARED_SECRET);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send({error:'UNAUTHORIZED'},401);
  if(req.method!=='POST'||!['/status','/snapshot'].includes(req.url??''))return send({error:'NOT_FOUND'},404);
  let size=0;const chunks:Buffer[]=[];
  try{
   for await(const chunk of req){size+=chunk.length;if(size>2048)return send({error:'INVALID_REQUEST'},413);chunks.push(chunk);}
   const body=JSON.parse(Buffer.concat(chunks).toString());
   if(body.userId!==env.ACCOUNT_OWNER_USER_ID)return send({error:'UNAUTHORIZED'},403);
   if(req.url==='/status')return send({providers:{kiwoom:adapters.configured('kiwoom'),upbit:adapters.configured('upbit')}});
   if(!['kiwoom','upbit'].includes(body.provider))return send({error:'INVALID_REQUEST'},400);
   if(busy)return send({error:'SYNC_BUSY'},429);busy=true;
   try{return send({positions:await adapters.snapshot(body.provider as Provider),complete:true});}finally{busy=false;}
  }catch(e){return send({error:e instanceof AccountError?e.code:'PROVIDER_UNAVAILABLE'},502);}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
