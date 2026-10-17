package expo.modules.assetexpiry

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import org.junit.Before
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.RuntimeEnvironment
import androidx.work.testing.WorkManagerTestInitHelper
import android.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33])
class HomeAccountTest {
  @Before fun initialize() { WorkManagerTestInitHelper.initializeTestWorkManager(RuntimeEnvironment.getApplication()) }
  @Test fun statusIncludesExecutionTimesAndUsedIpButNeverCredentialsOrBalances() {
    val r = JSONObject().put("enabled", true).put("access", "private-access").put("secret", "private-secret")
      .put("attempt", 123L).put("fetchedAt", 124L).put("synced", "2026-10-17T01:02:03Z").put("usedIp", "203.0.113.7").put("pending", JSONArray())
    val status = HomeAccountSync.providerStatus(r)
    assertEquals(123L, status.getLong("lastAttempt")); assertEquals("203.0.113.7", status.getString("usedIp"))
    assertFalse(status.has("secret")); assertFalse(status.has("access")); assertFalse(status.has("pending"))
  }
  private fun widgetInput() = JSONObject().put("colors", "kr").put("quotes", JSONObject()).put("holdings", JSONArray())
  private fun accountHolding() = JSONObject().put("id", "ETF").put("name", "ETF").put("asset_type", "domestic_etf").put("symbol", "360750")
    .put("quantity", "2").put("purchase_currency", "KRW").put("original_investment_krw", "200")
  @Test fun accountSyncUpdatesWidgetQuantitiesWeightedProfitAndReturnWithoutAnotherAccountCall() {
    val context = RuntimeEnvironment.getApplication()
    PortfolioWidgetStore.setUser(context, "widget-test")
    PortfolioWidgetStore.setRefreshInput(context, "widget-test", widgetInput().toString())
    PortfolioWidgetStore.markAccountChanged(context, "widget-test")
    val now = 200000000L
    var loads = 0
    val load = { _: String -> loads++; JSONObject().put("ok", true).put("holdings", JSONArray().put(accountHolding())) }
    val refresh = { input: JSONObject -> WidgetRefreshEngine.refresh(input, fetchQuote = { JSONObject().put("current_price", "150") }) }
    HomeAccountSync.refreshWidget(context, now, load, refresh)
    val snapshot = PortfolioWidgetStore.snapshot(context)!!
    assertEquals("₩300", snapshot.getString("totalValue")); assertEquals("+₩100", snapshot.getString("totalProfit")); assertEquals("+50.00%", snapshot.getString("totalPercent"))
    assertEquals("+50.00%", snapshot.getJSONArray("rows").getJSONObject(0).getString("percent"))
    assertFalse(PortfolioWidgetStore.refreshState(context).getBoolean("accountWidgetPending"))
    assertTrue(PortfolioWidgetStore.refreshState(context).getLong("accountWidgetSyncedAt") > 0)
    HomeAccountSync.refreshWidget(context, now + 2000000, load, refresh); assertEquals(1, loads)
  }
  @Test fun failedPriceRefreshRetainsPendingAndRetriesWithoutReadingBrokerAgain() {
    val context = RuntimeEnvironment.getApplication(); PortfolioWidgetStore.setUser(context, "widget-test")
    PortfolioWidgetStore.setRefreshInput(context, "widget-test", widgetInput().toString()); PortfolioWidgetStore.markAccountChanged(context, "widget-test")
    val now = 200000000L; var loads = 0
    val load = { _: String -> loads++; JSONObject().put("ok", true).put("holdings", JSONArray().put(accountHolding())) }
    HomeAccountSync.refreshWidget(context, now, load) { input -> WidgetRefreshEngine.refresh(input, fetchQuote = { error("offline") }) }
    assertTrue(PortfolioWidgetStore.refreshState(context).getBoolean("accountWidgetPending"))
    HomeAccountSync.refreshWidget(context, now + 1000, load) { error("must be throttled") }; assertEquals(1, loads)
    HomeAccountSync.refreshWidget(context, now + 900000, load) { input -> WidgetRefreshEngine.refresh(input, fetchQuote = { JSONObject().put("current_price", "200") }) }
    assertEquals(2, loads); assertFalse(PortfolioWidgetStore.refreshState(context).getBoolean("accountWidgetPending"))
    assertEquals("+100.00%", PortfolioWidgetStore.snapshot(context)!!.getString("totalPercent"))
  }
  @Test fun inFlightOldSnapshotCannotEraseAnewerAccountRefreshRequest() {
    val context = RuntimeEnvironment.getApplication(); PortfolioWidgetStore.setUser(context, "widget-test")
    PortfolioWidgetStore.setRefreshInput(context, "widget-test", widgetInput().toString()); PortfolioWidgetStore.markAccountChanged(context, "widget-test")
    val old = PortfolioWidgetStore.refreshState(context)
    PortfolioWidgetStore.markAccountChanged(context, "widget-test")
    val accepted = PortfolioWidgetStore.commitRefresh(context, old, JSONObject().put("rows", JSONArray()), JSONObject(), "2026-10-17", true, JSONArray(), true)
    assertFalse(accepted); assertTrue(PortfolioWidgetStore.refreshState(context).getBoolean("accountWidgetPending"))
  }
  @Test fun lateFailedQuotesCannotReplaceSuccessfullyReflectedWidget() {
    val context = RuntimeEnvironment.getApplication(); PortfolioWidgetStore.setUser(context, "widget-test")
    PortfolioWidgetStore.setRefreshInput(context, "widget-test", widgetInput().toString()); PortfolioWidgetStore.markAccountChanged(context, "widget-test")
    val state = PortfolioWidgetStore.refreshState(context)
    val good = JSONObject().put("rows", JSONArray()).put("totalValue", "₩300")
    assertTrue(PortfolioWidgetStore.commitRefresh(context, state, good, JSONObject(), "2026-10-17", true, JSONArray(), true))
    assertFalse(PortfolioWidgetStore.commitRefresh(context, state, JSONObject().put("rows", JSONArray()).put("totalValue", "—"), JSONObject(), "2026-10-17", false, JSONArray(), true))
    assertEquals("₩300", PortfolioWidgetStore.snapshot(context)!!.getString("totalValue"))
  }
  @Test fun dailyGateSurvivesRepeatedForegroundAndBackgroundCalls() {
    val r = JSONObject().put("enabled", true)
    val now = 200000000L
    assertTrue(HomeAccountSync.due(r, "2026-10-17", now))
    r.put("day", "2026-10-17")
    assertFalse(HomeAccountSync.due(r, "2026-10-17", now))
    assertTrue(HomeAccountSync.due(r, "2026-10-18", now))
    r.put("enabled", false); assertFalse(HomeAccountSync.due(r, "2026-10-18", now))
    r.put("enabled", true).put("attempt", now - 1000)
    assertFalse(HomeAccountSync.due(r, "2026-10-18", now))
    assertTrue(HomeAccountSync.due(r, "2026-10-18", now + 1800000))
  }
  @Test fun coinSnapshotUsesLockedBalanceAndExactCostAndRejectsUnsupportedCurrency() {
    val r = JSONObject().put("currency", "BTC").put("balance", "0.00001").put("locked", "0.00002").put("avg_buy_price", "100000000").put("unit_currency", "KRW")
    val p = BrokerSnapshot.upbit(JSONArray().put(r)).getJSONObject(0)
    assertEquals("0.00003", p.getString("quantity")); assertEquals("3000", p.getString("original_investment_krw"))
    r.put("unit_currency", "USDT")
    assertThrows(IllegalArgumentException::class.java) { BrokerSnapshot.upbit(JSONArray().put(r)) }
    r.put("unit_currency", "KRW").put("avg_buy_price", "0")
    assertEquals("0", BrokerSnapshot.upbit(JSONArray().put(r)).getJSONObject(0).getString("original_investment_krw"))
  }
  @Test fun domesticSnapshotMergesLotsAndRejectsCreditWithoutDeletingPreviousData() {
    fun row(q: String, cost: String) = JSONObject().put("stk_cd", "A360750").put("stk_nm", "ETF").put("rmnd_qty", q).put("pur_amt", cost).put("crd_tp", "00")
    val p = BrokerSnapshot.kiwoom(JSONArray().put(row("2", "40000")).put(row("1", "30000")), setOf("360750")).getJSONObject(0)
    assertEquals("3", p.getString("quantity")); assertEquals("70000", p.getString("original_investment_krw")); assertEquals("domestic_etf", p.getString("asset_type"))
    assertThrows(IllegalArgumentException::class.java) { BrokerSnapshot.kiwoom(JSONArray().put(row("1", "1").put("crd_tp", "03")), emptySet()) }
  }
  @Test fun deviceJwtIsHS512WithUniqueNonceAndLiteralSecret() {
    val jwt = BrokerSnapshot.jwt("access", "secret"); val pieces = jwt.split('.')
    assertNotEquals(jwt, BrokerSnapshot.jwt("access", "secret"))
    val payload = JSONObject(String(Base64.decode(pieces[1], Base64.URL_SAFE)))
    assertEquals("access", payload.getString("access_key"))
    val mac = Mac.getInstance("HmacSHA512").apply { init(SecretKeySpec("secret".toByteArray(), "HmacSHA512")) }
    assertArrayEquals(mac.doFinal((pieces[0] + "." + pieces[1]).toByteArray()), Base64.decode(pieces[2], Base64.URL_SAFE))
  }
  @Test fun kiwoomOnlyCommitsCompletePaginationAndNeverUsesAnUnapprovedHost() {
    val urls = mutableListOf<String>(); var balances = 0
    val transport = { url: String, _: JSONObject?, headers: Map<String,String> ->
      urls.add(url)
      when {
        url.endsWith("/oauth2/token") -> """{"return_code":0,"token":"token"}""" to emptyMap<String,List<String>>()
        headers["api-id"] == "ka10099" -> """{"return_code":0,"list":[{"code":"360750"}]}""" to emptyMap()
        else -> { balances++; """{"return_code":0,"acnt_evlt_remn_indv_tot":[{"stk_cd":"A360750","stk_nm":"ETF","rmnd_qty":"1","pur_amt":"100"}]}""" to if (balances == 1) mapOf("cont-yn" to listOf("Y"), "next-key" to listOf("next")) else emptyMap() }
      }
    }
    val rows = BrokerSnapshot(null, "key", "secret", transport).fetch("kiwoom")
    assertEquals("2", rows.getJSONObject(0).getString("quantity")); assertEquals(2, balances)
    assertTrue(urls.all { it.startsWith("https://api.kiwoom.com/") })
    val broken = { _: String, _: JSONObject?, h: Map<String,String> ->
      if (h.isEmpty()) """{"return_code":0,"token":"token"}""" to emptyMap<String,List<String>>() else """{"return_code":0,"list":[]}""" to mapOf("cont-yn" to listOf("Y"), "next-key" to listOf(""))
    }
    assertThrows(IllegalArgumentException::class.java) { BrokerSnapshot(null, "key", "secret", broken).fetch("kiwoom") }
  }
}
