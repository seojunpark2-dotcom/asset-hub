package expo.modules.assetexpiry

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

internal class DeviceVault(context: Context, private val name: String) {
  private val file = AtomicFile(File(context.noBackupFilesDir, "$name.enc"))
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    if (!store.containsAlias(name)) KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(name, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
      generateKey()
    }
    return store.getKey(name, null) as SecretKey
  }
  fun read(): JSONObject? {
    if (!file.baseFile.exists()) return null
    // Fail closed on unreadable credentials. Never silently overwrite a failed/deleted daily ledger.
    try {
      val data = JSONObject(file.openRead().use { it.readBytes().toString(Charsets.UTF_8) })
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(data.getString("iv"), Base64.NO_WRAP)))
      return JSONObject(String(cipher.doFinal(Base64.decode(data.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
    } catch (_: Exception) { error("기기 보안 저장소를 읽지 못했습니다. 앱 설정을 확인하세요.") }
  }
  fun write(value: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val data = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("data", Base64.encodeToString(cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
    val stream = file.startWrite()
    try { stream.write(data.toString().toByteArray(Charsets.UTF_8)); file.finishWrite(stream) }
    catch (e: Exception) { file.failWrite(stream); throw e }
  }
  fun clear() = file.delete()
}
