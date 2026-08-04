package ru.delta.vpn.vpn

import android.util.Log
import ru.delta.vpn.core.model.Traffic
import java.io.FileInputStream
import java.io.InterruptedIOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Fallback engine used when the native core is not bundled.
 *
 * It keeps the TUN interface open and drains it, so the whole app — service
 * lifecycle, notification, timer, UI — behaves exactly as in production, but no
 * packet leaves the device: everything written to the tunnel is discarded.
 * Useful for UI work and for CI builds that ship without the core.
 */
class DemoTunnelEngine : TunnelEngine {

    override val displayName: String = "Демо"

    private val running = AtomicBoolean(false)
    private val bytesIn = AtomicLong(0)
    private var worker: Thread? = null

    override fun start(context: TunnelContext) {
        running.set(true)
        worker = Thread({ drain(context) }, "delta-demo-tunnel").apply {
            isDaemon = true
            start()
        }
        Log.i(TAG, "demo tunnel up for ${context.node.name} — traffic is discarded")
    }

    override fun stop() {
        running.set(false)
        worker?.interrupt()
        worker = null
    }

    override fun queryTraffic(): Traffic = Traffic(uplinkBytes = bytesIn.get())

    private fun drain(context: TunnelContext) {
        val buffer = ByteArray(32 * 1024)
        try {
            FileInputStream(context.tun.fileDescriptor).use { input ->
                while (running.get()) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    bytesIn.addAndGet(read.toLong())
                }
            }
        } catch (_: InterruptedIOException) {
            // stop() closes the descriptor from under us; that is the normal exit.
        } catch (e: Exception) {
            if (running.get()) {
                Log.w(TAG, "demo tunnel stopped", e)
                context.onFailure("Демо-туннель остановлен: ${e.message}")
            }
        }
    }

    private companion object {
        const val TAG = "DemoTunnelEngine"
    }
}
