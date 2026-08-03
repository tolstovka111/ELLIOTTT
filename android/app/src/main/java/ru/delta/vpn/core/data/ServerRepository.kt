package ru.delta.vpn.core.data

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ru.delta.vpn.core.config.VlessLink
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.core.net.Pinger
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Owns the node list: loads it from disk, refreshes it from a subscription URL and
 * keeps latency measurements up to date.
 */
class ServerRepository(context: Context) {

    private val appContext = context.applicationContext
    private val storeFile = File(appContext.filesDir, "nodes.json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _nodes = MutableStateFlow<List<ServerNode>>(emptyList())
    val nodes: StateFlow<List<ServerNode>> = _nodes.asStateFlow()

    suspend fun load() = withContext(Dispatchers.IO) {
        val stored = runCatching {
            if (storeFile.exists()) {
                json.decodeFromString<List<ServerNode>>(storeFile.readText())
            } else {
                emptyList()
            }
        }.getOrElse {
            Log.w(TAG, "node store unreadable, starting empty", it)
            emptyList()
        }
        _nodes.value = stored
    }

    /** Downloads and replaces the node list. Returns the number of nodes imported. */
    suspend fun syncSubscription(url: String): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val payload = fetch(url)
            val parsed = VlessLink.parseSubscription(payload)
            require(parsed.isNotEmpty()) { "В подписке не найдено ни одного сервера" }
            replaceAll(parsed)
            parsed.size
        }
    }

    /** Imports a single `vless://` link pasted by the user. */
    suspend fun importLink(link: String): Result<ServerNode> = withContext(Dispatchers.IO) {
        runCatching {
            val node = VlessLink.parse(link) ?: error("Ссылка не распознана")
            val merged = _nodes.value.filterNot { it.id == node.id } + node
            replaceAll(merged)
            node
        }
    }

    suspend fun remove(nodeId: String) = withContext(Dispatchers.IO) {
        replaceAll(_nodes.value.filterNot { it.id == nodeId })
    }

    /** Re-measures every node and stores the results. */
    suspend fun refreshLatencies() {
        val current = _nodes.value
        if (current.isEmpty()) return
        val results = Pinger.probeAll(current)
        _nodes.update { list -> list.map { it.copy(latencyMs = results[it.id]) } }
        persist(_nodes.value)
    }

    fun best(): ServerNode? = Pinger.best(_nodes.value)

    fun byId(id: String): ServerNode? = _nodes.value.firstOrNull { it.id == id }

    private suspend fun replaceAll(nodes: List<ServerNode>) {
        _nodes.value = nodes
        persist(nodes)
    }

    private suspend fun persist(nodes: List<ServerNode>) = withContext(Dispatchers.IO) {
        runCatching { storeFile.writeText(json.encodeToString(nodes)) }
            .onFailure { Log.w(TAG, "could not persist nodes", it) }
    }

    private fun fetch(url: String): String {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = true
            // Some panels serve a browser-only page unless a UA is present.
            setRequestProperty("User-Agent", "DeltaVPN/1.0 (Android)")
        }
        return try {
            val code = connection.responseCode
            require(code in 200..299) { "Сервер подписки ответил $code" }
            connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        const val TAG = "ServerRepository"
    }
}
