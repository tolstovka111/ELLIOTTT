package ru.delta.vpn.core.config

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.core.model.Transport

/**
 * Options that change how traffic is routed once the tunnel is up.
 */
data class RoutingOptions(
    /** Keep Russian sites and local IPs off the tunnel (faster, less suspicious). */
    val bypassRussianDomains: Boolean = true,
    /** Drop UDP/443 so browsers fall back to TLS, which the core can sniff and route. */
    val blockQuic: Boolean = true,
    /** DNS resolvers used inside the tunnel. */
    val dnsServers: List<String> = listOf("1.1.1.1", "8.8.8.8"),
    /**
     * Enables `geoip:` / `geosite:` rules. Only turn this on when geoip.dat and
     * geosite.dat are present in the core's asset folder, otherwise Xray refuses
     * to start.
     */
    val useGeoFiles: Boolean = false,
)

/**
 * Renders the Xray JSON config for a single outbound.
 *
 * The core listens on a local SOCKS inbound; tun2socks pushes the TUN device's
 * packets into it. That split is what lets the same config work on a phone and
 * on a desktop without changes.
 */
object XrayConfigBuilder {

    const val SOCKS_PORT = 10808

    private val json = Json { prettyPrint = true }

    private val PRIVATE_CIDRS = listOf(
        "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
        "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4",
        "::1/128", "fc00::/7", "fe80::/10",
    )

    /**
     * Domains that must stay on the local ISP: state services, banks and payment
     * systems commonly refuse foreign exit IPs.
     */
    private val RU_DIRECT_DOMAINS = listOf(
        "domain:gosuslugi.ru", "domain:nalog.ru", "domain:nalog.gov.ru", "domain:mos.ru",
        "domain:sberbank.ru", "domain:sber.ru", "domain:tinkoff.ru", "domain:tbank.ru",
        "domain:alfabank.ru", "domain:vtb.ru", "domain:psbank.ru", "domain:gazprombank.ru",
        "domain:mir.ru", "domain:nspk.ru", "domain:sbp.nspk.ru",
        "domain:ozon.ru", "domain:wildberries.ru", "domain:avito.ru", "domain:dns-shop.ru",
        "domain:yandex.ru", "domain:ya.ru", "domain:yandex.net", "domain:mail.ru", "domain:vk.com",
        "domain:rutube.ru", "domain:kinopoisk.ru", "domain:2gis.ru", "domain:rzd.ru",
        "domain:mts.ru", "domain:megafon.ru", "domain:beeline.ru", "domain:tele2.ru",
    )

    fun build(node: ServerNode, options: RoutingOptions = RoutingOptions()): String {
        val config = buildJsonObject {
            putJsonObject("log") { put("loglevel", "warning") }

            // Counters the app reads back for the notification's traffic line.
            putJsonObject("stats") {}
            putJsonObject("policy") {
                putJsonObject("levels") {
                    putJsonObject("0") {
                        put("statsUserUplink", true)
                        put("statsUserDownlink", true)
                        put("handshake", 4)
                        put("connIdle", 300)
                    }
                }
                putJsonObject("system") {
                    put("statsOutboundUplink", true)
                    put("statsOutboundDownlink", true)
                }
            }

            putJsonArray("inbounds") {
                addJsonObject {
                    put("tag", "socks-in")
                    put("protocol", "socks")
                    put("listen", "127.0.0.1")
                    put("port", SOCKS_PORT)
                    putJsonObject("settings") {
                        put("auth", "noauth")
                        put("udp", true)
                    }
                    putJsonObject("sniffing") {
                        put("enabled", true)
                        putJsonArray("destOverride") {
                            add("http"); add("tls"); add("quic")
                        }
                        // Keep the resolved IP as the destination; only use the
                        // sniffed name for routing decisions.
                        put("routeOnly", true)
                    }
                }
            }

            putJsonArray("outbounds") {
                add(proxyOutbound(node))
                addJsonObject {
                    put("tag", "direct")
                    put("protocol", "freedom")
                    putJsonObject("settings") { put("domainStrategy", "UseIP") }
                }
                addJsonObject {
                    put("tag", "block")
                    put("protocol", "blackhole")
                    putJsonObject("settings") {
                        putJsonObject("response") { put("type", "http") }
                    }
                }
            }

            putJsonObject("dns") {
                putJsonArray("servers") {
                    options.dnsServers.forEach { add(it) }
                    if (options.bypassRussianDomains) {
                        // Resolve the direct-list through a local resolver so the
                        // answers stay geographically correct.
                        addJsonObject {
                            put("address", "77.88.8.8")
                            putJsonArray("domains") { RU_DIRECT_DOMAINS.forEach { add(it) } }
                        }
                    }
                }
                put("queryStrategy", "UseIPv4")
            }

            putJsonObject("routing") {
                put("domainStrategy", "IPIfNonMatch")
                putJsonArray("rules") {
                    // Never tunnel the loopback/LAN — that would break the VPN itself.
                    addJsonObject {
                        put("type", "field")
                        put("outboundTag", "direct")
                        putJsonArray("ip") { PRIVATE_CIDRS.forEach { add(it) } }
                    }
                    if (options.blockQuic) {
                        addJsonObject {
                            put("type", "field")
                            put("outboundTag", "block")
                            put("network", "udp")
                            put("port", "443")
                        }
                    }
                    if (options.bypassRussianDomains) {
                        addJsonObject {
                            put("type", "field")
                            put("outboundTag", "direct")
                            putJsonArray("domain") {
                                RU_DIRECT_DOMAINS.forEach { add(it) }
                                if (options.useGeoFiles) add("geosite:category-ru")
                            }
                        }
                        if (options.useGeoFiles) {
                            addJsonObject {
                                put("type", "field")
                                put("outboundTag", "direct")
                                putJsonArray("ip") { add("geoip:ru"); add("geoip:private") }
                            }
                        }
                    }
                    // Everything else goes out through the node.
                    addJsonObject {
                        put("type", "field")
                        put("outboundTag", "proxy")
                        put("network", "tcp,udp")
                    }
                }
            }
        }
        return json.encodeToString(kotlinx.serialization.json.JsonObject.serializer(), config)
    }

