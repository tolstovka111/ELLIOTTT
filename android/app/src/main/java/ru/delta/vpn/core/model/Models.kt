package ru.delta.vpn.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Lifecycle of the tunnel, mirrored one-to-one by the UI. */
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    DISCONNECTING,
    ERROR;

    val isBusy: Boolean get() = this == CONNECTING || this == DISCONNECTING
    val isActive: Boolean get() = this == CONNECTED || this == CONNECTING
}

/** Transport used to reach the node. */
@Serializable
enum class Transport {
    /** VLESS + XTLS-Reality straight to a VPS. Best DPI resistance. */
    @SerialName("reality")
    REALITY,

    /** VLESS over WebSocket + TLS. Works behind a CDN / serverless worker. */
    @SerialName("ws")
    WS_TLS,

    /** VLESS over gRPC + TLS. */
    @SerialName("grpc")
    GRPC_TLS,
}

/**
 * A single outbound node.
 *
 * [serverless] marks nodes whose entry point is an edge worker (Cloudflare) rather
 * than the VPS itself — those keep working while the origin IP is unreachable,
 * because the connection terminates on the CDN's anycast addresses.
 */
@Serializable
data class ServerNode(
    val id: String,
    val name: String,
    val countryCode: String,
    val city: String = "",
    val address: String,
    val port: Int = 443,
    val transport: Transport = Transport.REALITY,
    val uuid: String,
    val sni: String = "",
    val host: String = "",
    val path: String = "/",
    val publicKey: String = "",
    val shortId: String = "",
    val fingerprint: String = "chrome",
    val flow: String = "",
    val serviceName: String = "",
    val allowInsecure: Boolean = false,
    val serverless: Boolean = false,
    val latencyMs: Int? = null,
) {
    /** Text under the server name on the home card. */
    val subtitle: String
        get() = when {
            city.isNotBlank() -> city
            else -> address
        }
}

/** Result of a latency probe, used to pick "Лучший сервер". */
data class Probe(val nodeId: String, val latencyMs: Int?)

/** Live traffic counters shown in the notification. */
data class Traffic(val uplinkBytes: Long = 0, val downlinkBytes: Long = 0)
