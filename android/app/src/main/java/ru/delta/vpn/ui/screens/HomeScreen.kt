package ru.delta.vpn.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import ru.delta.vpn.core.model.ConnectionState
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.ui.HomeViewModel
import ru.delta.vpn.ui.components.DeltaLattice
import ru.delta.vpn.ui.components.DeltaWordmark
import ru.delta.vpn.ui.components.FlagCircle
import ru.delta.vpn.ui.components.InfoPill
import ru.delta.vpn.ui.components.PowerButton
import ru.delta.vpn.ui.components.ServerCard
import ru.delta.vpn.ui.theme.DeltaColors

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onOpenServers: () -> Unit,
    onOpenSettings: () -> Unit,
    onToggleConnection: () -> Unit,
) {
    val state by viewModel.connectionState.collectAsStateWithLifecycle()
    val node by viewModel.activeNode.collectAsStateWithLifecycle()
    val topNodes by viewModel.topNodes.collectAsStateWithLifecycle()
    val connectedSince by viewModel.connectedSince.collectAsStateWithLifecycle()
    val error by viewModel.lastError.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DeltaColors.Background),
    ) {
        DeltaLattice(
            modifier = Modifier.fillMaxSize(),
            intensity = if (state == ConnectionState.CONNECTED) 2.2f else 1f,
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 18.dp),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp, bottom = 18.dp),
                contentAlignment = Alignment.Center,
            ) {
                DeltaWordmark(fontSize = 26.sp)
                IconButton(
                    onClick = onOpenSettings,
                    modifier = Modifier.align(Alignment.CenterEnd),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Settings,
                        contentDescription = "Настройки",
                        tint = DeltaColors.White,
                        modifier = Modifier.size(28.dp),
                    )
                }
            }

            ServerCard(
                node = node,
                connected = state == ConnectionState.CONNECTED,
                onClick = onOpenServers,
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    PowerButton(state = state, onClick = onToggleConnection)

                    Spacer(Modifier.height(4.dp))

                    Text(
                        text = statusLabel(state),
                        color = if (state == ConnectionState.ERROR) DeltaColors.Danger else DeltaColors.TextMuted,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                    )

                    if (state == ConnectionState.CONNECTED) {
                        Spacer(Modifier.height(10.dp))
                        ConnectionTimer(connectedSince)
                    }

                    error?.let {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = it,
                            color = DeltaColors.Danger,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 24.dp),
                        )
                    }

                    if (viewModel.demoMode) {
                        Spacer(Modifier.height(14.dp))
                        InfoPill(
                            text = "Демо-режим: ядро VPN не встроено",
                            color = DeltaColors.Blue,
                        )
                    }
                }
            }

            BestServersStrip(
                nodes = topNodes,
                selectedId = node?.id,
                onSelect = { viewModel.selectNode(it) },
                onOpenAll = onOpenServers,
            )

            Spacer(Modifier.height(28.dp))
        }
    }
}

/** Bottom strip with the fastest countries, mirroring the reference layout. */
@Composable
private fun BestServersStrip(
    nodes: List<ServerNode>,
    selectedId: String?,
    onSelect: (ServerNode) -> Unit,
    onOpenAll: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable(onClick = onOpenAll),
        ) {
            Icon(
                imageVector = Icons.Rounded.Bolt,
                contentDescription = null,
                tint = DeltaColors.Blue,
                modifier = Modifier.size(26.dp),
            )
            Spacer(Modifier.size(6.dp))
            Text(
                text = "Лучшие сервера",
                color = DeltaColors.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(Modifier.height(18.dp))

        if (nodes.isEmpty()) {
            Text(
                text = "Серверов пока нет — добавьте подписку в настройках",
                color = DeltaColors.TextMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            return@Column
        }

        Row(horizontalArrangement = Arrangement.spacedBy(26.dp)) {
            nodes.forEach { candidate ->
                val selected = candidate.id == selectedId
                Box(
                    modifier = Modifier
                        .size(if (selected) 74.dp else 58.dp)
                        .clip(CircleShape)
                        .clickable { onSelect(candidate) },
                    contentAlignment = Alignment.Center,
                ) {
                    FlagCircle(
                        countryCode = candidate.countryCode,
                        size = if (selected) 74.dp else 58.dp,
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        Text(
            text = nodes.firstOrNull { it.id == selectedId }?.name ?: nodes.first().name,
            color = DeltaColors.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** HH:MM:SS since the tunnel came up. */
@Composable
private fun ConnectionTimer(connectedSince: Long?) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(connectedSince) {
        while (connectedSince != null) {
            now = System.currentTimeMillis()
            delay(1_000)
        }
    }

    val elapsed = connectedSince?.let { ((now - it) / 1000).coerceAtLeast(0) } ?: 0
    val text = "%02d:%02d:%02d".format(elapsed / 3600, (elapsed % 3600) / 60, elapsed % 60)

    Text(
        text = text,
        color = DeltaColors.White,
        fontSize = 54.sp,
        fontWeight = FontWeight.Bold,
    )
}

private fun statusLabel(state: ConnectionState): String = when (state) {
    ConnectionState.DISCONNECTED -> "Отключено"
    ConnectionState.CONNECTING -> "Подключение…"
    ConnectionState.CONNECTED -> "Подключено"
    ConnectionState.DISCONNECTING -> "Отключение…"
    ConnectionState.ERROR -> "Ошибка подключения"
}
