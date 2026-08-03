package ru.delta.vpn.vpn

import android.content.Context
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import ru.delta.vpn.BuildConfig
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.core.model.Traffic
import java.io.File

/**
 * Everything the data plane needs in order to move packets.
 */
class TunnelContext(
    val service: VpnService,
    val tun: ParcelFileDescriptor,
    val node: ServerNode,
    val configJson: String,
    /** Called from the engine when the tunnel dies on its own. */
    val onFailure: (String) -> Unit,
)

/**
 * The pluggable data plane behind the VPN service.
 *
 * The UI, the service lifecycle and the config generation are all independent of
 * which engine is in use, so a device without the native core still runs the app
 * (in demo mode) and the core can be swapped without touching anything else.
 */
interface TunnelEngine {
    val displayName: String

    /** Brings the tunnel up. Throws if it cannot start. */
    fun start(context: TunnelContext)

    fun stop()

    /** Cumulative counters since [start]; zeroes when the engine cannot report. */
    fun queryTraffic(): Traffic = Traffic()
}

/**
 * Picks the best engine available in this build.
 *
 * The real engine lives in the `src/xray` source set and is only compiled when
 * `app/libs/libv2ray.aar` is present (see docs/VPN-CORE.md), so it is resolved by
 * name rather than referenced directly.
 */
object EngineFactory {

    private const val TAG = "EngineFactory"
    private const val XRAY_ENGINE = "ru.delta.vpn.vpn.xray.XrayTunnelEngine"
    const val TUN2SOCKS = "libtun2socks.so"

    /** True when both native pieces — the core and tun2socks — are in the APK. */
    fun hasNativeCore(context: Context): Boolean =
        BuildConfig.HAS_XRAY_CORE && tun2socksBinary(context).canExecute()

    fun tun2socksBinary(context: Context): File =
        File(context.applicationInfo.nativeLibraryDir, TUN2SOCKS)

    fun create(context: Context): TunnelEngine {
        if (!hasNativeCore(context)) {
            Log.w(TAG, "native core missing, falling back to the demo engine")
            return DemoTunnelEngine()
        }
        return runCatching {
            Class.forName(XRAY_ENGINE).getDeclaredConstructor().newInstance() as TunnelEngine
        }.getOrElse {
            Log.e(TAG, "Xray engine present but not loadable", it)
            DemoTunnelEngine()
        }
    }
}
