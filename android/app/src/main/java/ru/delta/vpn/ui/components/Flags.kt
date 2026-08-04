package ru.delta.vpn.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.delta.vpn.ui.theme.DeltaColors

/**
 * Flags are drawn rather than shipped as assets: a handful of primitives covers
 * every country we host in, keeps the APK small and scales to any density.
 */
private sealed interface FlagSpec {
    data class Stripes(val colors: List<Color>, val vertical: Boolean = false) : FlagSpec
    data class NordicCross(val background: Color, val cross: Color) : FlagSpec
    data class Disc(val background: Color, val disc: Color) : FlagSpec
    data object Unknown : FlagSpec
}

private val RED = Color(0xFFD52B1E)
private val DARK_RED = Color(0xFF9E3039)
private val BLUE = Color(0xFF0055A4)
private val NAVY = Color(0xFF012169)
private val SKY = Color(0xFF006AA7)
private val YELLOW = Color(0xFFFECC00)
private val GOLD = Color(0xFFFFCE00)
private val WHITE = Color(0xFFFFFFFF)
private val BLACK = Color(0xFF000000)
private val GREEN = Color(0xFF006A44)
private val FI_BLUE = Color(0xFF003580)

private val FLAGS: Map<String, FlagSpec> = mapOf(
    "NL" to FlagSpec.Stripes(listOf(RED, WHITE, Color(0xFF21468B))),
    "DE" to FlagSpec.Stripes(listOf(BLACK, RED, GOLD)),
    "RU" to FlagSpec.Stripes(listOf(WHITE, Color(0xFF0039A6), RED)),
    "FR" to FlagSpec.Stripes(listOf(BLUE, WHITE, RED), vertical = true),
    "PL" to FlagSpec.Stripes(listOf(WHITE, RED)),
    "AT" to FlagSpec.Stripes(listOf(RED, WHITE, RED)),
    "LT" to FlagSpec.Stripes(listOf(YELLOW, GREEN, RED)),
    "LV" to FlagSpec.Stripes(listOf(DARK_RED, WHITE, DARK_RED)),
    "EE" to FlagSpec.Stripes(listOf(Color(0xFF0072CE), BLACK, WHITE)),
    "UA" to FlagSpec.Stripes(listOf(Color(0xFF0057B7), Color(0xFFFFD700))),
    "SE" to FlagSpec.NordicCross(SKY, YELLOW),
    "FI" to FlagSpec.NordicCross(WHITE, FI_BLUE),
    "NO" to FlagSpec.NordicCross(Color(0xFFBA0C2F), WHITE),
    "DK" to FlagSpec.NordicCross(Color(0xFFC8102E), WHITE),
    "IS" to FlagSpec.NordicCross(Color(0xFF02529C), WHITE),
    "JP" to FlagSpec.Disc(WHITE, Color(0xFFBC002D)),
    "TR" to FlagSpec.Disc(RED, WHITE),
    "KZ" to FlagSpec.Disc(Color(0xFF00AFCA), GOLD),
    "GB" to FlagSpec.Stripes(listOf(NAVY, WHITE, NAVY)),
    "US" to FlagSpec.Stripes(listOf(RED, WHITE, RED, WHITE, RED)),
    "SG" to FlagSpec.Stripes(listOf(Color(0xFFED2939), WHITE)),
    "CH" to FlagSpec.Disc(Color(0xFFD52B1E), WHITE),
)

@Composable
fun FlagCircle(
    countryCode: String,
    modifier: Modifier = Modifier,
    size: Dp = 56.dp,
) {
    val code = countryCode.uppercase()
    val spec = FLAGS[code] ?: FlagSpec.Unknown

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(size)) {
            when (spec) {
                is FlagSpec.Stripes -> drawStripes(spec)
                is FlagSpec.NordicCross -> drawNordicCross(spec)
                is FlagSpec.Disc -> drawDisc(spec)
                FlagSpec.Unknown -> drawRect(DeltaColors.SurfaceElevated)
            }
        }
        if (spec is FlagSpec.Unknown) {
            Text(
                text = code.take(2).ifBlank { "??" },
                color = DeltaColors.TextMuted,
                fontSize = (size.value * 0.3f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawStripes(spec: FlagSpec.Stripes) {
    val count = spec.colors.size
    if (spec.vertical) {
        val width = size.width / count
        spec.colors.forEachIndexed { index, color ->
            drawRect(color, topLeft = Offset(index * width, 0f), size = Size(width, size.height))
        }
    } else {
        val height = size.height / count
        spec.colors.forEachIndexed { index, color ->
            drawRect(color, topLeft = Offset(0f, index * height), size = Size(size.width, height))
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawNordicCross(spec: FlagSpec.NordicCross) {
    drawRect(spec.background)
    val armWidth = size.minDimension * 0.2f
    // The vertical arm sits left of centre, as on every Nordic flag.
    val verticalX = size.width * 0.34f - armWidth / 2f
    drawRect(spec.cross, topLeft = Offset(verticalX, 0f), size = Size(armWidth, size.height))
    drawRect(
        spec.cross,
        topLeft = Offset(0f, size.height / 2f - armWidth / 2f),
        size = Size(size.width, armWidth),
    )
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDisc(spec: FlagSpec.Disc) {
    drawRect(spec.background)
    drawCircle(spec.disc, radius = size.minDimension * 0.26f, center = center)
}
