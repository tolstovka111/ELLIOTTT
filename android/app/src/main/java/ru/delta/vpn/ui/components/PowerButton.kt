package ru.delta.vpn.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PowerSettingsNew
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.delta.vpn.core.model.ConnectionState
import ru.delta.vpn.ui.theme.DeltaColors

/**
 * The single tap target of the app: a large power dial that glows blue while the
 * tunnel is up and sits dark and flat while it is down.
 */
@Composable
fun PowerButton(
    state: ConnectionState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: androidx.compose.ui.unit.Dp = 220.dp,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()

    val pulse = rememberInfiniteTransition(label = "power-pulse")
    val glow by pulse.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glow",
    )

    val active = state == ConnectionState.CONNECTED
    val busy = state.isBusy
    val glowAlpha = when {
        active -> glow
        busy -> glow * 0.5f
        else -> 0f
    }

    Box(
        modifier = modifier.size(diameter * 1.9f),
        contentAlignment = Alignment.Center,
    ) {
        if (glowAlpha > 0f) {
            Canvas(Modifier.size(diameter * 1.9f)) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            DeltaColors.Blue.copy(alpha = 0.45f * glowAlpha),
                            DeltaColors.Blue.copy(alpha = 0.14f * glowAlpha),
                            Color.Transparent,
                        ),
                        center = center,
                        radius = size.minDimension / 2f,
                    ),
                    radius = size.minDimension / 2f,
                    center = center,
                )
            }
        }

        Box(
            modifier = Modifier
                .size(diameter)
                .scale(if (pressed) 0.96f else 1f)
                .clip(CircleShape)
                .background(if (active) DeltaColors.PowerOn else DeltaColors.PowerOff)
                .border(3.dp, if (active) DeltaColors.White else DeltaColors.White.copy(alpha = 0.55f), CircleShape)
                .clickable(
                    interactionSource = interaction,
                    indication = null,
                    enabled = !busy,
                    onClick = onClick,
                )
                .semantics {
                    contentDescription = if (active) "Отключить VPN" else "Подключить VPN"
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.PowerSettingsNew,
                contentDescription = null,
                tint = DeltaColors.White,
                modifier = Modifier.size(diameter * 0.32f),
            )
            if (busy) {
                CircularProgressIndicator(
                    modifier = Modifier.size(diameter * 0.92f),
                    color = DeltaColors.White.copy(alpha = 0.85f),
                    strokeWidth = 3.dp,
                )
            }
        }
    }
}

/**
 * Faint triangle lattice behind the dial — the delta echo of the honeycomb the
 * reference design uses.
 */
@Composable
fun DeltaLattice(
    modifier: Modifier = Modifier,
    intensity: Float = 1f,
) {
    Canvas(modifier) {
        val step = 108f
        val height = step * 0.87f
        val stroke = 1.4f
        val color = DeltaColors.Blue.copy(alpha = 0.06f * intensity)

        var row = 0
        var y = -height
        while (y < size.height + height) {
            val offsetX = if (row % 2 == 0) 0f else step / 2f
            var x = -step + offsetX
            while (x < size.width + step) {
                val apex = Offset(x + step / 2f, y)
                val left = Offset(x, y + height)
                val right = Offset(x + step, y + height)
                drawLine(color, apex, left, stroke)
                drawLine(color, apex, right, stroke)
                drawLine(color, left, right, stroke)
                x += step
            }
            y += height
            row++
        }
    }
}
