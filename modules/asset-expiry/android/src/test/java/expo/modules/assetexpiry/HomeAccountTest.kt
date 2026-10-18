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
  @Test fun unifiedBatchWaitsForAllEnabledAccountsAndPublishesOnlyOncePerKoreanDay() {
    val day = "2026-10-18"
    val data = JSONObject().put("kiwoom", JSONObject().put("enabled", true).put("day", day).put("synced", "ok"))
      .put("upbit", JSONObject().put("enabled", true).put("day", "2026-10-17").put("synced", "old"))
    assertFalse(HomeAccountSync.accountsReady(data, day))
    data.getJSONObject("upbit").put("day", day).put("pending", JSONArray())
    assertFalse(HomeAccountSync.accountsReady(data, day))
    data.getJSONObject("upbit").remove("pending")
    assertTrue(HomeAccountSync.accountsReady(data, day))
    val context = RuntimeEnvironment.getApplication(); PortfolioWidgetStore.setUser(context, "batch-owner")
    PortfolioWidgetStore.setRefreshInput(context, "batch-owner", widgetInput().toString())
    PortfolioWidgetStore.markAccountChanged(context, "batch-owner")
    val state = PortfolioWidgetStore.refreshState(context)
    val snapshot = JSONObject().put("rows", JSONArray()).put("totalValue", "₩300")
    assertTrue(HomeAccountSync.batchDue(state, day))
    assertFalse(PortfolioWidgetStore.commitRefresh(context, state, snapshot, JSONObject(), day, false, accountSnapshot = true))
    assertNull(PortfolioWidgetStore.snapshot(context))
    assertTrue(PortfolioWidgetStore.commitRefresh(context, state, snapshot, JSONObject(), day, true, accountSnapshot = true))
    assertFalse(HomeAccountSync.batchDue(PortfolioWidgetStore.refreshState(context), day))
    assertTrue(HomeAccountSync.batchDue(PortfolioWidgetStore.refreshState(context), "2026-10-19"))
    assertFalse(PortfolioWidgetStore.commitRefresh(context, state, snapshot.put("totalValue", "₩999"), JSONObject(), day, true, accountSnapshot = true))
    PortfolioWidgetStore.update(context, "batch-owner", snapshot.toString())
    PortfolioWidgetStore.setRefreshInput(context, "batch-owner", widgetInput().put("quotes", JSONObject().put("price", 999)).toString())
    assertEquals("₩300", PortfolioWidgetStore.snapshot(context)!!.getString("totalValue"))
    assertEquals(state.getString("revision"), PortfolioWidgetStore.refreshState(context).getString("revision"))
    assertEquals(day, PortfolioWidgetStore.refreshState(context).getString("dailyWifiDay"))
  }
  @Test fun everyNewAccountReadUsesFreshServerKeysAndOutboxRetriesDoNotReadKeysOrBrokerAgain() {
    val r = JSONObject().put("access", "old-access").put("secret", "old-secret")
    var loads = 0; var reads = 0
    val keys = { loads++; JSONObject().put("ok", true).put("access", "new-access").put("secret", "new-secret") }
    val fetch = { access: String, secret: String -> reads++; assertEquals("new-access", access); assertEquals("new-secret", secret); JSONArray() }
    HomeAccountSync.fetchPending(r, "2026-10-18", 1000, keys, fetch)
    assertEquals(1, loads); assertEquals(1, reads); assertEquals(1000L, r.getLong("keyFetchedAt"))
    HomeAccountSync.fetchPending(r, "2026-10-18", 2000, { error("must reuse pending snapshot") }, fetch)
    assertEquals(1, loads); assertEquals(1, reads)
    r.remove("pending")
    assertThrows(IllegalStateException::class.java) { HomeAccountSync.fetchPending(r, "2026-10-19", 3000, { error("server unavailable") }, fetch) }
    assertEquals(1, reads); assertEquals("2026-10-18", r.getString("day")); assertFalse(r.has("pending"))
    HomeAccountSync.fetchPending(r, "2026-10-19", 4000, keys, fetch)
    assertEquals(2, loads); assertEquals(2, reads); assertEquals("2026-10-19", r.getString("day"))
    assertFalse(HomeAccountSync.providerStatus(r).toString().contains("new-secret"))
  }
  @Test fun importedKeysRejectAChangedLoginBeforeReadingOrWritingTheVault() {
    val context = RuntimeEnvironment.getApplication()
    PortfolioWidgetStore.setUser(context, "current-owner")
    assertThrows(IllegalArgumentException::class.java) { HomeAccountSync.saveImported(context, "previous-owner", "kiwoom", "dummy-access", "dummy-secret") }
    assertThrows(IllegalArgumentException::class.java) { WidgetAccountSync.importCredentials(context, "previous-owner", "kiwoom", "a.b.c") }
    assertFalse(java.io.File(context.noBackupFilesDir, "portfolio-home-account.enc").exists())
  }
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
    HomeAccountSync.refreshWidget(context, now, load, refresh = refresh)
    val snapshot = PortfolioWidgetStore.snapshot(context)!!
    assertEquals("₩300", snapshot.getString("totalValue")); assertEquals("+₩100", snapshot.getString("totalProfit")); assertEquals("+50.00%", snapshot.getString("totalPercent"))
    assertEquals("+50.00%", snapshot.getJSONArray("rows").getJSONObject(0).getString("percent"))
    assertFalse(PortfolioWidgetStore.refreshState(context).getBoolean("accountWidgetPending"))
    assertTrue(PortfolioWidgetStore.refreshState(context).getLong("accountWidgetSyncedAt") > 0)
    HomeAccountSync.refreshWidget(context, now + 2000000, load, refresh = refresh); assertEquals(1, loads)
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
    assertEquals(0, BrokerSnapshot.upbit(JSONArray().put(r)).length())
    r.put("balance", "1").put("locked", "0").put("avg_buy_price", "0.999999999999")
    assertEquals(0, BrokerSnapshot.upbit(JSONArray().put(r)).length())
    r.put("avg_buy_price", "1")
    assertEquals("1", BrokerSnapshot.upbit(JSONArray().put(r)).getJSONObject(0).getString("original_investment_krw"))
  }
  @Test fun domesticSnapshotMergesLotsAndRejectsCreditWithoutDeletingPreviousData() {
    fun row(q: String, cost: String) = JSONObject().put("stk_cd", "A360750").put("stk_nm", "ETF").put("rmnd_qty", q).put("pur_amt", cost).put("crd_tp", "00")
    val p = BrokerSnapshot.kiwoom(JSONArray().put(row("2", "40000")).put(row("1", "30000")), setOf("360750")).getJSONObject(0)
    assertEquals("3", p.getString("quantity")); assertEquals("70000", p.getString("original_investment_krw")); assertEquals("domestic_etf", p.getString("asset_type"))
    assertThrows(IllegalArgumentException::class.java) { BrokerSnapshot.kiwoom(JSONArray().put(row("1", "1").put("crd_tp", "03")), emptySet()) }
    assertEquals(0, BrokerSnapshot.kiwoom(JSONArray().put(row("1", "0.999999999999")), emptySet()).length())
    assertEquals("1", BrokerSnapshot.kiwoom(JSONArray().put(row("1", "0.6")).put(row("1", "0.4")), emptySet()).getJSONObject(0).getString("original_investment_krw"))
  }
  @Test fun deletedAssetsAreRemovedFromPublishedWidgetWithoutAnotherDailyFetch() {
    val context = RuntimeEnvironment.getApplication(); val user = "dust-widget"
    PortfolioWidgetStore.setUser(context, user)
    val holdings = JSONArray().put(accountHolding()).put(JSONObject(accountHolding().toString()).put("id", "dust").put("quantity", "0.001").put("original_investment_krw", "0"))
    val input = widgetInput().put("holdings", holdings)
    PortfolioWidgetStore.setRefreshInput(context, user, input.toString())
    val quotes = JSONObject().put("KR:360750", JSONObject().put("current_price", "150"))
    val day = "2026-10-18"
    assertTrue(PortfolioWidgetStore.commitRefresh(context, PortfolioWidgetStore.refreshState(context), WidgetRefreshEngine.snapshot(input, quotes), quotes, day, true, holdings, true))
    val next = widgetInput().put("holdings", JSONArray().put(accountHolding())).put("quotes", JSONObject().put("KR:360750", JSONObject().put("current_price", "999")))
    PortfolioWidgetStore.setRefreshInput(context, user, next.toString())
    val snapshot = PortfolioWidgetStore.snapshot(context)!!
    assertEquals(1, snapshot.getJSONArray("rows").length())
    assertEquals("ETF", snapshot.getJSONArray("rows").getJSONObject(0).getString("id"))
    assertEquals("₩300", snapshot.getString("totalValue")); assertEquals("+₩100", snapshot.getString("totalProfit"))
    assertEquals("+50.00%", snapshot.getString("totalPercent"))
    assertEquals(day, PortfolioWidgetStore.refreshState(context).getString("dailyWifiDay"))
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
