package expo.modules.assetexpiry

import android.content.Context
import androidx.work.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Legacy midnight work is cancelled. HomeAccountWorker owns the daily Wi-Fi batch. */
object WidgetRefreshScheduler {
  const val TAG = "portfolio-widget-daily"
  fun day(now: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("Asia/Seoul") }.format(Date(now))
  fun ensure(context: Context) { cancel(context) }
  fun cancel(context: Context) { WorkManager.getInstance(context).cancelAllWorkByTag(TAG) }
}

// Keep the class so persisted jobs from older APKs can finish safely without network or snapshot writes.
class WidgetRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result = Result.success()
}
