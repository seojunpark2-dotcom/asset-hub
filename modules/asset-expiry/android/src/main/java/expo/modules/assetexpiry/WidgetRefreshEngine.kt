package expo.modules.assetexpiry

import org.json.JSONArray
import org.json.JSONObject
import android.net.Network
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.net.HttpURLConnection
import java.net.URI
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object WidgetRefreshEngine {
  data class Refresh(val snapshot: JSONObject, val quotes: JSONObject, val complete: Boolean, val errors: List<String> = emptyList())
  private fun failure(e: Exception): String = when (e) {
    is HttpError -> if (e.status == 429) "HTTP 429 · 시세 조회 제한. 잠시 후 재시도하세요." else "HTTP ${e.status}"
    is java.net.SocketTimeoutException -> "연결 시간 초과"
    is java.net.UnknownHostException -> "서버 주소 확인 실패"
    is java.io.IOException -> "네트워크 연결 실패"
    else -> "시세 응답 검증 실패"
  }
  private val math = MathContext(40, RoundingMode.HALF_UP)
  private class HttpError(val status: Int) : Exception()
  internal fun configureRequest(connection: HttpURLConnection) {
    // Yahoo can reject Android's implicit Dalvik identity with HTTP 429.
    // Identify this app explicitly; do not impersonate a browser or bypass a rate limit.
    connection.setRequestProperty("User-Agent", "AssetHub/1.17.0 (Android; personal portfolio)")
    connection.setRequestProperty("Accept", "application/json")
    connection.instanceFollowRedirects = false
    connection.connectTimeout = 12000; connection.readTimeout = 12000
  }
  private fun request(url: String, network: Network? = null): String {
    val target = URI(url).toURL()
    val connection = (network?.openConnection(target) ?: target.openConnection()) as HttpURLConnection
    try {
      configureRequest(connection)
      if (connection.responseCode != 200) throw HttpError(connection.responseCode)
      return connection.inputStream.bufferedReader().use { it.readText() }
    } finally { connection.disconnect() }
  }
  private fun price(value: String): BigDecimal = BigDecimal(value).also { require(it.signum() > 0) }
  private fun iso(value: Long = System.currentTimeMillis()): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(value))
  private fun timestamp(value: Long): String {
    require(value > 0 && value <= System.currentTimeMillis() + 60000)
    return iso(value)
  }
  private fun quote(symbol: String, market: String, currency: String, value: String, time: String, source: String): JSONObject {
    price(value)
    return JSONObject().put("symbol", symbol).put("market", market).put("currency", currency)
      .put("current_price", value).put("updated_at", time).put("fetched_at", iso())
      .put("source", source).put("delayed", market != "UPBIT").put("stale", false)
  }
  internal fun yahooMeta(data: JSONObject, symbol: String, currency: String, kind: String, exchanges: List<String>): JSONObject {
    val chart = data.getJSONObject("chart")
    require(chart.isNull("error"))
    val results = chart.getJSONArray("result"); require(results.length() == 1)
    val meta = results.getJSONObject(0).getJSONObject("meta")
    require(meta.getString("symbol") == symbol && meta.getString("currency") == currency)
    require(meta.getString("instrumentType") == kind && meta.getString("exchangeName") in exchanges)
    price(meta.getString("regularMarketPrice")); timestamp(meta.getLong("regularMarketTime") * 1000)
    return meta
  }
  private fun fetch(h: JSONObject, get: (String) -> String = { request(it) }): JSONObject {
    val symbol = h.getString("symbol"); val type = h.getString("asset_type")
    if (type == "crypto") {
      require(Regex("KRW-[A-Z0-9]{2,15}").matches(symbol))
      val rows = JSONArray(get("https://api.upbit.com/v1/ticker?markets=$symbol"))
      val item = (0 until rows.length()).map { rows.getJSONObject(it) }.first { it.getString("market") == symbol }
      return quote(symbol, "UPBIT", "KRW", item.getString("trade_price"), timestamp(item.getLong("trade_timestamp")), "Upbit")
    }
    val domestic = type.startsWith("domestic")
    require(type in listOf("domestic_stock", "domestic_etf", "foreign_stock", "foreign_etf"))
    require(if (domestic) Regex("[A-Z0-9]{6}").matches(symbol) else Regex("[A-Z][A-Z0-9.-]{0,14}").matches(symbol))
    val etf = type.endsWith("etf"); val currency = if (domestic) "KRW" else "USD"
    val suffixes = if (!domestic) listOf("") else if (etf) listOf(".KS") else listOf(".KS", ".KQ")
    for (suffix in suffixes) {
      val ticker = if (domestic) symbol + suffix else symbol.replace('.', '-')
      val data = try { JSONObject(get("https://query1.finance.yahoo.com/v8/finance/chart/$ticker?interval=1d&range=5d")) }
      catch (e: HttpError) { if (domestic && !etf && suffix == ".KS" && e.status == 404) continue else throw e }
      val chart = data.getJSONObject("chart")
      if (domestic && !etf && suffix == ".KS" && chart.optJSONObject("error")?.optString("code") == "Not Found") continue
      require(chart.isNull("error"))
      val results = chart.getJSONArray("result"); require(results.length() == 1)
      val raw = results.getJSONObject(0).getJSONObject("meta")
      // Never fall back for a ticker/currency mismatch or a network/429 error.
      require(raw.getString("symbol") == ticker && raw.getString("currency") == currency)
      val exchanges = if (!domestic) listOf("NMS", "NGM", "NCM", "NYQ", "PCX", "ASE", "BTS", "BATS")
        else if (suffix == ".KS") listOf("KSC", "KOS") else listOf("KOE", "KQ")
      val kind = if (etf) "ETF" else "EQUITY"
      if (domestic && !etf && suffix == ".KS" && (raw.optString("instrumentType") != kind || raw.optString("exchangeName") !in exchanges)) continue
      val meta = yahooMeta(data, ticker, currency, kind, exchanges)
      return quote(symbol, if (domestic) "KR" else "US", currency, meta.getString("regularMarketPrice"), timestamp(meta.getLong("regularMarketTime") * 1000), "Yahoo Finance · 정규장 가격 · 지연 가능 시세")
    }
    throw IllegalArgumentException("Unsupported Yahoo instrument")
  }
  fun refreshOnWifi(input: JSONObject, network: Network): Refresh = refresh(input,
    fetchQuote = { h -> fetch(h) { url -> request(url, network) } },
    fetchFx = { JSONObject(request("https://api.frankfurter.dev/v2/rate/USD/KRW", network)) })
  fun refresh(input: JSONObject, stopped: () -> Boolean = { false }, fetchQuote: (JSONObject) -> JSONObject = { fetch(it) }, fetchFx: () -> JSONObject = { JSONObject(request("https://api.frankfurter.dev/v2/rate/USD/KRW")) }): Refresh {
    val holdings = input.getJSONArray("holdings")
    val quotes = JSONObject(input.optJSONObject("quotes")?.toString() ?: "{}")
    var complete = true
    val errors = mutableListOf<String>()
    val fetched = mutableSetOf<String>()
    for (i in 0 until holdings.length()) {
      check(!stopped())
      val h = holdings.getJSONObject(i); val key = key(h)
      if (!fetched.add(key)) continue
      try { quotes.put(key, fetchQuote(h)) }
      catch (e: Exception) { complete = false; errors.add("${h.optString("symbol").take(24)}: ${failure(e)}"); quotes.optJSONObject(key)?.put("stale", true) }
    }
    if ((0 until holdings.length()).any { holdings.getJSONObject(it).getString("purchase_currency") == "USD" }) {
      check(!stopped())
      try {
        val fx = fetchFx()
        require(fx.getString("base") == "USD" && fx.getString("quote") == "KRW")
        val dateText = fx.getString("date")
        require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(dateText))
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false; timeZone = TimeZone.getTimeZone("UTC") }.parse(dateText)!!.time
        quotes.put("FX:USD/KRW", quote("USD/KRW", "FX", "KRW", fx.getString("rate"), timestamp(date), "Frankfurter · 일별 기준환율"))
      } catch (e: Exception) { complete = false; errors.add("USD/KRW 환율: ${failure(e)}"); quotes.optJSONObject("FX:USD/KRW")?.put("stale", true) }
    }
    return Refresh(snapshot(input, quotes), quotes, complete, errors)
  }
  private fun key(h: JSONObject): String {
    val type = h.getString("asset_type")
    return (if (type == "crypto") "UPBIT" else if (type.startsWith("domestic")) "KR" else "US") + ":" + h.getString("symbol")
  }
  internal fun snapshot(input: JSONObject, quotes: JSONObject): JSONObject {
    val holdings = input.getJSONArray("holdings"); val global = input.optString("colors") == "global"
    fun color(profit: BigDecimal?): String = if (profit == null) "#A2AFC3" else if (profit.signum() >= 0) { if (global) "#15AB82" else "#FF727C" } else { if (global) "#FF727C" else "#65A4FF" }
    data class Row(val h: JSONObject, val cost: BigDecimal, val value: BigDecimal?, val profit: BigDecimal?)
    var stale = false; var delayed = false
    val rows = (0 until holdings.length()).map { i ->
      val h = holdings.getJSONObject(i); val q = quotes.optJSONObject(key(h))
      val usd = h.getString("purchase_currency") == "USD"; val fx = if (usd) quotes.optJSONObject("FX:USD/KRW") else null
      val cost = BigDecimal(h.getString("original_investment_krw")).also { require(it.signum() >= 0) }
      val value = if (q == null || (usd && fx == null)) null else price(q.getString("current_price"))
        .multiply(price(h.getString("quantity")), math).multiply(if (usd) price(fx!!.getString("current_price")) else BigDecimal.ONE, math)
      stale = stale || value == null || q?.optBoolean("stale", false) == true || fx?.optBoolean("stale", false) == true
      delayed = delayed || q?.optBoolean("delayed", false) == true || fx?.optBoolean("delayed", false) == true
      Row(h, cost, value, value?.subtract(cost, math))
    }.sortedWith(compareByDescending<Row> { it.value })
    val cost = rows.fold(BigDecimal.ZERO) { a, r -> a.add(r.cost, math) }
    val value = if (rows.any { it.value == null }) null else rows.fold(BigDecimal.ZERO) { a, r -> a.add(r.value!!, math) }
    val profit = value?.subtract(cost, math)
    val array = JSONArray()
    for (r in rows) array.put(JSONObject().put("id", r.h.getString("id")).put("name", r.h.getString("name"))
      .put("percent", percent(r.profit, r.cost)).put("color", color(r.profit)))
    return JSONObject().put("totalValue", money(value)).put("totalProfit", signedMoney(profit)).put("totalPercent", percent(profit, cost))
      .put("totalColor", color(profit)).put("updatedAt", iso()).put("stale", stale).put("delayed", delayed).put("rows", array)
  }
  private fun money(v: BigDecimal?): String = if (v == null) "—" else "₩" + v.setScale(0, RoundingMode.HALF_UP).toPlainString().replace(Regex("\\B(?=(\\d{3})+(?!\\d))"), ",")
  private fun signedMoney(v: BigDecimal?): String = if (v == null) "—" else (if (v.signum() > 0) "+" else "") + money(v)
  private fun percent(profit: BigDecimal?, cost: BigDecimal): String {
    if (profit == null || cost.signum() <= 0) return "—"
    val value = profit.divide(cost, math).multiply(BigDecimal(100), math)
    return (if (value.signum() > 0) "+" else "") + value.setScale(2, RoundingMode.HALF_UP).toPlainString() + "%"
  }
}
