package ru.delta.vpn.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.ui.HomeViewModel
import ru.delta.vpn.ui.components.FlagCircle
import ru.delta.vpn.ui.components.SignalBars
import ru.delta.vpn.ui.theme.CardCorner
import ru.delta.vpn.ui.theme.DeltaColors

@Composable
fun ServersScreen(
    viewModel: HomeViewModel,
    onBack: () -> Unit,
) {
    val nodes by viewModel.nodes.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val activeNode by viewModel.activeNode.collectAsStateWithLifecycle()

    val sorted = nodes.sortedBy { it.latencyMs ?: Int.MAX_VALUE }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DeltaColors.Background)
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        ScreenHeader(
            title = "Выбор сервера",
            onBack = onBack,
            action = {
                IconButton(onClick = { viewModel.refreshLatencies() }, enabled = !busy) {
                    Icon(
                        imageVector = Icons.Rounded.Refresh,
                        contentDescription = "Обновить пинг",
                        tint = if (busy) DeltaColors.TextFaint else DeltaColors.White,
                    )
                }
            },
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item {
                AutoBestRow(
                    selected = settings.autoSelectBest,
                    bestName = activeNode?.name.orEmpty(),
                    onClick = { viewModel.selectBest() },
                )
            }

            items(sorted, key = { it.id }) { node ->
                ServerRow(
                    node = node,
                    selected = !settings.autoSelectBest && settings.selectedNodeId == node.id,
                    onSelect = { viewModel.selectNode(node) },
                    onDelete = { viewModel.removeNode(node) },
                )
            }

            if (sorted.isEmpty()) {
                item {
                    Text(
                        text = "Список пуст. Добавьте подписку или вставьте vless-ссылку в настройках.",
                        color = DeltaColors.TextMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 24.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun AutoBestRow(selected: Boolean, bestName: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CardCorner))
            .background(if (selected) DeltaColors.Blue.copy(alpha = 0.16f) else DeltaColors.Surface)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(DeltaColors.Blue.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Bolt, contentDescription = null, tint = DeltaColors.Blue)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text("Лучший сервер", color = DeltaColors.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(
                text = if (bestName.isBlank()) "Выбирается автоматически" else "Сейчас: $bestName",
                color = DeltaColors.TextMuted,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (selected) {
            Icon(Icons.Rounded.Check, contentDescription = null, tint = DeltaColors.Blue)
        }
    }
}

@Composable
private fun ServerRow(
    node: ServerNode,
    selected: Boolean,
    onSelect: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CardCorner))
            .background(if (selected) DeltaColors.Blue.copy(alpha = 0.16f) else DeltaColors.Surface)
            .clickable(onClick = onSelect)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FlagCircle(node.countryCode, size = 40.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = node.name,
                color = DeltaColors.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = buildString {
                    append(node.transport.name.lowercase())
                    if (node.serverless) append(" · serverless")
                    node.latencyMs?.let { append(" · $it мс") } ?: append(" · нет ответа")
                },
                color = DeltaColors.TextMuted,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        SignalBars(latencyMs = node.latencyMs)
        IconButton(onClick = onDelete) {
            Icon(
                imageVector = Icons.Rounded.DeleteOutline,
                contentDescription = "Удалить сервер",
                tint = DeltaColors.TextFaint,
            )
        }
    }
}

/** Shared back-arrow header used by the secondary screens. */
@Composable
fun ScreenHeader(
    title: String,
    onBack: () -> Unit,
    action: @Composable () -> Unit = {},
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = "Назад",
                tint = DeltaColors.White,
            )
        }
        Spacer(Modifier.width(4.dp))
        Text(
            text = title,
            color = DeltaColors.White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        action()
    }
}
