package expo.modules.assetexpiry

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import androidx.work.*
import java.math.BigDecimal
import java.math.RoundingMode
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

/** Broker secrets never cross the bridge back to JS, enter logs, or leave the device except to their broker. */
object HomeAccountSync {
  private const val WORK = "portfolio-home-account-daily"
  private fun vault(context: Context) = DeviceVault(context, "portfolio-home-account")
  private fun user(context: Context) = PortfolioWidgetStore.refreshState(context).optString("userId")
  private fun read(context: Context): JSONObject {
    val data = vault(context).read() ?: JSONObject()
    require(data.optString("userId", user(context)) == user(context)) { "로그인을 다시 확인하세요." }
    data.put("userId", user(context))
    if (AccountWifiRegistry.migrate(data) && user(context).isNotEmpty()) vault(context).write(data)
    return data
  }
  @Synchronized fun clear(context: Context) { vault(context).clear(); WorkManager.getInstance(context).cancelUniqueWork(WORK) }
  fun ensure(context: Context) {
    val data = read(context)
    if (user(context).isEmpty() || AccountWifiRegistry.entries(data).length() == 0) {
      WorkManager.getInstance(context).cancelUniqueWork(WORK); return
    }
    val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<HomeAccountWorker>(15, TimeUnit.MINUTES).setConstraints(constraints).build())
  }
  @Suppress("DEPRECATION")
  fun wifi(context: Context): Pair<Network, String> {
    require(context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) { "등록 Wi-Fi 확인을 위해 정확한 위치 권한을 허용하세요." }
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork ?: error("Wi-Fi에 연결하세요.")
    val caps = cm.getNetworkCapabilities(network) ?: error("Wi-Fi에 연결하세요.")
    require(caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) { "VPN을 끄고 Wi-Fi에 연결하세요." }
    val info = (context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager).connectionInfo
    val ssid = info.ssid?.removeSurrounding("\"") ?: ""
    require(ssid.isNotBlank() && ssid != "<unknown ssid>") { "Wi-Fi 이름을 확인할 수 없습니다. 위치 기능과 정확한 위치 권한을 켜세요. 백그라운드는 위치 권한을 항상 허용해야 합니다." }
    return network to ssid
  }
  // Pin each HTTP connection to Wi-Fi. Losing Wi-Fi must never silently route broker keys via mobile data.
  private fun http(network: Network, url: String, body: JSONObject? = null, headers: Map<String, String> = emptyMap()): Pair<String, Map<String, List<String>>> {
    val c = network.openConnection(URL(url)) as HttpURLConnection
    try {
      c.instanceFollowRedirects = false; c.connectTimeout = 15000; c.readTimeout = 20000
      headers.forEach { (k,v) -> c.setRequestProperty(k,v) }
      if (body != null) { c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) } }
      require(c.responseCode == 200) { "기관 조회 실패: API 키·허용 IP·네트워크를 확인하세요." }
      return c.inputStream.bufferedReader().use { it.readText() } to c.headerFields.filterKeys { it != null }
    } finally { c.disconnect() }
  }
  private fun ip(network: Network): String {
    val value = http(network, "https://api4.ipify.org").first.trim()
    require(value.matches(Regex("\\d{1,3}(\\.\\d{1,3}){3}")) && value.split('.').all { it.toInt() in 0..255 }) { "공인 IPv4 확인 실패" }
    return value
  }
  @Synchronized fun registerHome(context: Context): String {
    require(user(context).isNotEmpty())
    val (network, ssid) = wifi(context)
    val address = ip(network)
    val data = read(context)
    AccountWifiRegistry.add(data, ssid, address)
    data.put("observedSsid", ssid).put("observedIp", address).put("ipCheckedAt", System.currentTimeMillis())
    vault(context).write(data); ensure(context)
    return status(context)
  }
  @Synchronized fun updateWifi(context: Context, id: String, label: String, ssid: String, ip: String): String {
    require(user(context).isNotEmpty())
    val data = read(context); AccountWifiRegistry.update(data, id, label, ssid, ip)
    vault(context).write(data); ensure(context); return status(context)
  }
  @Synchronized fun removeWifi(context: Context, id: String): String {
    require(user(context).isNotEmpty())
    val data = read(context); AccountWifiRegistry.remove(data, id)
    vault(context).write(data); ensure(context); return status(context)
  }
  @Synchronized fun checkNetwork(context: Context): String {
    val (network, ssid) = wifi(context)
    val data = read(context).put("observedSsid", ssid).put("observedIp", ip(network)).put("ipCheckedAt", System.currentTimeMillis())
    vault(context).write(data)
    return status(context)
  }
  @Synchronized fun save(context: Context, provider: String, access: String, secret: String) {
    require(provider in listOf("kiwoom", "upbit") && access.trim().length in 1..2048 && secret.trim().length in 1..2048)
    require(user(context).isNotEmpty())
    val data = read(context)
    require(AccountWifiRegistry.entries(data).length() > 0) { "조회에 사용할 Wi-Fi부터 등록하세요." }
    val record = data.optJSONObject(provider) ?: JSONObject()
    // Keep today's fetched snapshot/day even when credentials are edited: no second account fetch today.
    record.put("access", access.trim()).put("secret", secret.trim()).put("enabled", true).put("consent", true)
    data.put(provider, record); vault(context).write(data); ensure(context)
  }
  @Synchronized fun remove(context: Context, provider: String) {
    require(provider in listOf("kiwoom", "upbit"))
    val data = read(context); val r = data.optJSONObject(provider) ?: return
    r.remove("access"); r.remove("secret"); r.remove("pending"); r.put("enabled", false); data.put(provider, r); vault(context).write(data)
  }
  @Synchronized fun status(context: Context): String {
    val data = read(context); val providers = JSONObject()
    for (p in listOf("kiwoom", "upbit")) {
      val r = data.optJSONObject(p) ?: JSONObject()
      providers.put(p, providerStatus(r))
    }
    val widget = PortfolioWidgetStore.refreshState(context)
    return JSONObject().put("networks", AccountWifiRegistry.entries(data)).put("providers", providers)
      .put("observedIp", data.optString("observedIp")).put("observedSsid", data.optString("observedSsid")).put("ipCheckedAt", data.optLong("ipCheckedAt"))
      .put("widgetPending", widget.optBoolean("accountWidgetPending")).put("widgetSyncedAt", widget.optLong("accountWidgetSyncedAt"))
      .put("backgroundPermission", Build.VERSION.SDK_INT < 29 || context.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED).toString()
  }
  internal fun providerStatus(r: JSONObject): JSONObject = JSONObject()
    .put("configured", r.optBoolean("enabled") && r.optString("access").isNotEmpty()).put("lastDay", r.optString("day"))
    .put("lastAttempt", r.optLong("attempt")).put("lastFetched", r.optLong("fetchedAt"))
    .put("usedIp", r.optString("usedIp")).put("lastSynced", r.optString("synced")).put("error", r.optString("error"))
  fun due(record: JSONObject, day: String, now: Long): Boolean = record.optBoolean("enabled") && record.optString("day") != day && now - record.optLong("attempt", 0) >= 30 * 60 * 1000
  @Synchronized fun sync(context: Context): String {
    val owner = user(context); if (owner.isEmpty()) return "{}"
    val data = read(context); val now = System.currentTimeMillis(); val day = WidgetRefreshScheduler.day(now)
    val targets = listOf("kiwoom", "upbit").filter { p -> val r = data.optJSONObject(p); r != null && r.optBoolean("enabled") && (r.has("pending") || due(r, day, now)) }
    if (targets.isEmpty()) return status(context)
    // Any registered SSID/IP pair shares the same provider ledger; switching networks cannot bypass it.
    val (network, ssid) = wifi(context)
    require(AccountWifiRegistry.hasSsid(data, ssid)) { "등록한 Wi-Fi에서만 계좌를 조회합니다." }
    val address = ip(network)
    data.put("observedIp", address).put("observedSsid", ssid).put("ipCheckedAt", System.currentTimeMillis()); vault(context).write(data)
    require(AccountWifiRegistry.matches(data, ssid, address)) { "등록한 Wi-Fi의 공인 IP와 다릅니다. 기관 허용 IP와 Wi-Fi 등록 목록을 확인하세요." }
    for (provider in targets) {
      val r = data.getJSONObject(provider)
      try {
        if (!r.has("pending")) {
          r.put("attempt", now).put("usedIp", address); vault(context).write(data)
          val positions = BrokerSnapshot(network, r.getString("access"), r.getString("secret")).fetch(provider)
          r.put("pending", positions).put("day", day).put("fetchedAt", System.currentTimeMillis()); vault(context).write(data)
        }
        require(user(context) == owner)
        // A failed upload retains the encrypted snapshot and retries it without reading the account twice.
        WidgetAccountSync.request(context, owner, JSONObject().put("action", "local-snapshot").put("provider", provider)
          .put("positions", r.getJSONArray("pending")).put("replaceManual", r.optBoolean("consent"))) ?: error("앱을 한 번 열어 기기 연결을 등록하세요.")
        val synced = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date())
        PortfolioWidgetStore.markAccountChanged(context, owner)
        r.remove("pending"); r.put("consent", false).put("synced", synced).put("error", "")
      } catch (e: Exception) { r.put("error", e.message?.takeIf { !it.contains(r.optString("secret", "\u0000")) } ?: "계좌 동기화 실패") }
      require(user(context) == owner); vault(context).write(data)
    }
    return status(context)
  }
  fun syncAndWidget(context: Context): String {
    try { sync(context) } finally { try { refreshWidget(context) } catch (_: Exception) { /* Durable pending flag retries without another broker fetch. */ } }
    return status(context)
  }
  internal fun widgetDue(state: JSONObject, now: Long): Boolean = state.optBoolean("accountWidgetPending") && now - state.optLong("accountWidgetAttempt") >= 15 * 60 * 1000
  @Synchronized internal fun refreshWidget(context: Context, now: Long = System.currentTimeMillis(),
    load: (String) -> JSONObject? = { WidgetAccountSync.holdings(context, it, true) },
    refresh: (JSONObject) -> WidgetRefreshEngine.Refresh = { WidgetRefreshEngine.refresh(it) }) {
    val state = PortfolioWidgetStore.refreshState(context); val owner = state.optString("userId")
    if (!widgetDue(state, now) || owner.isEmpty()) return
    val input = state.optJSONObject("input") ?: return
    PortfolioWidgetStore.noteAccountWidgetAttempt(context, state, now)
    val result = load(owner) ?: return
    require(result.optBoolean("ok"))
    input.put("holdings", result.getJSONArray("holdings"))
    val quotes = refresh(input)
    PortfolioWidgetStore.commitRefresh(context, state, quotes.snapshot, quotes.quotes, WidgetRefreshScheduler.day(now), quotes.complete, input.getJSONArray("holdings"), true)
  }
}

class HomeAccountWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    try {
      HomeAccountSync.syncAndWidget(applicationContext)
    } catch (_: Exception) { /* Keep previous data; next eligible run retries. */ }
    return Result.success()
  }
}

internal class BrokerSnapshot(private val network: Network?, private val access: String, private val secret: String,
  private val transport: ((String, JSONObject?, Map<String,String>) -> Pair<String,Map<String,List<String>>>)? = null) {
  private fun request(url: String, body: JSONObject? = null, headers: Map<String,String> = emptyMap()): Pair<Any,Map<String,List<String>>> {
    val result = if (transport != null) transport.invoke(url, body, headers) else {
      val c = requireNotNull(network).openConnection(URL(url)) as HttpURLConnection
      try {
        c.instanceFollowRedirects = false; c.connectTimeout = 15000; c.readTimeout = 20000
        headers.forEach { (k,v) -> c.setRequestProperty(k,v) }
        if (body != null) { c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) } }
        check(c.responseCode == 200) { "API 키·허용 IP·기관 조회 한도를 확인하세요." }
        c.inputStream.bufferedReader().use { it.readText() } to c.headerFields.filterKeys { it != null }
      } finally { c.disconnect() }
    }
    return (if (result.first.trim().startsWith("[")) JSONArray(result.first) else JSONObject(result.first)) to result.second
  }
  companion object {
    fun amount(value: String): BigDecimal {
      require(value.matches(Regex("\\d+(\\.\\d+)?"))) { "잔고 응답 형식 오류" }
      val n = BigDecimal(value); require(n.signum() >= 0 && n < BigDecimal("1e18") && n.scale() <= 12) { "잔고 금액 범위 오류" }; return n
    }
    fun position(symbol: String, name: String, type: String, qty: BigDecimal, cost: BigDecimal): JSONObject {
      require(name.isNotBlank() && name.length <= 120 && qty.signum() > 0 && cost < BigDecimal("1e60")) { "지원하지 않는 잔고" }
      return JSONObject().put("symbol", symbol).put("name", name).put("asset_type", type).put("quantity", qty.toPlainString())
        .put("average_purchase_price", cost.divide(qty, 12, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString())
        .put("original_investment_krw", cost.setScale(12, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()).put("purchase_currency", "KRW")
    }
    fun jwt(access: String, secret: String): String {
      fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP or Base64.NO_PADDING or Base64.URL_SAFE)
      val unsigned = encode("{\"alg\":\"HS512\",\"typ\":\"JWT\"}".toByteArray()) + "." + encode(JSONObject().put("access_key", access).put("nonce", UUID.randomUUID().toString()).toString().toByteArray())
      val mac = Mac.getInstance("HmacSHA512").apply { init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA512")) }
      return unsigned + "." + encode(mac.doFinal(unsigned.toByteArray(Charsets.UTF_8)))
    }
    fun upbit(rows: JSONArray, names: Map<String,String> = emptyMap()): JSONArray {
      val result = JSONArray(); val seen = mutableSetOf<String>()
      for (i in 0 until rows.length()) {
        val r = rows.getJSONObject(i); val currency = r.getString("currency"); if (currency == "KRW") continue
        val qty = amount(r.getString("balance")) + amount(r.getString("locked")); if (qty.signum() == 0) continue
        require(currency.matches(Regex("[A-Z0-9]{2,15}")) && r.getString("unit_currency") == "KRW" && seen.add(currency)) { "지원하지 않는 코인 잔고" }
        result.put(position("KRW-$currency", names["KRW-$currency"] ?: currency, "crypto", qty, qty * amount(r.getString("avg_buy_price"))))
      }
      require(result.length() <= 49); return result
    }
    fun kiwoom(rows: JSONArray, etfs: Set<String>): JSONArray {
      data class Lot(var qty: BigDecimal, var cost: BigDecimal, val name: String)
      val merged = linkedMapOf<String,Lot>()
      for (i in 0 until rows.length()) {
        val r = rows.getJSONObject(i); val qty = amount(r.getString("rmnd_qty")); if (qty.signum() == 0) continue
        val symbol = r.getString("stk_cd").removePrefix("A")
        require(symbol.matches(Regex("[A-Z0-9]{6}")) && r.optString("crd_tp", "0").toIntOrNull() == 0) { "신용·대주 또는 지원하지 않는 종목입니다." }
        val lot = merged.getOrPut(symbol) { Lot(BigDecimal.ZERO, BigDecimal.ZERO, r.getString("stk_nm")) }
        lot.qty += qty; lot.cost += amount(r.getString("pur_amt"))
      }
      require(merged.size <= 49)
      return JSONArray().apply { merged.forEach { (s,p) -> put(position(s, p.name, if (s in etfs) "domestic_etf" else "domestic_stock", p.qty, p.cost)) } }
    }
  }
  fun fetch(provider: String): JSONArray {
    if (provider == "upbit") {
      val rows = request("https://api.upbit.com/v1/accounts", headers = mapOf("Authorization" to "Bearer ${jwt(access, secret)}")).first as JSONArray
      val names = mutableMapOf<String,String>()
      try { val markets = request("https://api.upbit.com/v1/market/all").first as JSONArray; for (i in 0 until markets.length()) { val m = markets.getJSONObject(i); names[m.getString("market")] = m.getString("korean_name") } } catch (_: Exception) { }
      return upbit(rows, names)
    }
    require(provider == "kiwoom")
    val tokenData = request("https://api.kiwoom.com/oauth2/token", JSONObject().put("grant_type", "client_credentials").put("appkey", access).put("secretkey", secret)).first as JSONObject
    require(tokenData.optInt("return_code", -1) == 0 && tokenData.optString("token").isNotEmpty()) { "키움 API 키·허용 IP를 확인하세요." }
    val token = tokenData.getString("token")
    fun pages(api: String, path: String, body: JSONObject, field: String): JSONArray {
      var next = ""; val seen = mutableSetOf<String>(); val rows = JSONArray()
      for (page in 0 until 30) {
        val (raw, headers) = request("https://api.kiwoom.com$path", body, mapOf("authorization" to "Bearer $token", "api-id" to api, "cont-yn" to if (page == 0) "N" else "Y", "next-key" to next))
        val data = raw as JSONObject; require(data.optInt("return_code", -1) == 0) { "키움 잔고 조회 실패" }
        val items = data.getJSONArray(field); for (i in 0 until items.length()) rows.put(items.getJSONObject(i))
        fun header(name: String) = headers.entries.firstOrNull { it.key.equals(name, true) }?.value?.firstOrNull() ?: ""
        if (header("cont-yn") != "Y") return rows
        next = header("next-key"); require(next.isNotEmpty() && seen.add(next)) { "잔고 전체 페이지 확인 실패" }; Thread.sleep(250)
      }
      error("잔고 전체 페이지 확인 실패")
    }
    val list = pages("ka10099", "/api/dostk/stkinfo", JSONObject().put("mrkt_tp", "8"), "list")
    val etfs = mutableSetOf<String>(); for (i in 0 until list.length()) { val code = list.getJSONObject(i).getString("code"); require(code.matches(Regex("[A-Z0-9]{6}"))); etfs.add(code) }
    return kiwoom(pages("kt00018", "/api/dostk/acnt", JSONObject().put("qry_tp", "1").put("dmst_stex_tp", "KRX"), "acnt_evlt_remn_indv_tot"), etfs)
  }
}
