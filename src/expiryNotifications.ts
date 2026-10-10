import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import {ApiExpiry,ExpiryReminder,reconcileReminders} from './apiExpiry';
const channel='api-expiry';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
let queue:Promise<unknown>=Promise.resolve();
function serialize<T>(task:()=>Promise<T>):Promise<T>{const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
async function ensureChannel(){
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync(channel,{name:'API 이용기간 만료 알림',importance:Notifications.AndroidImportance.DEFAULT,enableVibrate:false,sound:'default'});
}
const adapter={
 list:()=>Notifications.getAllScheduledNotificationsAsync(),
 cancel:(id:string)=>Notifications.cancelScheduledNotificationAsync(id),
 schedule:(r:ExpiryReminder)=>Notifications.scheduleNotificationAsync({identifier:r.id,content:{title:r.title,body:r.body,sound:'default',data:{kind:'api-expiry'}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:r.date,channelId:channel}})
};
export async function allowExpiryNotifications(){
 await ensureChannel();
 const current=await Notifications.getPermissionsAsync();
 if(current.granted)return true;
 if(!current.canAskAgain)return false;
 return (await Notifications.requestPermissionsAsync()).granted;
}
export const syncExpiryNotifications=(userId:string,expiry:ApiExpiry)=>serialize(async()=>{
 await ensureChannel();
 const allowed=(await Notifications.getPermissionsAsync()).granted;
 const count=await reconcileReminders(adapter,userId,expiry,allowed);
 return {allowed,count};
});
export const cancelExpiryNotifications=(userId:string)=>serialize(async()=>{
 for(const item of await adapter.list())if(item.identifier.startsWith('api-expiry:'+userId+':'))await adapter.cancel(item.identifier);
});
export async function testExpiryNotification(){
 if(!await allowExpiryNotifications())throw new Error('휴대폰 설정에서 이 앱의 알림을 허용해주세요.');
 await Notifications.scheduleNotificationAsync({identifier:'api-expiry-test',content:{title:'API 만료 알림 테스트',body:'만료일 알림이 이 기기에 표시됩니다.',sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5,channelId:channel}});
}
export {Notifications};