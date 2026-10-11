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
      write(context, JSONObject().put("userId", userId))
      PortfolioWidgetProvider.updateAll(context)
    }
  }
  @Synchronized fun update(context: Context, userId: String, json: String) {
    if (userId.isEmpty() || read(context).optString("userId") != userId) return
    val snapshot = JSONObject(json)
    require(snapshot.optJSONArray("rows") != null)
    write(context, JSONObject().put("userId", userId).put("snapshot", snapshot))
    PortfolioWidgetProvider.updateAll(context)
  }
  @Synchronized fun snapshot(context: Context): JSONObject? {
    val data = read(context)
    return if (data.optString("userId").isEmpty()) null else data.optJSONObject("snapshot")
  }
}
