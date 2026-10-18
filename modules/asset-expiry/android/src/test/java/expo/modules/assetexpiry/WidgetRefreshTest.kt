package expo.modules.assetexpiry

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import org.junit.Test
import org.junit.Before
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import androidx.work.testing.WorkManagerTestInitHelper
import androidx.work.WorkManager
import androidx.work.WorkInfo

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33])
class WidgetRefreshTest {
  private fun instant(value: String) = Instant.parse(value).toEpochMilli()
  @Before fun initialize() { WorkManagerTestInitHelper.initializeTestWorkManager(RuntimeEnvironment.getApplication()) }
  private fun holding(id: String, type: String, symbol: String, quantity: String, cost: String, currency: String = "KRW") = JSONObject()
    .put("id", id).put("name", id).put("asset_type", type).put("symbol", symbol).put("quantity", quantity)
    .put("original_investment_krw", cost).put("purchase_currency", currency)
  private fun q(price: String) = JSONObject().put("current_price", price).put("stale", false)
  private fun input() = JSONObject().put("colors", "kr").put("holdings", JSONArray()
    .put(holding("KR", "domestic_etf", "360750", "2", "40000"))
    .put(holding("US", "foreign_stock", "AAPL", "0.5", "100000", "USD"))
    .put(holding("BTC", "crypto", "KRW-BTC", "0.001", "80000")))
  @Test fun dailyPolicyUsesKoreanDatesAndCancelsPersistedMidnightReservations() {
    assertEquals("2026-10-15", WidgetRefreshScheduler.day(instant("2026-10-14T15:00:00Z")))
    val context = RuntimeEnvironment.getApplication()
    val manager = WorkManager.getInstance(context)
    val legacy = androidx.work.OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
      .setInitialDelay(1, java.util.concurrent.TimeUnit.DAYS).addTag(WidgetRefreshScheduler.TAG).build()
    manager.enqueue(legacy).result.get()
    WidgetRefreshScheduler.ensure(context)
    assertEquals(WorkInfo.State.CANCELLED, manager.getWorkInfoById(legacy.id).get().state)
    WidgetRefreshScheduler.ensure(context)
    assertTrue(manager.getWorkInfosByTag(WidgetRefreshScheduler.TAG).get().all { it.state == WorkInfo.State.CANCELLED })
  }
  @Test fun mixedAssetsUseExactDecimalWonCostAndSortByValue() {
    val quotes = JSONObject().put("KR:360750", q("25000")).put("US:AAPL", q("200"))
      .put("UPBIT:KRW-BTC", q("100000000")).put("FX:USD/KRW", q("1400"))
    val snapshot = WidgetRefreshEngine.snapshot(input(), quotes)
    assertEquals("₩290,000", snapshot.getString("totalValue"))
    assertEquals("+₩70,000", snapshot.getString("totalProfit"))
    assertEquals("+31.82%", snapshot.getString("totalPercent"))
    assertEquals(listOf("US", "BTC", "KR"), (0..2).map { snapshot.getJSONArray("rows").getJSONObject(it).getString("name") })
    assertEquals("+40.00%", snapshot.getJSONArray("rows").getJSONObject(0).getString("percent"))
    assertEquals("#FF727C", snapshot.getString("totalColor"))
  }
  @Test fun zeroCostCoinHasUnknownReturnInsteadOfInfinity() {
    val data = JSONObject().put("colors", "kr").put("holdings", JSONArray().put(holding("gift", "crypto", "KRW-BTC", "0.001", "0")))
    val snapshot = WidgetRefreshEngine.snapshot(data, JSONObject().put("UPBIT:KRW-BTC", q("100000000")))
    assertEquals("₩100,000", snapshot.getString("totalValue"))
    assertEquals("+₩100,000", snapshot.getString("totalProfit"))
    assertEquals("—", snapshot.getString("totalPercent"))
    assertEquals("—", snapshot.getJSONArray("rows").getJSONObject(0).getString("percent"))
  }
  @Test fun failureRetainsRealPriceAndMissingFxDoesNotFabricateTotals() {
    val data = input().put("quotes", JSONObject().put("KR:360750", q("25000")))
    val failed = WidgetRefreshEngine.refresh(data, fetchQuote = { throw IllegalStateException() }, fetchFx = { throw IllegalStateException() })
    assertFalse(failed.complete)
    assertTrue(failed.quotes.getJSONObject("KR:360750").getBoolean("stale"))
    assertEquals("25000", failed.quotes.getJSONObject("KR:360750").getString("current_price"))
    assertEquals("—", failed.snapshot.getString("totalValue"))
    assertEquals("—", failed.snapshot.getString("totalProfit"))
    assertTrue(failed.snapshot.getBoolean("stale"))
  }
  @Test fun accountChangeOrNewHoldingsRejectsInFlightBackgroundResult() {
    val context = RuntimeEnvironment.getApplication()
    PortfolioWidgetStore.setUser(context, "A")
    PortfolioWidgetStore.setRefreshInput(context, "A", input().toString())
    val state = PortfolioWidgetStore.refreshState(context)
    val snapshot = JSONObject().put("rows", JSONArray()).put("totalValue", "₩100")
    PortfolioWidgetStore.setRefreshInput(context, "A", input().put("colors", "global").toString())
    assertFalse(PortfolioWidgetStore.commitRefresh(context, state, snapshot, JSONObject(), "2026-10-15", true, accountSnapshot = true))
    val fresh = PortfolioWidgetStore.refreshState(context)
    assertTrue(PortfolioWidgetStore.commitRefresh(context, fresh, snapshot, JSONObject(), "2026-10-15", true, accountSnapshot = true))
    assertEquals("2026-10-15", PortfolioWidgetStore.refreshState(context).getString("lastSuccessDay"))
    PortfolioWidgetStore.setUser(context, "B")
    assertFalse(PortfolioWidgetStore.commitRefresh(context, fresh, snapshot, JSONObject(), "2026-10-15", true, accountSnapshot = true))
    assertNull(PortfolioWidgetStore.refreshState(context).optJSONObject("input"))
    assertNull(PortfolioWidgetStore.snapshot(context))
  }
  @Test fun yahooRejectsWrongCurrencyTypeExchangeAndFutureTimestamp() {
    fun data(currency: String = "USD", kind: String = "EQUITY", exchange: String = "NMS", time: Long = System.currentTimeMillis()/1000) = JSONObject()
      .put("chart", JSONObject().put("error", JSONObject.NULL).put("result", JSONArray().put(JSONObject().put("meta", JSONObject()
        .put("symbol", "AAPL").put("currency", currency).put("instrumentType", kind).put("exchangeName", exchange)
        .put("regularMarketTime", time).put("regularMarketPrice", "200")))))
    assertEquals("200", WidgetRefreshEngine.yahooMeta(data(), "AAPL", "USD", "EQUITY", listOf("NMS")).getString("regularMarketPrice"))
    for (bad in listOf(data(currency="KRW"), data(kind="ETF"), data(exchange="KSC"), data(time=System.currentTimeMillis()/1000+3600))) {
      assertThrows(IllegalArgumentException::class.java) { WidgetRefreshEngine.yahooMeta(bad, "AAPL", "USD", "EQUITY", listOf("NMS")) }
    }
  }
}