    private fun proxyOutbound(node: ServerNode) = buildJsonObject {
        put("tag", "proxy")
        put("protocol", "vless")
        putJsonObject("settings") {
            putJsonArray("vnext") {
                addJsonObject {
                    put("address", node.address)
                    put("port", node.port)
                    putJsonArray("users") {
                        addJsonObject {
                            put("id", node.uuid)
                            put("encryption", "none")
                            put("level", 0)
                            if (node.transport == Transport.REALITY && node.flow.isNotBlank()) {
                                put("flow", node.flow)
                            }
                        }
                    }
                }
            }
        }
        putJsonObject("streamSettings") {
            when (node.transport) {
                Transport.REALITY -> {
                    put("network", "tcp")
                    put("security", "reality")
                    putJsonObject("realitySettings") {
                        put("show", false)
                        put("fingerprint", node.fingerprint.ifBlank { "chrome" })
                        put("serverName", node.sni)
                        put("publicKey", node.publicKey)
                        put("shortId", node.shortId)
                        put("spiderX", "/")
                    }
                }

                Transport.WS_TLS -> {
                    put("network", "ws")
                    put("security", "tls")
                    putJsonObject("wsSettings") {
                        put("path", node.path.ifBlank { "/" })
                        putJsonObject("headers") {
                            put("Host", node.host.ifBlank { node.address })
                        }
                    }
                    putJsonObject("tlsSettings") {
                        put("serverName", node.sni.ifBlank { node.host.ifBlank { node.address } })
                        put("allowInsecure", node.allowInsecure)
                        put("fingerprint", node.fingerprint.ifBlank { "chrome" })
                        putJsonArray("alpn") { add("h2"); add("http/1.1") }
                    }
                }

                Transport.GRPC_TLS -> {
                    put("network", "grpc")
                    put("security", "tls")
                    putJsonObject("grpcSettings") {
                        put("serviceName", node.serviceName)
                        put("multiMode", false)
                    }
                    putJsonObject("tlsSettings") {
                        put("serverName", node.sni.ifBlank { node.address })
                        put("allowInsecure", node.allowInsecure)
                        put("fingerprint", node.fingerprint.ifBlank { "chrome" })
                    }
                }
            }
            putJsonObject("sockopt") {
                // The service protects this socket; mark it so the core keeps it
                // outside the tunnel and we do not loop packets back on ourselves.
                put("mark", 255)
                put("tcpNoDelay", true)
            }
        }
        putJsonObject("mux") {
            put("enabled", false)
            put("concurrency", -1)
        }
    }
}
