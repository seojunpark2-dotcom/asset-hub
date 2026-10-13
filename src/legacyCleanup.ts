import * as Notifications from 'expo-notifications';
// One-time upgrade cleanup only; no notification scheduling or renewal remains.
export async function cleanupLegacyNotifications(){
 for(const item of await Notifications.getAllScheduledNotificationsAsync())if(item.identifier.startsWith('api-expiry:')||item.identifier==='api-expiry-test')await Notifications.cancelScheduledNotificationAsync(item.identifier);
}
