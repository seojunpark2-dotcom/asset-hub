package expo.modules.assetexpiry

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33])
class AccountWifiRegistryTest {
  private fun legacy() = JSONObject().put("ssid", "Home").put("ip", "203.0.113.7")
    .put("kiwoom", JSONObject().put("enabled", true).put("day", "2026-10-17").put("attempt", 1L).put("access", "key").put("secret", "secret").put("pending", JSONArray()))
  @Test fun upgradePreservesExistingWifiCredentialsAndDailyOutboxAndDoesNotResurrectDeletedEntries() {
    val data = legacy(); val record = data.getJSONObject("kiwoom").toString()
    assertTrue(AccountWifiRegistry.migrate(data)); assertFalse(AccountWifiRegistry.migrate(data))
    assertTrue(AccountWifiRegistry.matches(data, "Home", "203.0.113.7")); assertEquals(record, data.getJSONObject("kiwoom").toString())
    assertFalse(data.has("ssid")); assertFalse(data.has("ip"))
    AccountWifiRegistry.remove(data, "legacy-home")
    assertFalse(AccountWifiRegistry.migrate(data)); assertEquals(0, AccountWifiRegistry.entries(data).length())
    assertEquals(record, data.getJSONObject("kiwoom").toString())
  }
  @Test fun exactPairsAllowMultiplePlacesButNeverMixSsidAndIpAcrossEntries() {
    val data = JSONObject(); AccountWifiRegistry.add(data, "Home", "203.0.113.7"); AccountWifiRegistry.add(data, "Office", "198.51.100.8")
    assertTrue(AccountWifiRegistry.matches(data, "Home", "203.0.113.7")); assertTrue(AccountWifiRegistry.matches(data, "Office", "198.51.100.8"))
    assertFalse(AccountWifiRegistry.matches(data, "Home", "198.51.100.8")); assertFalse(AccountWifiRegistry.matches(data, "Other", "203.0.113.7"))
    AccountWifiRegistry.add(data, "Home", "198.51.100.9")
    assertTrue(AccountWifiRegistry.matches(data, "Home", "198.51.100.9"))
    AccountWifiRegistry.add(data, "Home", "203.0.113.7"); assertEquals(3, AccountWifiRegistry.entries(data).length())
  }
  @Test fun editsAndMovingBetweenNetworksNeverResetTheProviderDailyLimit() {
    val data = legacy(); AccountWifiRegistry.migrate(data)
    AccountWifiRegistry.add(data, "Office", "198.51.100.8")
    assertTrue(AccountWifiRegistry.matches(data, "Office", "198.51.100.8"))
    assertFalse(HomeAccountSync.due(data.getJSONObject("kiwoom"), "2026-10-17", 200000000L))
    AccountWifiRegistry.update(data, "legacy-home", "My home", "New home", "203.0.113.9")
    assertFalse(AccountWifiRegistry.matches(data, "Home", "203.0.113.7")); assertTrue(AccountWifiRegistry.matches(data, "New home", "203.0.113.9"))
    AccountWifiRegistry.remove(data, "legacy-home")
    assertFalse(HomeAccountSync.due(data.getJSONObject("kiwoom"), "2026-10-17", 200000000L))
    assertTrue(HomeAccountSync.due(data.getJSONObject("kiwoom"), "2026-10-18", 200000000L))
  }
  @Test fun duplicatesLimitsInvalidAddressesAndPrivateIpsAreRejectedWithoutChangingTheList() {
    val data = JSONObject(); AccountWifiRegistry.add(data, "Home", "203.0.113.7"); AccountWifiRegistry.add(data, "Office", "198.51.100.8")
    val id = AccountWifiRegistry.entries(data).getJSONObject(1).getString("id")
    assertThrows(IllegalArgumentException::class.java) { AccountWifiRegistry.update(data, id, "dup", "Home", "203.0.113.7") }
    for (address in listOf("192.168.1.1", "10.0.0.1", "172.16.0.1", "127.0.0.1", "100.64.0.1", "203.0.113.256", "https://example.com", "203.0.113.007")) {
      assertThrows(IllegalArgumentException::class.java) { AccountWifiRegistry.add(data, "Bad", address) }
    }
    assertEquals(2, AccountWifiRegistry.entries(data).length())
    for (i in 2 until AccountWifiRegistry.LIMIT) AccountWifiRegistry.add(data, "WiFi-$i", "203.0.113.${i+10}")
    assertThrows(IllegalArgumentException::class.java) { AccountWifiRegistry.add(data, "Extra", "203.0.113.99") }
    AccountWifiRegistry.add(data, "Home", "203.0.113.7"); assertEquals(10, AccountWifiRegistry.entries(data).length())
  }
}
