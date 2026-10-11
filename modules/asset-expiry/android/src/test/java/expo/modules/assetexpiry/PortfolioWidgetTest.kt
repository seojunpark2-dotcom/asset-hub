package expo.modules.assetexpiry

import android.view.View
import android.widget.TextView
import android.widget.ListView
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33])
class PortfolioWidgetTest {
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
    assertEquals("+₩50 · +16.67%", view.findViewById<TextView>(R.id.widget_profit).text.toString())
    assertTrue(view.findViewById<TextView>(R.id.widget_status).text.contains("10/11 09:00"))
    assertNotNull(view.findViewById<ListView>(R.id.widget_list))
    PortfolioWidgetStore.setUser(context, "")
    val loggedOut = PortfolioWidgetProvider.views(context, 41).apply(context, null)
    assertEquals("—", loggedOut.findViewById<TextView>(R.id.widget_total).text.toString())
  }
}
