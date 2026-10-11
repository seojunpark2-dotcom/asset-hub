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
    AsyncFunction("setWidgetUser") { userId: String -> PortfolioWidgetStore.setUser(requireNotNull(appContext.reactContext), userId) }
    AsyncFunction("updateWidget") { userId: String, json: String -> PortfolioWidgetStore.update(requireNotNull(appContext.reactContext), userId, json) }
    AsyncFunction("pinWidget") { PortfolioWidgetProvider.pin(requireNotNull(appContext.reactContext)) }
    AsyncFunction("openNotificationSettings") {
      val context = requireNotNull(appContext.reactContext)
      val intent = if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("read") { userId: String -> ExpiryAlarm.read(requireNotNull(appContext.reactContext), userId) }
    AsyncFunction("configure") { userId: String, date: String, enabled: Boolean, manual: Boolean ->
      ExpiryAlarm.configure(requireNotNull(appContext.reactContext), userId, date, enabled, manual)
    }
    AsyncFunction("cancel") { userId: String -> ExpiryAlarm.cancel(requireNotNull(appContext.reactContext), userId) }
  }
}
