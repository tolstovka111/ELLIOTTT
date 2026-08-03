package ru.delta.vpn.core.config

import android.net.Uri
import android.util.Base64
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.core.model.Transport
import java.net.URLDecoder
import java.util.UUID

/**
 * Parser/serialiser for `vless://` share links — the format every panel, worker
 * and subscription in this ecosystem speaks.
 *
 *     vless://<uuid>@<host>:<port>?type=ws&security=tls&sni=…&host=…&path=…#remark
 */
object VlessLink {

    private const val SCHEME = "vless://"

    fun parse(raw: String): ServerNode? {
        val line = raw.trim()
        if (!line.startsWith(SCHEME, ignoreCase = true)) return null

        // Uri.parse() copes with the userinfo@host:port?query#fragment shape, but
        // the fragment is often un-encoded Cyrillic, so slice it off first.
        val hashIndex = line.indexOf('#')
        val body = if (hashIndex >= 0) line.substring(0, hashIndex) else line
        val remark = if (hashIndex >= 0) decode(line.substring(hashIndex + 1)) else ""

        val uri = runCatching { Uri.parse(body) }.getOrNull() ?: return null
        val uuid = uri.userInfo?.takeIf { it.isNotBlank() } ?: return null
        val host = uri.host?.takeIf { it.isNotBlank() } ?: return null
        val port = uri.port.takeIf { it > 0 } ?: 443

        fun q(key: String): String = runCatching { uri.getQueryParameter(key) }.getOrNull().orEmpty()

        // security=reality pins the transport regardless of the declared type.
        val transport = if (q("security").equals("reality", true)) {
            Transport.REALITY
        } else when (q("type").lowercase()) {
            "grpc" -> Transport.GRPC_TLS
            else -> Transport.WS_TLS
        }

        val country = countryFromRemark(remark)
        return ServerNode(
            id = stableId(uuid, host, port, q("path")),
            name = remark.ifBlank { host },
            countryCode = country,
            address = host,
            port = port,
            transport = transport,
            uuid = uuid,
            sni = q("sni").ifBlank { q("peer") },
            host = q("host"),
            path = q("path").ifBlank { "/" },
            publicKey = q("pbk"),
            shortId = q("sid"),
            fingerprint = q("fp").ifBlank { "chrome" },
            flow = q("flow"),
            serviceName = q("serviceName"),
            allowInsecure = q("allowInsecure") == "1",
            serverless = q("host").endsWith("workers.dev", true) ||
                host.endsWith("workers.dev", true) ||
                q("ed").isNotBlank(),
        )
    }

    fun format(node: ServerNode): String {
        val params = buildList {
            when (node.transport) {
                Transport.REALITY -> {
                    add("type" to "tcp")
                    add("security" to "reality")
                    add("pbk" to node.publicKey)
                    if (node.shortId.isNotBlank()) add("sid" to node.shortId)
                    add("fp" to node.fingerprint)
                }

                Transport.WS_TLS -> {
                    add("type" to "ws")
                    add("security" to "tls")
                    if (node.host.isNotBlank()) add("host" to node.host)
                    add("path" to node.path)
                    add("fp" to node.fingerprint)
                }

                Transport.GRPC_TLS -> {
                    add("type" to "grpc")
                    add("security" to "tls")
                    add("serviceName" to node.serviceName)
                }
            }
            if (node.sni.isNotBlank()) add("sni" to node.sni)
            if (node.flow.isNotBlank()) add("flow" to node.flow)
            add("encryption" to "none")
        }.filter { it.second.isNotBlank() }
            .joinToString("&") { (k, v) -> "$k=${Uri.encode(v)}" }

        return "$SCHEME${node.uuid}@${node.address}:${node.port}?$params#${Uri.encode(node.name)}"
    }

    /**
     * Decodes a subscription payload: either plain text with one link per line, or
     * that same text wrapped in (URL-safe) base64, which is what most panels serve.
     */
    fun parseSubscription(payload: String): List<ServerNode> {
        val text = if (payload.contains(SCHEME, ignoreCase = true)) payload else decodeBase64(payload)
        return text.lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .mapNotNull { parse(it) }
            .distinctBy { it.id }
            .toList()
    }

    private fun decodeBase64(payload: String): String = runCatching {
        val cleaned = payload.filterNot { it.isWhitespace() }
        val flags = Base64.DEFAULT or Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
        String(Base64.decode(cleaned, flags), Charsets.UTF_8)
    }.getOrDefault("")

    private fun decode(value: String): String =
        runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)

    /** Same link always yields the same id, so selection survives a re-sync. */
    private fun stableId(uuid: String, host: String, port: Int, path: String): String =
        UUID.nameUUIDFromBytes("$uuid|$host|$port|$path".toByteArray()).toString()

    /**
     * Panels conventionally prefix the remark with a flag emoji or a country name;
     * pull an ISO code out of it so the UI can draw the right flag.
     */
    private fun countryFromRemark(remark: String): String {
        val flag = flagToIso(remark)
        if (flag != null) return flag
        val lower = remark.lowercase()
        return COUNTRY_HINTS.entries.firstOrNull { (needle, _) -> lower.contains(needle) }?.value ?: ""
    }

    /** Regional-indicator pairs (🇸🇪) map directly back to their ISO letters. */
    private fun flagToIso(text: String): String? {
        val codePoints = text.codePoints().toArray()
        for (i in 0 until codePoints.size - 1) {
            val a = codePoints[i]
            val b = codePoints[i + 1]
            if (a in 0x1F1E6..0x1F1FF && b in 0x1F1E6..0x1F1FF) {
                val first = 'A' + (a - 0x1F1E6)
                val second = 'A' + (b - 0x1F1E6)
                return "$first$second"
            }
        }
        return null
    }

    private val COUNTRY_HINTS = mapOf(
        "нидерланд" to "NL", "netherland" to "NL", "amsterdam" to "NL", "holland" to "NL",
        "швеци" to "SE", "sweden" to "SE", "stockholm" to "SE",
        "герман" to "DE", "germany" to "DE", "frankfurt" to "DE",
        "финлянд" to "FI", "finland" to "FI", "helsinki" to "FI",
        "франц" to "FR", "france" to "FR", "paris" to "FR",
        "сша" to "US", "usa" to "US", "united states" to "US",
        "великобритан" to "GB", "london" to "GB", "uk" to "GB",
        "турци" to "TR", "turkey" to "TR", "istanbul" to "TR",
        "польш" to "PL", "poland" to "PL", "warsaw" to "PL",
        "япони" to "JP", "japan" to "JP", "tokyo" to "JP",
        "сингапур" to "SG", "singapore" to "SG",
        "казахстан" to "KZ", "kazakhstan" to "KZ",
        "латв" to "LV", "latvia" to "LV",
        "литв" to "LT", "lithuania" to "LT",
        "эстон" to "EE", "estonia" to "EE",
    )
}
