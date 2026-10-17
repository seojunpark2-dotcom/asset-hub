package expo.modules.assetexpiry

import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** Network configuration is separate from the per-provider daily ledger. Editing it never resets a query day. */
internal object AccountWifiRegistry {
  const val LIMIT = 10
  fun entries(data: JSONObject): JSONArray = requireNotNull(data.optJSONArray("wifiNetworks")) { "Wi-Fi 등록 목록을 읽지 못했습니다." }
  fun migrate(data: JSONObject): Boolean {
    if (data.has("wifiNetworks")) { entries(data); return false }
    val rows = JSONArray()
    val ssid = data.optString("ssid"); val ip = data.optString("ip")
    if (ssid.isNotBlank() && ip.isNotBlank()) rows.put(profile("legacy-home", "집 Wi-Fi", ssid, ip))
    data.put("wifiNetworks", rows); data.remove("ssid"); data.remove("ip")
    return true
  }
  fun profile(id: String, label: String, ssid: String, ip: String): JSONObject {
    require(ssid.isNotBlank() && ssid != "<unknown ssid>" && ssid.toByteArray(Charsets.UTF_8).size <= 32) { "Wi-Fi 이름(SSID)을 정확히 입력하세요." }
    require(label.trim().length <= 40) { "별칭은 40자 이내로 입력하세요." }
    val address = ip.trim()
    val parts = address.split('.')
    require(parts.size == 4 && parts.all { val n = it.toIntOrNull(); n != null && n in 0..255 && n.toString() == it }) { "올바른 공인 IPv4 주소를 입력하세요." }
    val n = parts.map { it.toInt() }
    require(n[0] !in listOf(0,10,127) && n[0] < 224 && !(n[0]==172 && n[1] in 16..31) &&
      !(n[0]==192 && n[1]==168) && !(n[0]==169 && n[1]==254) && !(n[0]==100 && n[1] in 64..127)) { "사설 IP가 아닌 인터넷 공인 IPv4 주소를 입력하세요." }
    return JSONObject().put("id", id).put("label", label.trim().ifEmpty { ssid }).put("ssid", ssid).put("ip", address)
  }
  fun matches(data: JSONObject, ssid: String, ip: String): Boolean = (0 until entries(data).length()).any {
    val w = entries(data).getJSONObject(it); w.getString("ssid") == ssid && w.getString("ip") == ip
  }
  fun hasSsid(data: JSONObject, ssid: String): Boolean = (0 until entries(data).length()).any { entries(data).getJSONObject(it).getString("ssid") == ssid }
  fun add(data: JSONObject, ssid: String, ip: String) {
    migrate(data)
    val row = profile(UUID.randomUUID().toString(), ssid, ssid, ip)
    if (matches(data, ssid, row.getString("ip"))) return
    require(entries(data).length() < LIMIT) { "Wi-Fi는 최대 ${LIMIT}곳까지 등록할 수 있습니다." }
    entries(data).put(row)
  }
  fun update(data: JSONObject, id: String, label: String, ssid: String, ip: String) {
    migrate(data)
    val row = profile(id, label, ssid, ip); val rows = entries(data)
    val index = (0 until rows.length()).firstOrNull { rows.getJSONObject(it).getString("id") == id }
      ?: error("수정할 Wi-Fi가 없습니다. 목록을 다시 확인하세요.")
    require((0 until rows.length()).none { it != index && rows.getJSONObject(it).getString("ssid") == ssid && rows.getJSONObject(it).getString("ip") == row.getString("ip") }) { "이미 등록된 Wi-Fi와 IP 조합입니다." }
    rows.put(index, row)
  }
  fun remove(data: JSONObject, id: String) {
    migrate(data)
    val rows = entries(data)
    data.put("wifiNetworks", JSONArray().apply { for (i in 0 until rows.length()) if (rows.getJSONObject(i).getString("id") != id) put(rows.getJSONObject(i)) })
  }
}
