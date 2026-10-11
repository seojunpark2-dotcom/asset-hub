package expo.modules.assetexpiry

import android.content.Context
import android.app.NotificationManager
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class ExpiryAlarmTest {
  @Test fun deliveryAdvancesOnceAndManualSelectionClearsRollover() {
    val context = RuntimeEnvironment.getApplication()
    val p = context.getSharedPreferences("asset-expiry", Context.MODE_PRIVATE)
    p.edit().clear().commit()
    ExpiryAlarm.configure(context, "user", "2020-01-01", true, true)
    ExpiryAlarm.deliver(context)
    val state = requireNotNull(ExpiryAlarm.read(context, "user"))
    assertEquals(ExpiryCalendar.nextDate(System.currentTimeMillis()), state["date"])
    assertEquals(ExpiryCalendar.day(System.currentTimeMillis()), state["lastNotifiedOn"])
    assertEquals("2020-01-01", state["autoAdvancedFrom"])
    ExpiryAlarm.configure(context, "user", "2020-01-01", true, false)
    assertEquals(state["date"], ExpiryAlarm.read(context, "user")!!["date"])
    val manager = shadowOf(context.getSystemService(NotificationManager::class.java))
    assertEquals(1, manager.size())
    context.getSystemService(NotificationManager::class.java).cancelAll()
    ExpiryAlarm.deliver(context)
    assertEquals(0, manager.size())
    ExpiryAlarm.configure(context, "user", "2028-10-11", true, true)
    assertNull(ExpiryAlarm.read(context, "user")!!["lastNotifiedOn"])
    assertEquals("2028-10-11", ExpiryAlarm.read(context, "user")!!["date"])
    ExpiryAlarm.cancel(context, "user")
    assertNull(ExpiryAlarm.read(context, "user"))
  }
  @Test fun disabledOrBlockedNotificationsNeverAdvanceDate() {
    val context = RuntimeEnvironment.getApplication()
    ExpiryAlarm.configure(context, "user", "2020-01-01", false, true)
    ExpiryAlarm.deliver(context)
    assertEquals("2020-01-01", ExpiryAlarm.read(context, "user")!!["date"])
    ExpiryAlarm.configure(context, "user", "2020-01-01", true, true)
    shadowOf(context.getSystemService(NotificationManager::class.java)).setNotificationsEnabled(false)
    ExpiryAlarm.deliver(context)
    assertNull(ExpiryAlarm.read(context, "user")!!["lastNotifiedOn"])
    assertEquals("2020-01-01", ExpiryAlarm.read(context, "user")!!["date"])
  }
}
