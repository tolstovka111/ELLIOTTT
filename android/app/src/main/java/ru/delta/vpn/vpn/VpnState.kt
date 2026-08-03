package ru.delta.vpn.vpn

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.delta.vpn.core.model.ConnectionState
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.core.model.Traffic

/**
 * Single source of truth for tunnel state, shared between the service and the UI.
 *
 * A process-wide object is enough here: the service and the Activity always live in
 * the same process, and the state is small and always overwritten as a whole.
 */
object VpnState {

    private val _state = MutableStateFlow(ConnectionState.DISCONNECTED)
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val _node = MutableStateFlow<ServerNode?>(null)
    val node: StateFlow<ServerNode?> = _node.asStateFlow()

    /** Wall-clock millis at which the tunnel came up; null when not connected. */
    private val _connectedSince = MutableStateFlow<Long?>(null)
    val connectedSince: StateFlow<Long?> = _connectedSince.asStateFlow()

    private val _traffic = MutableStateFlow(Traffic())
    val traffic: StateFlow<Traffic> = _traffic.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    /** Which data plane is actually running ("Xray" or "Демо"). */
    private val _engine = MutableStateFlow("")
    val engine: StateFlow<String> = _engine.asStateFlow()

    fun onConnecting(node: ServerNode) {
        _lastError.value = null
        _node.value = node
        _state.value = ConnectionState.CONNECTING
    }

    fun onConnected(engineName: String) {
        _engine.value = engineName
        _connectedSince.value = System.currentTimeMillis()
        _state.value = ConnectionState.CONNECTED
    }

    fun onDisconnecting() {
        _state.value = ConnectionState.DISCONNECTING
    }

    fun onDisconnected() {
        _connectedSince.value = null
        _traffic.value = Traffic()
        _state.value = ConnectionState.DISCONNECTED
    }

    fun onError(message: String) {
        _lastError.value = message
        _connectedSince.value = null
        _state.value = ConnectionState.ERROR
    }

    fun onTraffic(traffic: Traffic) {
        _traffic.value = traffic
    }

    fun clearError() {
        _lastError.value = null
        if (_state.value == ConnectionState.ERROR) _state.value = ConnectionState.DISCONNECTED
    }
}
