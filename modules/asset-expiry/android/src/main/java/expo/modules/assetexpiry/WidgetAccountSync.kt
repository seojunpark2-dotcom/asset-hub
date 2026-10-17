package expo.modules.assetexpiry

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

object WidgetAccountSync {
  private const val ALIAS = "portfolio-widget-account-key"
  private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "portfolio-widget-account.enc"))
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    if (!store.containsAlias(ALIAS)) KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
      generateKey()
    }
    return store.getKey(ALIAS, null) as SecretKey
  }
  @Synchronized private fun read(context: Context): JSONObject? = try {
    val data = JSONObject(file(context).openRead().use { it.readBytes().toString(Charsets.UTF_8) })
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(data.getString("iv"), Base64.NO_WRAP)))
    JSONObject(String(cipher.doFinal(Base64.decode(data.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
  } catch (_: Exception) { null }
  @Synchronized private fun write(context: Context, value: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val data = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("data", Base64.encodeToString(cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
    val target = file(context); val stream = target.startWrite()
    try { stream.write(data.toString().toByteArray(Charsets.UTF_8)); target.finishWrite(stream) }
    catch (e: Exception) { target.failWrite(stream); throw e }
  }
  @Synchronized fun clear(context: Context) { file(context).delete() }
  fun prepare(context: Context, userId: String, url: String, publishable: String): String {
    require(userId.isNotEmpty() && URI(url).scheme == "https")
    require(PortfolioWidgetStore.refreshState(context).optString("userId") == userId)
    val existing = read(context)
    val data = if (existing?.optString("userId") == userId) existing else JSONObject()
      .put("userId", userId).put("deviceId", UUID.randomUUID().toString())
      .put("token", (UUID.randomUUID().toString() + UUID.randomUUID().toString()).replace("-", ""))
    data.put("url", url).put("apikey", publishable)
    write(context, data)
    return JSONObject().put("deviceId", data.getString("deviceId")).put("token", data.getString("token")).toString()
  }
  // This token can only synchronize/read this user's portfolio; it cannot trade or manage credentials.
  fun setAuthorization(context: Context, userId: String, authorization: String) {
    require(PortfolioWidgetStore.refreshState(context).optString("userId") == userId)
    val data = requireNotNull(read(context));require(data.optString("userId") == userId)
    require(authorization.split('.').size == 3)
    data.put("authorization", authorization);write(context, data)
  }
  fun holdings(context: Context, userId: String, localOnly: Boolean = true): JSONObject? = request(context, userId,
    JSONObject().put("action", if (localOnly) "local-background" else "background"))
  // A foreground user JWT plus a registered device proof are both required. Never persist the user JWT or return keys to JS.
  fun importCredentials(context: Context, userId: String, provider: String, userJwt: String) {
    require(provider in listOf("kiwoom", "upbit") && userJwt.split('.').size == 3)
    require(PortfolioWidgetStore.refreshState(context).optString("userId") == userId)
    val data = requireNotNull(read(context)) { "기기 연결을 먼저 갱신하세요." }
    require(data.optString("userId") == userId)
    val target = URI(data.getString("url")); require(target.scheme == "https")
    val connection = target.toURL().openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"; connection.doOutput = true; connection.connectTimeout = 15000; connection.readTimeout = 20000
      connection.instanceFollowRedirects = false; connection.useCaches = false
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("apikey", data.getString("apikey"))
      connection.setRequestProperty("Authorization", "Bearer $userJwt")
      connection.setRequestProperty("X-Widget-Token", data.getString("token"))
      val body = JSONObject().put("action", "credentials").put("provider", provider).put("deviceId", data.getString("deviceId"))
      connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      check(connection.responseCode == 200) { "키를 받지 못했습니다. Supabase 키 등록·본인 권한·로그인 상태를 확인하세요." }
      val result = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
      require(result.optBoolean("ok"))
      HomeAccountSync.saveImported(context, userId, provider, result.getString("access"), result.getString("secret"))
    } finally { connection.disconnect() }
  }
  fun request(context: Context, userId: String, body: JSONObject): JSONObject? {
    val data = read(context) ?: if (file(context).baseFile.exists()) throw IllegalStateException("Widget device credential unavailable") else return null
    if (data.optString("userId") != userId) return null
    val connection = URI(data.getString("url")).toURL().openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"; connection.doOutput = true; connection.connectTimeout = 15000; connection.readTimeout = 140000
      connection.instanceFollowRedirects = false
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("apikey", data.getString("apikey"))
      connection.setRequestProperty("Authorization", "Bearer " + data.getString("authorization"))
      connection.setRequestProperty("X-Widget-Token", data.getString("token"))
      body.put("deviceId", data.getString("deviceId"))
      connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      check(connection.responseCode == 200) { "기기 연결 또는 자산 저장 실패. 앱에서 로그인 상태를 확인하세요." }
      val result = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
      require(result.optJSONArray("holdings") != null || result.optBoolean("ok"))
      return result
    } finally { connection.disconnect() }
  }
}
