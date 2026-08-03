package ru.delta.vpn.vpn

import android.content.Context
import android.net.LocalSocket
import android.net.LocalSocketAddress
import android.os.ParcelFileDescriptor
import android.util.Log
import ru.delta.vpn.core.config.XrayConfigBuilder
import java.io.File

/**
 * Runs the bundled `libtun2socks.so` helper, which reads IP packets from the TUN
 * device and replays them as SOCKS5 connections against the local Xray inbound.
 *
 * The helper cannot open the TUN device itself, so it creates a unix socket and
 * waits for us to hand the descriptor over — the same handshake v2rayNG uses.
 */
class Tun2SocksProcess(private val context: Context) {

    private var process: Process? = null

    fun start(tun: ParcelFileDescriptor, mtu: Int, onExit: (String) -> Unit) {
        val binary = EngineFactory.tun2socksBinary(context)
        check(binary.canExecute()) { "tun2socks не найден: ${binary.absolutePath}" }

        val socketPath = File(context.filesDir, SOCKET_NAME).absolutePath
        File(socketPath).delete()

        val command = listOf(
            binary.absolutePath,
            "--netif-ipaddr", ROUTER_IP,
            "--netif-netmask", "255.255.255.252",
            "--socks-server-addr", "127.0.0.1:${XrayConfigBuilder.SOCKS_PORT}",
            "--tunmtu", mtu.toString(),
            "--sock-path", socketPath,
            "--enable-udprelay",
            "--loglevel", "notice",
        )

        val started = ProcessBuilder(command)
            .redirectErrorStream(true)
            .directory(context.filesDir)
            .start()
        process = started

        Thread({
            val exit = runCatching { started.waitFor() }.getOrDefault(-1)
            if (exit != 0) {
                Log.w(TAG, "tun2socks exited with $exit")
                onExit("tun2socks завершился с кодом $exit")
            }
        }, "delta-tun2socks-watch").apply { isDaemon = true }.start()

        sendDescriptor(tun, socketPath)
    }

    fun stop() {
        process?.destroy()
        process = null
        File(context.filesDir, SOCKET_NAME).delete()
    }

    /**
     * Passes the TUN file descriptor over the helper's unix socket. The helper may
     * not have bound it yet when we get here, so retry briefly before giving up.
     */
    private fun sendDescriptor(tun: ParcelFileDescriptor, socketPath: String) {
        var lastError: Exception? = null
        repeat(HANDSHAKE_ATTEMPTS) { attempt ->
            try {
                Thread.sleep(50L * (attempt + 1))
                LocalSocket().use { socket ->
                    socket.connect(LocalSocketAddress(socketPath, LocalSocketAddress.Namespace.FILESYSTEM))
                    socket.setFileDescriptorsForSend(arrayOf(tun.fileDescriptor))
                    socket.outputStream.write(42)
                    socket.outputStream.flush()
                }
                return
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw IllegalStateException("Не удалось передать TUN в tun2socks", lastError)
    }

    companion object {
        private const val TAG = "Tun2SocksProcess"
        private const val SOCKET_NAME = "sock_path"

        /** Peer address of the point-to-point link; must match the service's TUN setup. */
        const val ROUTER_IP = "26.26.26.2"
        const val CLIENT_IP = "26.26.26.1"
        const val HANDSHAKE_ATTEMPTS = 6
    }
}
