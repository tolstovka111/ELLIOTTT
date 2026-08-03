package ru.delta.vpn.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import ru.delta.vpn.DeltaApp

/**
 * Reconnects after a reboot or an app update, when the user asked for it.
 *
 * This receiver must stay exported: the system does not deliver BOOT_COMPLETED to
 * private receivers.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }

        val app = context.applicationContext as? DeltaApp ?: return
        // The consent dialog cannot be shown from a receiver, so only reconnect
        // when the user has already granted VPN permission to this app.
        if (VpnService.prepare(context) != null) return

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                if (app.settingsStore.settings.first().connectOnBoot) {
                    app.serverRepository.load()
                    DeltaVpnService.start(context)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
