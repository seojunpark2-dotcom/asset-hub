package expo.modules.assetexpiry

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object ExpiryAlarm {
  private const val CHANNEL = "api-expiry"
  private const val ACTION = "expo.modules.assetexpiry.DELIVER"
  private fun prefs(context: Context) = context.getSharedPreferences("asset-expiry", Context.MODE_PRIVATE)
  private fun pending(context: Context): PendingIntent = PendingIntent.getBroadcast(context, 731,
    Intent(context, ExpiryAlarmReceiver::class.java).setAction(ACTION), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  @Synchronized fun read(context: Context, userId: String): Map<String, Any?>? {
    val p = prefs(context)
    if (p.getString("userId", null) != userId) return null
    return mapOf("date" to p.getString("date", null), "enabled" to p.getBoolean("enabled", false),
      "configuredDate" to p.getString("configuredDate", null), "lastNotifiedOn" to p.getString("lastNotifiedOn", null),
      "autoAdvancedFrom" to p.getString("autoAdvancedFrom", null))
  }
  private fun allowed(context: Context): Boolean {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= 26 && context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) return false
    return true
  }
  fun channel(context: Context) {
    if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL, "API 이용기간 만료 알림", NotificationManager.IMPORTANCE_DEFAULT).apply { enableVibration(false) })
  }
  @Synchronized fun configure(context: Context, userId: String, date: String, enabled: Boolean, manual: Boolean): Int {
    ExpiryCalendar.reminderTime(date)
    val p = prefs(context)
    // An alarm may fire between the JavaScript read and this configuration call.
    val preserveRollover = !manual && p.getString("userId", null) == userId && p.contains("lastNotifiedOn") &&
      (date == p.getString("configuredDate", null) || date == p.getString("autoAdvancedFrom", null))
    val effectiveDate = if (preserveRollover) p.getString("date", date)!! else date
    val changed = manual || p.getString("userId", null) != userId || p.getString("date", null) != effectiveDate
    val edit = p.edit().putString("userId", userId).putString("date", effectiveDate).putBoolean("enabled", enabled)
    if (changed) edit.putString("configuredDate", effectiveDate).remove("lastNotifiedOn").remove("autoAdvancedFrom")
    check(edit.commit())
    return schedule(context)
  }
  @Synchronized fun cancel(context: Context, userId: String) {
    if (prefs(context).getString("userId", null) != userId) return
    context.getSystemService(AlarmManager::class.java).cancel(pending(context))
    prefs(context).edit().clear().commit()
  }
  @Synchronized fun schedule(context: Context): Int {
    channel(context)
    val alarms = context.getSystemService(AlarmManager::class.java)
    alarms.cancel(pending(context))
    val p = prefs(context)
    val date = p.getString("date", null) ?: return 0
    if (!p.getBoolean("enabled", false) || !allowed(context)) return 0
    val at = ExpiryCalendar.reminderTime(date)
    // At most one pending reminder; no alerts for newly saved dates already past their reminder day.
    if (at <= System.currentTimeMillis()) return 0
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context))
    return 1
  }
  @Synchronized fun deliver(context: Context) {
    val p = prefs(context)
    val oldDate = p.getString("date", null) ?: return
    val now = System.currentTimeMillis()
    if (!p.getBoolean("enabled", false) || !allowed(context) || now < ExpiryCalendar.reminderTime(oldDate)) return
    val today = ExpiryCalendar.day(now)
    val nextDate = ExpiryCalendar.nextDate(now)
    val launch = Intent(Intent.ACTION_VIEW, android.net.Uri.parse("assethub://expiry"))
      .setClassName(context.packageName, context.packageName + ".MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val tap = PendingIntent.getActivity(context, 732, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(context.applicationInfo.icon).setContentTitle("공공데이터 API 만료 7일 전")
      .setContentText("이용기간을 연장해주세요. 앱의 다음 만료일은 $nextDate 로 자동 변경됩니다.")
      .setStyle(NotificationCompat.BigTextStyle().bigText("만료예정일: $oldDate. 공공데이터포털에서 실제 이용기간을 연장해주세요. 앱의 다음 만료일은 알림일 기준 2년 뒤인 $nextDate 로 자동 변경됩니다."))
      .setContentIntent(tap).setAutoCancel(true).build()
    // Posting the notification happens first; denied/failed notifications never advance the date.
    NotificationManagerCompat.from(context).notify(731, notification)
    check(p.edit().putString("date", nextDate).putString("lastNotifiedOn", today).putString("autoAdvancedFrom", oldDate).commit())
    schedule(context)
  }
}

class ExpiryAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "expo.modules.assetexpiry.DELIVER") ExpiryAlarm.deliver(context)
    else if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) ExpiryAlarm.schedule(context)
  }
}
