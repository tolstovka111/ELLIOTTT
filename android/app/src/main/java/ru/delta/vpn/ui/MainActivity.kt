package ru.delta.vpn.ui

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ru.delta.vpn.ui.screens.HomeScreen
import ru.delta.vpn.ui.screens.ServersScreen
import ru.delta.vpn.ui.screens.SettingsScreen
import ru.delta.vpn.ui.screens.SplashScreen
import ru.delta.vpn.ui.theme.DeltaColors
import ru.delta.vpn.ui.theme.DeltaTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            DeltaTheme {
                DeltaRoot()
            }
        }
    }
}

private object Routes {
    const val SPLASH = "splash"
    const val HOME = "home"
    const val SERVERS = "servers"
    const val SETTINGS = "settings"
}

@Composable
private fun DeltaRoot() {
    val navController = rememberNavController()
    val viewModel: HomeViewModel = viewModel()
    val context = LocalContext.current
    val state by viewModel.connectionState.collectAsStateWithLifecycle()

    // Granting the VPN consent returns here; only then may the service start.
    val vpnPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) viewModel.connect()
    }

    val notificationsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* The tunnel works either way; the notification is just nicer with it. */ }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) notificationsLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val toggleConnection: () -> Unit = {
        if (state.isActive) {
            viewModel.disconnect()
        } else {
            val consent = VpnService.prepare(context)
            if (consent == null) viewModel.connect() else vpnPermissionLauncher.launch(consent)
        }
    }

    NavHost(
        navController = navController,
        startDestination = Routes.SPLASH,
        modifier = Modifier
            .fillMaxSize()
            .background(DeltaColors.Background),
    ) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onFinished = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.SPLASH) { inclusive = true }
                    }
                }
            )
        }
        composable(Routes.HOME) {
            HomeScreen(
                viewModel = viewModel,
                onOpenServers = { navController.navigate(Routes.SERVERS) },
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                onToggleConnection = toggleConnection,
            )
        }
        composable(Routes.SERVERS) {
            ServersScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }
    }
}
