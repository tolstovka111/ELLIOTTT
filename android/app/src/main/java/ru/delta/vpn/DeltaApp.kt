package ru.delta.vpn

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ru.delta.vpn.core.data.ServerRepository
import ru.delta.vpn.core.data.SettingsStore

/**
 * Application-scoped wiring. The app is small enough that a couple of eagerly
 * created singletons beat pulling in a DI framework.
 */
class DeltaApp : Application() {

    lateinit var settingsStore: SettingsStore
        private set

    lateinit var serverRepository: ServerRepository
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        settingsStore = SettingsStore(this)
        serverRepository = ServerRepository(this)
        scope.launch { serverRepository.load() }
    }
}
