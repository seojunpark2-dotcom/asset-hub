package expo.modules.assetexpiry

import android.view.ViewGroup
import android.widget.TextView
import android.widget.ListView
import org.junit.Test
import org.junit.Before
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33])
class PortfolioWidgetTest {
  @Before fun initializeWorkManager() {
    androidx.work.testing.WorkManagerTestInitHelper.initializeTestWorkManager(RuntimeEnvironment.getApplication())
  }
  private val payload = """{"totalValue":"₩350","totalProfit":"+₩50","totalPercent":"+16.67%","totalColor":"#FF727C","updatedAt":"2026-10-11T00:00:00.000Z","rows":[{"name":"ETF A","institution":"키움증권","percent":"+50.00%","color":"#FF727C"}]}"""
  @Test fun logoutAndAccountSwitchClearSnapshotAndRejectLateWrites() {
    val context = RuntimeEnvironment.getApplication()
    PortfolioWidgetStore.setUser(context, "")
    PortfolioWidgetStore.setUser(context, "A")
    PortfolioWidgetStore.update(context, "A", payload)
    assertEquals("₩350", PortfolioWidgetStore.snapshot(context)!!.getString("totalValue"))
    PortfolioWidgetStore.setUser(context, "B")
    assertNull(PortfolioWidgetStore.snapshot(context))
    PortfolioWidgetStore.update(context, "A", payload)
    assertNull(PortfolioWidgetStore.snapshot(context))
    PortfolioWidgetStore.update(context, "B", payload)
    PortfolioWidgetStore.setUser(context, "")
    assertNull(PortfolioWidgetStore.snapshot(context))
  }
  @Test fun summaryLayoutInflatesOnOldAndNewAndroidAndEmptyStateIsHonest() {
    val context = RuntimeEnvironment.getApplication()
    PortfolioWidgetStore.setUser(context, "")
    PortfolioWidgetStore.setUser(context, "A")
    PortfolioWidgetStore.update(context, "A", payload)
    val view = PortfolioWidgetProvider.views(context, 41).apply(context, null)
    assertEquals("₩350", view.findViewById<TextView>(R.id.widget_total).text.toString())
    val profit = view.findViewById<TextView>(R.id.widget_profit)
    val percent = view.findViewById<TextView>(R.id.widget_percent)
    assertEquals("+₩50", profit.text.toString())
    assertEquals("+16.67%", percent.text.toString())
    for (widthDp in listOf(240, 400)) {
      val width = (widthDp * context.resources.displayMetrics.density).toInt()
      view.measure(android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY), android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY))
      view.layout(0, 0, width, width)
      val profitRow = view.findViewById<ViewGroup>(R.id.widget_profit_row)
      assertEquals(0, profit.left)
      assertTrue(percent.left - profit.right >= 20 * context.resources.displayMetrics.density - 1)
      assertEquals(profitRow.width, percent.right)
    }
    fun texts(root: android.view.View): List<String> = when (root) {
      is TextView -> listOf(root.text.toString())
      is ViewGroup -> (0 until root.childCount).flatMap { texts(root.getChildAt(it)) }
      else -> emptyList()
    }
    assertFalse(texts(view).any { it.contains("통합 자산관리") || it.contains("앱 반영") || it.contains("눌러서") })
    val row = PortfolioWidgetProvider.row(context, org.json.JSONObject(payload).getJSONArray("rows").getJSONObject(0)).apply(context, null)
    assertEquals(listOf("ETF A", "+50.00%"), texts(row))
    assertNotNull(view.findViewById<ListView>(R.id.widget_list))
    PortfolioWidgetStore.setUser(context, "")
    val loggedOut = PortfolioWidgetProvider.views(context, 41).apply(context, null)
    assertEquals("—", loggedOut.findViewById<TextView>(R.id.widget_total).text.toString())
    assertEquals("—", loggedOut.findViewById<TextView>(R.id.widget_percent).text.toString())
  }
}
