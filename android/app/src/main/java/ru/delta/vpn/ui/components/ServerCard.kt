package ru.delta.vpn.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.delta.vpn.R
import ru.delta.vpn.core.model.ServerNode
import ru.delta.vpn.ui.theme.CardCorner
import ru.delta.vpn.ui.theme.DeltaColors

/**
 * The header card: which node the tunnel will use, and how good it looks from here.
 *
 * While connected we show the node's address (as the reference does); while idle we
 * show a signal strength derived from the last latency probe.
 */
@Composable
fun ServerCard(
    node: ServerNode?,
    connected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CardCorner))
            .background(DeltaColors.Surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(DeltaColors.SurfaceElevated),
            contentAlignment = Alignment.Center,
        ) {
            if (node != null && node.countryCode.isNotBlank()) {
                FlagCircle(node.countryCode, size = 44.dp)
            } else {
                androidx.compose.foundation.Image(
                    painter = painterResource(R.drawable.logo_delta),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(44.dp),
                )
            }
        }

        Spacer(Modifier.width(14.dp))

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = node?.name ?: "Лучший сервер",
                color = DeltaColors.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (connected && node != null) {
                Text(
                    text = node.subtitle,
                    color = DeltaColors.TextMuted,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        if (!connected) {
            SignalBars(latencyMs = node?.latencyMs)
            Spacer(Modifier.width(10.dp))
        }

        Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = "Выбрать сервер",
            tint = DeltaColors.TextMuted,
            modifier = Modifier.size(26.dp),
        )
    }
}

/** Four bars, filled according to the measured round-trip time. */
@Composable
fun SignalBars(
    latencyMs: Int?,
    modifier: Modifier = Modifier,
    height: Dp = 20.dp,
) {
    val filled = when {
        latencyMs == null -> 0
        latencyMs < 90 -> 4
        latencyMs < 180 -> 3
        latencyMs < 350 -> 2
        else -> 1
    }
    val tint = when (filled) {
        4, 3 -> DeltaColors.White
        2 -> DeltaColors.Blue
        1 -> DeltaColors.Danger
        else -> DeltaColors.TextFaint
    }

    Canvas(
        modifier = modifier
            .width(height * 1.2f)
            .height(height)
    ) {
        val bars = 4
        val gap = size.width * 0.14f
        val barWidth = (size.width - gap * (bars - 1)) / bars
        for (i in 0 until bars) {
            val barHeight = size.height * (0.35f + 0.216f * i)
            val x = i * (barWidth + gap)
            drawRoundRect(
                color = if (i < filled) tint else DeltaColors.TextFaint.copy(alpha = 0.35f),
                topLeft = Offset(x, size.height - barHeight),
                size = Size(barWidth, barHeight),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 3f),
            )
        }
    }
}

/** Small pill used for hints and warnings above the fold. */
@Composable
fun InfoPill(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = DeltaColors.Blue,
) {
    Text(
        text = text,
        color = color,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}
