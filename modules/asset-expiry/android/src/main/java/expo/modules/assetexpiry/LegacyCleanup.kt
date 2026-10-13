package expo.modules.assetexpiry

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object LegacyCleanup {
  fun run(context: Context) {
    val intent = Intent().setClassName(context.packageName, "expo.modules.assetexpiry.ExpiryAlarmReceiver").setAction("expo.modules.assetexpiry.DELIVER")
    val pending = PendingIntent.getBroadcast(context, 731, intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
    if (pending != null) { context.getSystemService(AlarmManager::class.java).cancel(pending); pending.cancel() }
    context.getSharedPreferences("asset-expiry", Context.MODE_PRIVATE).edit().clear().apply()
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.cancel(731)
    if (Build.VERSION.SDK_INT >= 26) manager.deleteNotificationChannel("api-expiry")
  }
}
