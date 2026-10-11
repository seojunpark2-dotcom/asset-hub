import {requireOptionalNativeModule} from 'expo';
import {widgetSnapshot} from './widgetData';
interface WidgetBridge {setWidgetUser(userId:string):Promise<void>;updateWidget(userId:string,json:string):Promise<void>;pinWidget():Promise<boolean>;}
const native=requireOptionalNativeModule<WidgetBridge>('AssetExpiry');
let currentUser:string|null=null;let queue:Promise<unknown>=Promise.resolve();
function serial<T>(task:()=>Promise<T>):Promise<T>{const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
export function setWidgetUser(userId:string|null){currentUser=userId;return serial(async()=>{await native?.setWidgetUser(userId??'');});}
export function syncPortfolioWidget(userId:string,snapshot:ReturnType<typeof widgetSnapshot>){return serial(async()=>{if(currentUser===userId)await native?.updateWidget(userId,JSON.stringify(snapshot));});}
export async function pinPortfolioWidget(){if(!native)throw Error('업데이트 APK를 설치해주세요.');return native.pinWidget();}
