import * as Notifications from 'expo-notifications';
import {requireOptionalNativeModule} from 'expo';
import {Platform,Linking} from 'react-native';
import {ApiExpiry,NativeExpiryState,mergeAutomaticExpiry} from './apiExpiry';
interface ExpiryModule {read(userId:string):Promise<NativeExpiryState|null>;configure(userId:string,date:string,enabled:boolean,manual:boolean):Promise<number>;cancel(userId:string):Promise<void>;openNotificationSettings():Promise<void>;}
const native=requireOptionalNativeModule<ExpiryModule>('AssetExpiry');
export const openPhoneNotificationSettings=()=>native?native.openNotificationSettings():Linking.openSettings();
const channel='api-expiry';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
let queue:Promise<unknown>=Promise.resolve();
function serialize<T>(task:()=>Promise<T>):Promise<T>{const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
async function ensureChannel(){if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(channel,{name:'API 이용기간 만료 알림',importance:Notifications.AndroidImportance.DEFAULT,enableVibrate:false,sound:'default'});}
export async function allowExpiryNotifications(){
 await ensureChannel();const current=await Notifications.getPermissionsAsync();if(current.granted)return true;if(!current.canAskAgain)return false;
 return (await Notifications.requestPermissionsAsync()).granted;
}
export const syncExpiryNotifications=(userId:string,expiry:ApiExpiry,manual=false)=>serialize(async()=>{
 if(!native)throw new Error('업데이트 APK를 설치해야 알림을 예약할 수 있습니다.');
 await ensureChannel();
 const permission=(await Notifications.getPermissionsAsync()).granted;
 const channelInfo=Platform.OS==='android'?await Notifications.getNotificationChannelAsync(channel):null;
 const allowed=permission&&channelInfo?.importance!==Notifications.AndroidImportance.NONE;
 for(const old of await Notifications.getAllScheduledNotificationsAsync())if(old.identifier.startsWith('api-expiry:')||old.identifier==='api-expiry-test')await Notifications.cancelScheduledNotificationAsync(old.identifier);
 const effective=manual?expiry:mergeAutomaticExpiry(expiry,await native.read(userId));
 const count=await native.configure(userId,effective.date,effective.enabled&&allowed,manual);
 return {allowed,count,expiry:effective};
});
export const cancelExpiryNotifications=(userId:string)=>serialize(async()=>{
 await native?.cancel(userId);
 for(const old of await Notifications.getAllScheduledNotificationsAsync())if(old.identifier.startsWith('api-expiry:'+userId+':')||old.identifier==='api-expiry-test')await Notifications.cancelScheduledNotificationAsync(old.identifier);
});
export {Notifications};
