package expo.modules.assetexpiry

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33])
class LegacyCleanupTest {
 @Test fun upgradeCancelsOldAlarmAndClearsStateWithoutSchedulingAnother() {
  val context=RuntimeEnvironment.getApplication()
  val intent=Intent().setClassName(context.packageName,"expo.modules.assetexpiry.ExpiryAlarmReceiver").setAction("expo.modules.assetexpiry.DELIVER")
  val pending=PendingIntent.getBroadcast(context,731,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  val alarms=context.getSystemService(AlarmManager::class.java)
  alarms.set(AlarmManager.RTC_WAKEUP,System.currentTimeMillis()+100000,pending)
  context.getSharedPreferences("asset-expiry",Context.MODE_PRIVATE).edit().putBoolean("enabled",true).commit()
  LegacyCleanup.run(context)
  assertTrue(shadowOf(alarms).scheduledAlarms.isEmpty())
  assertTrue(context.getSharedPreferences("asset-expiry",Context.MODE_PRIVATE).all.isEmpty())
  LegacyCleanup.run(context)
  assertTrue(shadowOf(alarms).scheduledAlarms.isEmpty())
 }
}
