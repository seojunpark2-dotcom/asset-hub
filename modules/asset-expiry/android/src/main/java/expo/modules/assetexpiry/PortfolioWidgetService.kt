package expo.modules.assetexpiry

import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService

class PortfolioWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = object : RemoteViewsFactory {
    override fun onCreate() {}
    override fun onDataSetChanged() {}
    override fun onDestroy() {}
    override fun getCount() = PortfolioWidgetStore.snapshot(this@PortfolioWidgetService)?.optJSONArray("rows")?.length() ?: 0
    override fun getViewAt(position: Int): RemoteViews {
      val item = PortfolioWidgetStore.snapshot(this@PortfolioWidgetService)?.optJSONArray("rows")?.optJSONObject(position)
      return if (item == null) RemoteViews(packageName, R.layout.portfolio_widget_row) else PortfolioWidgetProvider.row(this@PortfolioWidgetService, item)
    }
    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount() = 1
    override fun getItemId(position: Int) = position.toLong()
    override fun hasStableIds() = false
  }
}
