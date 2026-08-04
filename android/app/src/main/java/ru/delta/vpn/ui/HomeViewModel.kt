package ru.delta.vpn.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import ru.delta.vpn.BuildConfig
import ru.delta.vpn.DeltaApp
import ru.delta.vpn.core.data.DeltaSettings
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.vpn.DeltaVpnService
import ru.delta.vpn.vpn.EngineFactory
import ru.delta.vpn.vpn.VpnState

/** Screen state shared by the home, servers and settings screens. */
class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as DeltaApp

    val nodes: StateFlow<List<ServerNode>> = app.serverRepository.nodes

    val settings: StateFlow<DeltaSettings> = app.settingsStore.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, DeltaSettings())

    val connectionState = VpnState.state
    val connectedSince = VpnState.connectedSince
    val lastError = VpnState.lastError
    val engineName = VpnState.engine

    /** True when the app runs without the native core and cannot carry real traffic. */
    val demoMode: Boolean = !EngineFactory.hasNativeCore(application)

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    /** The node the next connection will use, or the active one while connected. */
    val activeNode: StateFlow<ServerNode?> =
        combine(nodes, settings, VpnState.node) { list, prefs, live ->
            live ?: when {
                !prefs.autoSelectBest && prefs.selectedNodeId.isNotBlank() ->
                    list.firstOrNull { it.id == prefs.selectedNodeId }

                else -> list.minByOrNull { it.latencyMs ?: Int.MAX_VALUE }
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Three fastest nodes from distinct countries, shown in the bottom strip. */
    val topNodes: StateFlow<List<ServerNode>> = nodes
        .combine(settings) { list, _ ->
            list.sortedBy { it.latencyMs ?: Int.MAX_VALUE }
                .distinctBy { it.countryCode.ifBlank { it.id } }
                .take(3)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        val preset = BuildConfig.DEFAULT_SUBSCRIPTION_URL
        viewModelScope.launch {
            app.serverRepository.load()
            if (app.serverRepository.nodes.value.isEmpty() && preset.isNotBlank()) {
                syncSubscription(preset)
            } else {
                refreshLatencies()
            }
        }
    }

    fun connect() {
        VpnState.clearError()
        DeltaVpnService.start(getApplication(), activeNode.value?.id.orEmpty())
    }

    fun disconnect() = DeltaVpnService.stop(getApplication())

    fun refreshLatencies() {
        viewModelScope.launch {
            _busy.value = true
            app.serverRepository.refreshLatencies()
            _busy.value = false
        }
    }

    fun selectNode(node: ServerNode) {
        viewModelScope.launch { app.settingsStore.selectNode(node.id) }
    }

    fun selectBest() {
        viewModelScope.launch { app.settingsStore.selectBestServer() }
    }

    fun removeNode(node: ServerNode) {
        viewModelScope.launch { app.serverRepository.remove(node.id) }
    }

    fun syncSubscription(url: String) {
        viewModelScope.launch {
            _busy.value = true
            app.settingsStore.setSubscriptionUrl(url)
            app.serverRepository.syncSubscription(url)
                .onSuccess {
                    _message.value = "Загружено серверов: $it"
                    app.serverRepository.refreshLatencies()
                }
                .onFailure { _message.value = it.message ?: "Не удалось обновить подписку" }
            _busy.value = false
        }
    }

    fun importLink(link: String) {
        viewModelScope.launch {
            _busy.value = true
            app.serverRepository.importLink(link)
                .onSuccess {
                    _message.value = "Сервер «${it.name}» добавлен"
                    app.serverRepository.refreshLatencies()
                }
                .onFailure { _message.value = it.message ?: "Ссылка не распознана" }
            _busy.value = false
        }
    }

    fun setBypassRussianDomains(value: Boolean) =
        viewModelScope.launch { app.settingsStore.setBypassRussianDomains(value) }

    fun setBlockQuic(value: Boolean) =
        viewModelScope.launch { app.settingsStore.setBlockQuic(value) }

    fun setUseGeoFiles(value: Boolean) =
        viewModelScope.launch { app.settingsStore.setUseGeoFiles(value) }

    fun setConnectOnBoot(value: Boolean) =
        viewModelScope.launch { app.settingsStore.setConnectOnBoot(value) }

    fun consumeMessage() {
        _message.value = null
    }
}
