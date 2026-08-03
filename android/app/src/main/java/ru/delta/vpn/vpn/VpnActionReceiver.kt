package ru.delta.vpn.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Handles the "Отключить" action on the ongoing notification. */
class VpnActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == DeltaVpnService.ACTION_DISCONNECT) {
            DeltaVpnService.stop(context)
        }
    }
}
