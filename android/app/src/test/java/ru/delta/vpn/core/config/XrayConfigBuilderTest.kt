package ru.delta.vpn.core.config

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.core.model.Transport

/**
 * The generated config is what the core actually consumes, so these tests pin the
 * shape Xray expects rather than the exact text.
 */
class XrayConfigBuilderTest {

    private val reality = ServerNode(
        id = "node-1",
        name = "Германия",
        countryCode = "DE",
        address = "203.0.113.10",
        port = 443,
        transport = Transport.REALITY,
        uuid = "8f7a1c2e-4b6d-4f11-9c3a-5e2d7b8f0a91",
        sni = "www.microsoft.com",
        publicKey = "pbk-value",
        shortId = "0123456789abcdef",
        flow = "xtls-rprx-vision",
    )

    private val worker = ServerNode(
        id = "node-2",
        name = "Edge",
        countryCode = "",
        address = "delta.example.workers.dev",
        port = 443,
        transport = Transport.WS_TLS,
        uuid = "8f7a1c2e-4b6d-4f11-9c3a-5e2d7b8f0a91",
        host = "delta.example.workers.dev",
        path = "/delta?ed=2048",
        serverless = true,
    )

    private fun parse(node: ServerNode, options: RoutingOptions = RoutingOptions()): JsonObject =
        Json.parseToJsonElement(XrayConfigBuilder.build(node, options)).jsonObject

    @Test
    fun `socks inbound listens on loopback for tun2socks`() {
        val inbound = parse(reality)["inbounds"]!!.jsonArray.single().jsonObject

        assertEquals("127.0.0.1", inbound["listen"]!!.jsonPrimitive.content)
        assertEquals(XrayConfigBuilder.SOCKS_PORT, inbound["port"]!!.jsonPrimitive.content.toInt())
        assertEquals("socks", inbound["protocol"]!!.jsonPrimitive.content)
    }

    @Test
    fun `reality node carries its keys and flow`() {
        val outbound = parse(reality)["outbounds"]!!.jsonArray.first().jsonObject
        val stream = outbound["streamSettings"]!!.jsonObject
        val settings = stream["realitySettings"]!!.jsonObject

        assertEquals("reality", stream["security"]!!.jsonPrimitive.content)
        assertEquals("tcp", stream["network"]!!.jsonPrimitive.content)
        assertEquals("pbk-value", settings["publicKey"]!!.jsonPrimitive.content)
        assertEquals("www.microsoft.com", settings["serverName"]!!.jsonPrimitive.content)

        val user = outbound["settings"]!!.jsonObject["vnext"]!!.jsonArray.single()
            .jsonObject["users"]!!.jsonArray.single().jsonObject
        assertEquals("xtls-rprx-vision", user["flow"]!!.jsonPrimitive.content)
    }

    @Test
    fun `websocket node keeps the host header and path`() {
        val stream = parse(worker)["outbounds"]!!.jsonArray.first().jsonObject["streamSettings"]!!.jsonObject
        val ws = stream["wsSettings"]!!.jsonObject

        assertEquals("ws", stream["network"]!!.jsonPrimitive.content)
        assertEquals("tls", stream["security"]!!.jsonPrimitive.content)
        assertEquals("/delta?ed=2048", ws["path"]!!.jsonPrimitive.content)
        assertEquals(
            "delta.example.workers.dev",
            ws["headers"]!!.jsonObject["Host"]!!.jsonPrimitive.content,
        )
    }

    @Test
    fun `websocket node never sends a reality-only flow`() {
        val user = parse(worker)["outbounds"]!!.jsonArray.first().jsonObject["settings"]!!
            .jsonObject["vnext"]!!.jsonArray.single().jsonObject["users"]!!.jsonArray.single().jsonObject

        assertFalse("flow is meaningless outside reality", user.containsKey("flow"))
    }

    @Test
    fun `private ranges always bypass the tunnel`() {
        val rules = parse(reality)["routing"]!!.jsonObject["rules"]!!.jsonArray
        val first = rules.first().jsonObject

        assertEquals("direct", first["outboundTag"]!!.jsonPrimitive.content)
        val ips = first["ip"]!!.jsonArray.map { it.jsonPrimitive.content }
        assertTrue(ips.contains("192.168.0.0/16"))
        assertTrue(ips.contains("127.0.0.0/8"))
    }

    @Test
    fun `russian bypass adds a direct domain rule and can be turned off`() {
        val withBypass = parse(reality)["routing"]!!.jsonObject["rules"]!!.jsonArray
            .any { rule ->
                rule.jsonObject["outboundTag"]?.jsonPrimitive?.content == "direct" &&
                    rule.jsonObject["domain"]?.jsonArray
                        ?.any { it.jsonPrimitive.content.contains("gosuslugi.ru") } == true
            }
        assertTrue(withBypass)

        val without = parse(reality, RoutingOptions(bypassRussianDomains = false))["routing"]!!
            .jsonObject["rules"]!!.jsonArray
            .any { it.jsonObject.containsKey("domain") }
        assertFalse(without)
    }

    @Test
    fun `geo rules stay out unless the dat files are enabled`() {
        val plain = XrayConfigBuilder.build(reality, RoutingOptions(useGeoFiles = false))
        assertFalse(plain.contains("geoip:"))
        assertFalse(plain.contains("geosite:"))

        val geo = XrayConfigBuilder.build(reality, RoutingOptions(useGeoFiles = true))
        assertTrue(geo.contains("geosite:category-ru"))
    }

    @Test
    fun `quic is blocked only when requested`() {
        fun blocksQuic(options: RoutingOptions) = parse(reality, options)["routing"]!!
            .jsonObject["rules"]!!.jsonArray.any { rule ->
                rule.jsonObject["outboundTag"]?.jsonPrimitive?.content == "block" &&
                    rule.jsonObject["port"]?.jsonPrimitive?.content == "443"
            }

        assertTrue(blocksQuic(RoutingOptions(blockQuic = true)))
        assertFalse(blocksQuic(RoutingOptions(blockQuic = false)))
    }

    @Test
    fun `traffic counters are enabled so the notification can report them`() {
        val config = parse(reality)

        assertTrue(config.containsKey("stats"))
        val system = config["policy"]!!.jsonObject["system"]!!.jsonObject
        assertEquals("true", system["statsOutboundUplink"]!!.jsonPrimitive.content)
    }
}
