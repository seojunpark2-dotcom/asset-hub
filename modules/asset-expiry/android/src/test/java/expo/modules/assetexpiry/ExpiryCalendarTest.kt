package expo.modules.assetexpiry

import org.junit.Assert.assertEquals
import org.junit.Test

class ExpiryCalendarTest {
  @Test fun sevenDaysBeforeInKorea() { assertEquals(1854230400000L, ExpiryCalendar.reminderTime("2028-10-11")) }
  @Test fun rolloverUsesActualNotificationDay() {
    assertEquals("2030-10-04", ExpiryCalendar.nextDate(1854230400000L))
    assertEquals("2030-02-28", ExpiryCalendar.nextDate(1835395200000L))
  }
}
