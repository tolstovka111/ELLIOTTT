package ru.delta.vpn.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import ru.delta.vpn.DeltaApp
import ru.delta.vpn.R
import ru.delta.vpn.core.config.XrayConfigBuilder
import ru.delta.vpn.core.model.ConnectionState
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.ui.MainActivity

/**
 * The VPN service: owns the TUN device, the foreground notification and the
 * lifecycle of whichever [TunnelEngine] is active.
 */
class DeltaVpnService : VpnService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var tun: ParcelFileDescriptor? = null
    private var engine: TunnelEngine? = null
    private var statsJob: Job? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_DISCONNECT -> {
                // Even a stop has to honour the foreground contract: the system
                // requires startForeground() after every startForegroundService().
                goForeground(buildNotification(node = VpnState.node.value, connected = false))
                tearDown()
                return START_NOT_STICKY
            }

            else -> {
                // The system gives a foreground service a few seconds to post its
                // notification, and picking a node is asynchronous — so claim the
                // foreground slot first and refine the notification afterwards.
                goForeground(buildNotification(node = null, connected = false))
                val requestedId = intent?.getStringExtra(EXTRA_NODE_ID).orEmpty()
                scope.launch { connect(requestedId) }
            }
        }
        return START_NOT_STICKY
    }

    private suspend fun connect(requestedNodeId: String) {
        val app = application as DeltaApp
        val settings = app.settingsStore.settings.first()

        if (app.serverRepository.nodes.value.isEmpty()) app.serverRepository.load()
        val node = resolveNode(app, requestedNodeId, settings.selectedNodeId, settings.autoSelectBest)
        if (node == null) {
            VpnState.onError("Нет доступных серверов — добавьте подписку в настройках")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        VpnState.onConnecting(node)
        notify(buildNotification(node, connected = false))

        try {
            val descriptor = establish(settings.bypassedApps)
                ?: error("Система не выдала VPN-интерфейс")
            tun = descriptor

            val config = XrayConfigBuilder.build(node, settings.routing)
            val selected = EngineFactory.create(this)
            engine = selected

            selected.start(
                TunnelContext(
                    service = this,
                    tun = descriptor,
                    node = node,
                    configJson = config,
                    onFailure = { reason ->
                        Log.w(TAG, "engine failure: $reason")
                        VpnState.onError(reason)
                        tearDown()
                    },
                )
            )

            VpnState.onConnected(selected.displayName)
            notify(buildNotification(node, connected = true))
            startStatsLoop(node)
        } catch (e: Exception) {
            Log.e(TAG, "connect failed", e)
            VpnState.onError(e.message ?: "Не удалось установить соединение")
            tearDown()
        }
    }

    /** Explicit request wins, then the pinned node, then the fastest one. */
    private fun resolveNode(
        app: DeltaApp,
        requestedId: String,
        pinnedId: String,
        autoBest: Boolean,
    ): ServerNode? {
        val repo = app.serverRepository
        return when {
            requestedId.isNotBlank() -> repo.byId(requestedId) ?: repo.best()
            !autoBest && pinnedId.isNotBlank() -> repo.byId(pinnedId) ?: repo.best()
            else -> repo.best()
        }
    }

    private fun establish(bypassedApps: Set<String>): ParcelFileDescriptor? {
        val builder = Builder()
            .setSession(getString(R.string.app_name))
            .setMtu(MTU)
            .addAddress(Tun2SocksProcess.CLIENT_IP, 30)
            .addRoute("0.0.0.0", 0)
            .addDnsServer("1.1.1.1")
            .addDnsServer("8.8.8.8")
            .setConfigureIntent(
                PendingIntent.getActivity(
                    this,
                    0,
                    Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) builder.setMetered(false)

        // Split tunnelling: listed apps keep using the plain connection.
        bypassedApps.forEach { pkg ->
            try {
                builder.addDisallowedApplication(pkg)
            } catch (_: PackageManager.NameNotFoundException) {
                Log.w(TAG, "bypassed app no longer installed: $pkg")
            }
        }

        return builder.establish()
    }

    /** Refreshes traffic counters for the notification while connected. */
    private fun startStatsLoop(node: ServerNode) {
        statsJob?.cancel()
        statsJob = scope.launch {
            while (isActive) {
                delay(STATS_INTERVAL_MS)
                val current = engine ?: break
                val traffic = current.queryTraffic()
                VpnState.onTraffic(traffic)
                notify(buildNotification(node, connected = true))
            }
        }
    }

    private fun tearDown() {
        statsJob?.cancel()
        statsJob = null
        if (VpnState.state.value.isActive) VpnState.onDisconnecting()

        runCatching { engine?.stop() }
        engine = null
        runCatching { tun?.close() }
        tun = null

        if (VpnState.state.value != ConnectionState.ERROR) {
            VpnState.onDisconnected()
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onRevoke() {
        Log.i(TAG, "VPN permission revoked by the system")
        tearDown()
        super.onRevoke()
    }

    override fun onDestroy() {
        runCatching { engine?.stop() }
        runCatching { tun?.close() }
        scope.cancel()
        if (VpnState.state.value != ConnectionState.ERROR) {
            VpnState.onDisconnected()
        }
        super.onDestroy()
    }

    /**
     * Android 14 refuses a foreground service that does not name its type; VPN
     * clients fall under `specialUse`, declared alongside a subtype in the manifest.
     */
    private fun goForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun notify(notification: Notification) {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(node: ServerNode?, connected: Boolean): Notification {
        ensureChannel()

        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val disconnectIntent = PendingIntent.getBroadcast(
            this,
            1,
            Intent(this, VpnActionReceiver::class.java).setAction(ACTION_DISCONNECT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val title = getString(if (connected) R.string.status_connected else R.string.status_connecting)
        val traffic = VpnState.traffic.value
        val text = when {
            node == null -> getString(R.string.best_server)
            connected -> "${node.name} · ↑ ${formatBytes(traffic.uplinkBytes)} ↓ ${formatBytes(traffic.downlinkBytes)}"
            else -> node.name
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, getString(R.string.notification_disconnect), disconnectIntent)
            .build()
    }

    /** Channels only exist from Android 8; older versions ignore the id entirely. */
    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) }
        )
    }

    companion object {
        private const val TAG = "DeltaVpnService"
        private const val CHANNEL_ID = "delta_vpn_status"
        private const val NOTIFICATION_ID = 0xD314
        private const val MTU = 1500
        private const val STATS_INTERVAL_MS = 2_000L

        const val ACTION_CONNECT = "ru.delta.vpn.action.CONNECT"
        const val ACTION_DISCONNECT = "ru.delta.vpn.action.DISCONNECT"
        const val EXTRA_NODE_ID = "node_id"

        fun start(context: Context, nodeId: String = "") {
            val intent = Intent(context, DeltaVpnService::class.java)
                .setAction(ACTION_CONNECT)
                .putExtra(EXTRA_NODE_ID, nodeId)
            // Background starts (boot, notification) are only allowed for services
            // that go foreground, which this one does in onStartCommand.
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, DeltaVpnService::class.java).setAction(ACTION_DISCONNECT)
            ContextCompat.startForegroundService(context, intent)
        }

        fun formatBytes(bytes: Long): String = when {
            bytes >= 1_073_741_824 -> "%.1f ГБ".format(bytes / 1_073_741_824.0)
            bytes >= 1_048_576 -> "%.1f МБ".format(bytes / 1_048_576.0)
            bytes >= 1024 -> "%.0f КБ".format(bytes / 1024.0)
            else -> "$bytes Б"
        }
    }
}
