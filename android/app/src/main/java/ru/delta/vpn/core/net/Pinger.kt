package ru.delta.vpn.core.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import ru.delta.vpn.core.model.Probe
import ru.delta.vpn.core.model.ServerNode
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.system.measureTimeMillis

/**
 * TCP handshake latency to each node's entry point.
 *
 * A plain connect() is enough to rank nodes and, unlike ICMP, it needs no root and
 * tells us something useful: whether the port is reachable from this network at all.
 */
object Pinger {

    private const val TIMEOUT_MS = 2_500

    suspend fun probe(node: ServerNode): Probe = withContext(Dispatchers.IO) {
        var latency: Int? = null
        runCatching {
            val elapsed = measureTimeMillis {
                Socket().use { socket ->
                    socket.tcpNoDelay = true
                    socket.connect(InetSocketAddress(node.address, node.port), TIMEOUT_MS)
                }
            }
            latency = elapsed.toInt()
        }
        Probe(node.id, latency)
    }

    suspend fun probeAll(nodes: List<ServerNode>): Map<String, Int?> = coroutineScope {
        nodes.map { async { probe(it) } }
            .awaitAll()
            .associate { it.nodeId to it.latencyMs }
    }

    /** Lowest latency wins; unreachable nodes sort last. */
    fun best(nodes: List<ServerNode>): ServerNode? =
        nodes.minByOrNull { it.latencyMs ?: Int.MAX_VALUE }
}
