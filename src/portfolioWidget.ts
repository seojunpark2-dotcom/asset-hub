import {requireOptionalNativeModule} from 'expo';
import {widgetSnapshot} from './widgetData';
import type {Holding,Quote} from './types';
interface WidgetBridge {setWidgetUser(userId:string):Promise<void>;updateWidget(userId:string,json:string):Promise<void>;setWidgetRefreshInput(userId:string,json:string):Promise<void>;pinWidget():Promise<boolean>;}
const native=requireOptionalNativeModule<WidgetBridge>('AssetExpiry');
let currentUser:string|null=null;let queue:Promise<unknown>=Promise.resolve();
function serial<T>(task:()=>Promise<T>):Promise<T>{const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
export function setWidgetUser(userId:string|null){currentUser=userId;return serial(async()=>{await native?.setWidgetUser(userId??'');});}
export function syncPortfolioWidget(userId:string,snapshot:ReturnType<typeof widgetSnapshot>){return serial(async()=>{if(currentUser===userId)await native?.updateWidget(userId,JSON.stringify(snapshot));});}
export function syncWidgetRefreshInput(userId:string,holdings:Holding[],quotes:Record<string,Quote>,colors:'kr'|'global'){
 const input=holdings.map(({id,name,asset_type,symbol,quantity,purchase_currency,original_investment_krw})=>({id,name,asset_type,symbol,quantity,purchase_currency,original_investment_krw}));
 return serial(async()=>{if(currentUser===userId)await native?.setWidgetRefreshInput(userId,JSON.stringify({holdings:input,quotes,colors}));});
}
export async function pinPortfolioWidget(){if(!native)throw Error('업데이트 APK를 설치해주세요.');return native.pinWidget();}
