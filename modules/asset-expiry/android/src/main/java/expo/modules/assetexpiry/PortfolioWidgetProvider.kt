package expo.modules.assetexpiry

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONObject

class PortfolioWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { ids.forEach { updateOne(context, manager, it) }; HomeAccountSync.ensure(context) }
  override fun onEnabled(context: Context) { HomeAccountSync.ensure(context) }
  override fun onDisabled(context: Context) { WidgetRefreshScheduler.cancel(context) }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { updateOne(context, manager, id) }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) { updateAll(context); HomeAccountSync.ensure(context) }
  }
  companion object {
    fun pin(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < 26) return false
      val manager = AppWidgetManager.getInstance(context)
      return manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(ComponentName(context, PortfolioWidgetProvider::class.java), null, null)
    }
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      manager.getAppWidgetIds(ComponentName(context, PortfolioWidgetProvider::class.java)).forEach { updateOne(context, manager, it) }
    }
    fun row(context: Context, data: JSONObject): RemoteViews = RemoteViews(context.packageName, R.layout.portfolio_widget_row).apply {
      setTextViewText(R.id.widget_row_name, data.optString("name"))
      setTextViewText(R.id.widget_row_percent, data.optString("percent", "—"))
      setTextColor(R.id.widget_row_percent, color(data.optString("color")))
      setOnClickFillInIntent(R.id.widget_row, Intent())
    }
    private fun color(value: String) = try { Color.parseColor(value) } catch (_: Exception) { Color.LTGRAY }
    @Suppress("DEPRECATION")
    fun views(context: Context, id: Int): RemoteViews {
      val snapshot = PortfolioWidgetStore.snapshot(context)
      val rows = snapshot?.optJSONArray("rows")
      val view = RemoteViews(context.packageName, R.layout.portfolio_widget)
      view.setTextViewText(R.id.widget_total, snapshot?.optString("totalValue", "—") ?: "—")
      view.setTextViewText(R.id.widget_profit, snapshot?.optString("totalProfit", "—") ?: "—")
      view.setTextViewText(R.id.widget_percent, snapshot?.optString("totalPercent", "—") ?: "—")
      view.setTextColor(R.id.widget_profit, color(snapshot?.optString("totalColor") ?: ""))
      view.setTextColor(R.id.widget_percent, color(snapshot?.optString("totalColor") ?: ""))
      view.setTextViewText(R.id.widget_empty, if (snapshot == null) "앱에서 설정 후 등록 Wi-Fi의 하루 갱신을 기다려주세요" else "자산 탭에서 보유자산을 추가해주세요")
      view.setEmptyView(R.id.widget_list, R.id.widget_empty)
      if (Build.VERSION.SDK_INT >= 31 && (rows?.length() ?: 0) <= 100) {
        val items = RemoteViews.RemoteCollectionItems.Builder().setViewTypeCount(1)
        for (i in 0 until (rows?.length() ?: 0)) items.addItem(i.toLong(), row(context, rows!!.getJSONObject(i)))
        view.setRemoteAdapter(R.id.widget_list, items.build())
      } else {
        val service = Intent(context, PortfolioWidgetService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        service.data = Uri.parse("assethub-widget://list/$id")
        view.setRemoteAdapter(R.id.widget_list, service)
      }
      val launch = Intent(Intent.ACTION_VIEW, Uri.parse("assethub://widget")).setComponent(ComponentName(context.packageName, context.packageName + ".MainActivity")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val tap = PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      view.setOnClickPendingIntent(R.id.widget_root, tap)
      view.setOnClickPendingIntent(R.id.widget_total, tap)
      view.setOnClickPendingIntent(R.id.widget_profit, tap)
      view.setOnClickPendingIntent(R.id.widget_percent, tap)
      view.setOnClickPendingIntent(R.id.widget_empty, tap)
      val listTap = PendingIntent.getActivity(context, id + 100000, launch, PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0))
      view.setPendingIntentTemplate(R.id.widget_list, listTap)
      return view
    }
    @Suppress("DEPRECATION")
    fun updateOne(context: Context, manager: AppWidgetManager, id: Int) {
      manager.updateAppWidget(id, views(context, id))
      if (Build.VERSION.SDK_INT < 31 || (PortfolioWidgetStore.snapshot(context)?.optJSONArray("rows")?.length() ?: 0) > 100) manager.notifyAppWidgetViewDataChanged(id, R.id.widget_list)
    }
  }
}
