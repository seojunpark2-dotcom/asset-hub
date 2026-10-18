package expo.modules.assetexpiry

import android.content.Context
import android.util.AtomicFile
import java.io.File
import org.json.JSONObject

object PortfolioWidgetStore {
  private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "portfolio-widget.json"))
  @Synchronized private fun read(context: Context): JSONObject = try {
    JSONObject(file(context).openRead().use { it.readBytes().toString(Charsets.UTF_8) })
  } catch (_: Exception) { JSONObject() }
  private fun write(context: Context, data: JSONObject) {
    val target = file(context); val stream = target.startWrite()
    try { stream.write(data.toString().toByteArray(Charsets.UTF_8)); target.finishWrite(stream) }
    catch (e: Exception) { target.failWrite(stream); throw e }
  }
  fun setUser(context: Context, userId: String) = synchronized(HomeAccountSync) { synchronized(this) {
    if (read(context).optString("userId") != userId || userId.isEmpty()) {
      WidgetAccountSync.clear(context)
      HomeAccountSync.clear(context)
      write(context, JSONObject().put("userId", userId))
      PortfolioWidgetProvider.updateAll(context)
      WidgetRefreshScheduler.cancel(context)
    }
  } }
  @Synchronized fun update(context: Context, userId: String, json: String) {
    if (userId.isEmpty() || read(context).optString("userId") != userId) return
    // Compatibility bridge: foreground prices must not replace the daily Wi-Fi snapshot.
    PortfolioWidgetProvider.updateAll(context)
  }
  @Synchronized fun snapshot(context: Context): JSONObject? {
    val data = read(context)
    return if (data.optString("userId").isEmpty()) null else data.optJSONObject("snapshot")
  }
  @Synchronized fun setRefreshInput(context: Context, userId: String, json: String) {
    val data = read(context)
    if (userId.isEmpty() || data.optString("userId") != userId) return
    val input = JSONObject(json)
    require(input.getJSONArray("holdings").length() <= 100)
    val previous = data.optJSONObject("input")
    if (previous?.optJSONArray("holdings")?.toString() != input.getJSONArray("holdings").toString() || previous?.optString("colors") != input.optString("colors")) {
      data.put("revision", java.util.UUID.randomUUID().toString())
    }
    data.put("input", input)
    write(context, data)
    WidgetRefreshScheduler.ensure(context)
  }
  @Synchronized fun refreshState(context: Context): JSONObject = read(context)
  @Synchronized fun markAccountChanged(context: Context, userId: String) {
    val data = read(context)
    if (userId.isEmpty() || data.optString("userId") != userId) return
    data.put("accountWidgetPending", true).put("accountRevision", java.util.UUID.randomUUID().toString()).put("accountWidgetAttempt", 0L)
    write(context, data)
  }
  @Synchronized fun noteAccountWidgetAttempt(context: Context, state: JSONObject, now: Long) {
    val data = read(context)
    if (data.optString("userId") == state.optString("userId") && data.optString("accountRevision") == state.optString("accountRevision")) {
      data.put("accountWidgetAttempt", now); write(context, data)
    }
  }
  @Synchronized fun commitRefresh(context: Context, state: JSONObject, snapshot: JSONObject, quotes: JSONObject, day: String, complete: Boolean, holdings: org.json.JSONArray? = null, accountSnapshot: Boolean = false): Boolean {
    val data = read(context)
    if (!accountSnapshot || !complete || data.optString("dailyWifiDay") == day) return false
    if (state.optString("userId").isEmpty() || data.optString("userId") != state.optString("userId") || data.optString("revision") != state.optString("revision")) return false
    if (data.optString("accountRevision") != state.optString("accountRevision")) return false
    // A late failed price request must not overwrite a concurrently completed account widget update.
    if (accountSnapshot && !complete && data.optLong("accountWidgetSyncedAt") != state.optLong("accountWidgetSyncedAt")) return false
    data.put("snapshot", snapshot)
    data.getJSONObject("input").put("quotes", quotes)
    if (holdings != null) data.getJSONObject("input").put("holdings", holdings)
    data.put("lastSuccessDay", day).put("dailyWifiDay", day)
    if (complete && accountSnapshot && data.optBoolean("accountWidgetPending")) {
      data.put("accountWidgetPending", false).put("accountWidgetSyncedAt", System.currentTimeMillis())
    }
    write(context, data)
    PortfolioWidgetProvider.updateAll(context)
    return true
  }
}
