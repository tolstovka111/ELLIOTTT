package ru.delta.vpn.core.data

import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import ru.delta.vpn.core.config.RoutingOptions

private val Context.dataStore by preferencesDataStore(name = "delta_settings")

data class DeltaSettings(
    val subscriptionUrl: String = "",
    val selectedNodeId: String = "",
    val autoSelectBest: Boolean = true,
    val bypassRussianDomains: Boolean = true,
    val blockQuic: Boolean = true,
    val useGeoFiles: Boolean = false,
    val connectOnBoot: Boolean = false,
    val bypassedApps: Set<String> = emptySet(),
) {
    val routing: RoutingOptions
        get() = RoutingOptions(
            bypassRussianDomains = bypassRussianDomains,
            blockQuic = blockQuic,
            useGeoFiles = useGeoFiles,
        )
}

/** Persisted user preferences. */
class SettingsStore(private val context: Context) {

    private object Keys {
        val SUBSCRIPTION = stringPreferencesKey("subscription_url")
        val SELECTED = stringPreferencesKey("selected_node")
        val AUTO_BEST = booleanPreferencesKey("auto_best")
        val BYPASS_RU = booleanPreferencesKey("bypass_ru")
        val BLOCK_QUIC = booleanPreferencesKey("block_quic")
        val GEO_FILES = booleanPreferencesKey("geo_files")
        val ON_BOOT = booleanPreferencesKey("connect_on_boot")
        val BYPASSED_APPS = stringSetPreferencesKey("bypassed_apps")
    }

    val settings: Flow<DeltaSettings> = context.dataStore.data.map { prefs ->
        DeltaSettings(
            subscriptionUrl = prefs[Keys.SUBSCRIPTION].orEmpty(),
            selectedNodeId = prefs[Keys.SELECTED].orEmpty(),
            autoSelectBest = prefs[Keys.AUTO_BEST] ?: true,
            bypassRussianDomains = prefs[Keys.BYPASS_RU] ?: true,
            blockQuic = prefs[Keys.BLOCK_QUIC] ?: true,
            useGeoFiles = prefs[Keys.GEO_FILES] ?: false,
            connectOnBoot = prefs[Keys.ON_BOOT] ?: false,
            bypassedApps = prefs[Keys.BYPASSED_APPS] ?: emptySet(),
        )
    }

    suspend fun setSubscriptionUrl(url: String) = edit { it[Keys.SUBSCRIPTION] = url.trim() }

    suspend fun selectNode(id: String) = edit {
        it[Keys.SELECTED] = id
        it[Keys.AUTO_BEST] = false
    }

    suspend fun selectBestServer() = edit {
        it[Keys.AUTO_BEST] = true
        it[Keys.SELECTED] = ""
    }

    suspend fun setBypassRussianDomains(value: Boolean) = edit { it[Keys.BYPASS_RU] = value }
    suspend fun setBlockQuic(value: Boolean) = edit { it[Keys.BLOCK_QUIC] = value }
    suspend fun setUseGeoFiles(value: Boolean) = edit { it[Keys.GEO_FILES] = value }
    suspend fun setConnectOnBoot(value: Boolean) = edit { it[Keys.ON_BOOT] = value }
    suspend fun setBypassedApps(packages: Set<String>) = edit { it[Keys.BYPASSED_APPS] = packages }

    private suspend fun edit(block: suspend (MutablePreferences) -> Unit) {
        context.dataStore.edit(block)
    }
}
