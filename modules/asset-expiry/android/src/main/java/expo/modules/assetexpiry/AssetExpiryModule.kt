package expo.modules.assetexpiry

import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.net.Uri

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AssetExpiryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AssetExpiry")
    OnCreate { appContext.reactContext?.let { LegacyCleanup.run(it) } }
    AsyncFunction("setWidgetUser") { userId: String -> PortfolioWidgetStore.setUser(requireNotNull(appContext.reactContext), userId) }
    AsyncFunction("updateWidget") { userId: String, json: String -> PortfolioWidgetStore.update(requireNotNull(appContext.reactContext), userId, json) }
    AsyncFunction("setWidgetRefreshInput") { userId: String, json: String -> PortfolioWidgetStore.setRefreshInput(requireNotNull(appContext.reactContext), userId, json) }
    AsyncFunction("prepareWidgetAccountSync") { userId: String, url: String, key: String -> WidgetAccountSync.prepare(requireNotNull(appContext.reactContext), userId, url, key) }
    AsyncFunction("clearWidgetAccountSync") { WidgetAccountSync.clear(requireNotNull(appContext.reactContext)) }
    AsyncFunction("setWidgetAccountAuthorization") { userId: String, token: String -> WidgetAccountSync.setAuthorization(requireNotNull(appContext.reactContext), userId, token) }
    AsyncFunction("homeAccountStatus") { HomeAccountSync.status(requireNotNull(appContext.reactContext)) }
    AsyncFunction("registerHomeWifi") { HomeAccountSync.registerHome(requireNotNull(appContext.reactContext)) }
    AsyncFunction("saveHomeAccount") { provider: String, access: String, secret: String -> HomeAccountSync.save(requireNotNull(appContext.reactContext), provider, access, secret) }
    AsyncFunction("removeHomeAccount") { provider: String -> HomeAccountSync.remove(requireNotNull(appContext.reactContext), provider) }
    AsyncFunction("syncHomeAccounts") { HomeAccountSync.sync(requireNotNull(appContext.reactContext)) }
    AsyncFunction("ensureHomeAccounts") { HomeAccountSync.ensure(requireNotNull(appContext.reactContext)) }
    AsyncFunction("pinWidget") { PortfolioWidgetProvider.pin(requireNotNull(appContext.reactContext)) }
    AsyncFunction("openNotificationSettings") {
      val context = requireNotNull(appContext.reactContext)
      val intent = if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
