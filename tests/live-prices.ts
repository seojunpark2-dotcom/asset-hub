import {providers} from '../supabase/functions/_shared/providers';
async function main(){
for(const i of [{symbol:'KRW-BTC',market:'UPBIT'},{symbol:'USD/KRW',market:'FX'}]){
 const p=providers(name=>process.env[name]).find(p=>p.supports(i))!;
 const q=await p.get(i);console.log(JSON.stringify(q));
}

}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
