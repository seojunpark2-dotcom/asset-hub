package expo.modules.assetexpiry

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.*
import java.util.Calendar
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

object WidgetRefreshScheduler {
  const val TAG = "portfolio-widget-daily"
  private val zone = TimeZone.getTimeZone("Asia/Seoul")
  fun day(now: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }.format(Date(now))
  fun nextMidnight(now: Long): Long = Calendar.getInstance(zone).apply {
    timeInMillis = now
    add(Calendar.DAY_OF_MONTH, 1)
    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
  }.timeInMillis
  fun hasWidgets(context: Context): Boolean = AppWidgetManager.getInstance(context)
    .getAppWidgetIds(ComponentName(context, PortfolioWidgetProvider::class.java)).isNotEmpty()
  fun ensure(context: Context, now: Long = System.currentTimeMillis()) {
    val state = PortfolioWidgetStore.refreshState(context)
    if (!hasWidgets(context) || state.optString("userId").isEmpty() || state.optJSONObject("input") == null) return
    enqueue(context, now)
  }
  internal fun enqueue(context: Context, now: Long) {
    val target = nextMidnight(now)
    val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
      .setInitialDelay(target - now, TimeUnit.MILLISECONDS)
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
      .addTag(TAG).build()
    WorkManager.getInstance(context).enqueueUniqueWork("$TAG-${day(target)}", ExistingWorkPolicy.KEEP, request)
  }
  fun cancel(context: Context) { WorkManager.getInstance(context).cancelAllWorkByTag(TAG) }
}

class WidgetRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val state = PortfolioWidgetStore.refreshState(applicationContext)
    if (!WidgetRefreshScheduler.hasWidgets(applicationContext) || state.optString("userId").isEmpty() || state.optJSONObject("input") == null) return Result.success()
    val day = WidgetRefreshScheduler.day(System.currentTimeMillis())
    // Schedule from the calendar each time, rather than letting 24-hour intervals drift.
    WidgetRefreshScheduler.ensure(applicationContext)
    if (state.optString("lastSuccessDay") == day) return Result.success()
    return try {
      val input = state.getJSONObject("input")
      var accountsComplete = true
      try { HomeAccountSync.sync(applicationContext) } catch (_: Exception) { /* Home Wi-Fi may be unavailable; still refresh public prices. */ }
      try {
        val accounts = WidgetAccountSync.holdings(applicationContext, state.getString("userId"))
        if (accounts != null) { input.put("holdings", accounts.getJSONArray("holdings")); accountsComplete = accounts.optBoolean("ok", false) }
      } catch (_: Exception) { accountsComplete = false }
      val result = WidgetRefreshEngine.refresh(input, stopped = { isStopped })
      if (isStopped) return Result.success()
      val complete = result.complete && accountsComplete
      val accepted = PortfolioWidgetStore.commitRefresh(applicationContext, state, result.snapshot, result.quotes, day, complete, input.getJSONArray("holdings"))
      if (accepted && !complete && runAttemptCount < 2) Result.retry() else Result.success()
    } catch (_: Exception) {
      // Do not replace the last real snapshot with zero values on connectivity failures.
      if (!isStopped && runAttemptCount < 2) Result.retry() else Result.success()
    }
  }
}
