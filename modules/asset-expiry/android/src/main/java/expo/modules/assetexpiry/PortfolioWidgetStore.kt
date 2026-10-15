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
  @Synchronized fun setUser(context: Context, userId: String) {
    if (read(context).optString("userId") != userId || userId.isEmpty()) {
      WidgetAccountSync.clear(context)
      write(context, JSONObject().put("userId", userId))
      PortfolioWidgetProvider.updateAll(context)
      WidgetRefreshScheduler.cancel(context)
    }
  }
  @Synchronized fun update(context: Context, userId: String, json: String) {
    if (userId.isEmpty() || read(context).optString("userId") != userId) return
    val snapshot = JSONObject(json)
    require(snapshot.optJSONArray("rows") != null)
    val data = read(context)
    data.put("snapshot", snapshot)
    write(context, data)
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
    data.put("input", input).put("revision", java.util.UUID.randomUUID().toString())
    write(context, data)
    WidgetRefreshScheduler.ensure(context)
  }
  @Synchronized fun refreshState(context: Context): JSONObject = read(context)
  @Synchronized fun commitRefresh(context: Context, state: JSONObject, snapshot: JSONObject, quotes: JSONObject, day: String, complete: Boolean, holdings: org.json.JSONArray? = null): Boolean {
    val data = read(context)
    if (state.optString("userId").isEmpty() || data.optString("userId") != state.optString("userId") || data.optString("revision") != state.optString("revision")) return false
    data.put("snapshot", snapshot)
    data.getJSONObject("input").put("quotes", quotes)
    if (holdings != null) data.getJSONObject("input").put("holdings", holdings)
    if (complete) data.put("lastSuccessDay", day)
    write(context, data)
    PortfolioWidgetProvider.updateAll(context)
    return true
  }
}
