package ru.delta.vpn.vpn.xray

import android.util.Log
import libv2ray.Libv2ray
import libv2ray.V2RayPoint
import libv2ray.V2RayVPNServiceSupportsSet
import ru.delta.vpn.core.model.Traffic
import ru.delta.vpn.vpn.Tun2SocksProcess
import ru.delta.vpn.vpn.TunnelContext
import ru.delta.vpn.vpn.TunnelEngine
import java.util.concurrent.atomic.AtomicLong

/**
 * Production data plane: Xray-core (via AndroidLibXrayLite) plus tun2socks.
 *
 * This file is only compiled when `app/libs/libv2ray.aar` is present — see
 * docs/VPN-CORE.md — and is instantiated by name from `EngineFactory`.
 *
 * Packet path:
 *   TUN device -> tun2socks -> 127.0.0.1:10808 (SOCKS) -> Xray outbound -> node
 */
class XrayTunnelEngine : TunnelEngine {

    override val displayName: String = "Xray"

    private var point: V2RayPoint? = null
    private var tun2socks: Tun2SocksProcess? = null

    private val uplink = AtomicLong(0)
    private val downlink = AtomicLong(0)

    override fun start(context: TunnelContext) {
        val service = context.service
        initEnvironment(context)

        val callbacks = object : V2RayVPNServiceSupportsSet {
            // The service has already established the interface, so there is
            // nothing left to set up here.
            override fun setup(config: String): Long = 0

            override fun prepare(): Long = 0

            override fun shutdown(): Long {
                context.onFailure("Ядро Xray остановило соединение")
                return 0
            }

            /** Keeps the core's own sockets outside the tunnel. */
            override fun protect(fd: Long): Boolean = service.protect(fd.toInt())

            override fun onEmitStatus(code: Long, message: String?): Long {
                Log.i(TAG, "core status $code: $message")
                return 0
            }
        }

        val v2rayPoint = Libv2ray.newV2RayPoint(callbacks, false).apply {
            configureFileContent = context.configJson
            domainName = "${context.node.address}:${context.node.port}"
        }
        point = v2rayPoint

        v2rayPoint.runLoop(false)
        check(v2rayPoint.isRunning) { "Ядро Xray не запустилось" }

        tun2socks = Tun2SocksProcess(service).also {
            it.start(context.tun, MTU) { reason ->
                context.onFailure(reason)
            }
        }
        Log.i(TAG, "xray tunnel established via ${context.node.address}")
    }

    override fun stop() {
        runCatching { tun2socks?.stop() }
        tun2socks = null
        runCatching { point?.stopLoop() }
        point = null
    }

    override fun queryTraffic(): Traffic {
        val p = point ?: return Traffic(uplink.get(), downlink.get())
        // queryStats() returns the delta since the previous call and resets it.
        runCatching {
            uplink.addAndGet(p.queryStats(PROXY_TAG, "uplink"))
            downlink.addAndGet(p.queryStats(PROXY_TAG, "downlink"))
        }
        return Traffic(uplink.get(), downlink.get())
    }

    /**
     * Points the core at its asset directory. geoip.dat / geosite.dat are optional:
     * without them the app's routing rules stay on plain domain suffixes.
     */
    private fun initEnvironment(context: TunnelContext) {
        if (initialised) return
        val assets = context.service.filesDir.absolutePath
        Libv2ray.initV2Env(assets, "")
        initialised = true
    }

    private companion object {
        const val TAG = "XrayTunnelEngine"
        const val PROXY_TAG = "proxy"
        const val MTU = 1500

        @Volatile
        var initialised = false
    }
}
