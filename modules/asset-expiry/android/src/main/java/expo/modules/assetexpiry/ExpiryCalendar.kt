package expo.modules.assetexpiry

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object ExpiryCalendar {
  private val zone = TimeZone.getTimeZone("Asia/Seoul")
  private fun format() = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone; isLenient = false }
  fun day(time: Long): String = format().format(Date(time))
  fun reminderTime(date: String): Long {
    require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(date))
    val parsed = format().parse(date) ?: error("Invalid expiry date")
    require(format().format(parsed) == date)
    return Calendar.getInstance(zone).apply { time = parsed; add(Calendar.DAY_OF_MONTH, -7); set(Calendar.HOUR_OF_DAY, 9) }.timeInMillis
  }
  fun nextDate(notificationTime: Long): String = format().format(Calendar.getInstance(zone).apply {
    timeInMillis = notificationTime
    add(Calendar.YEAR, 2)
  }.time)
}
