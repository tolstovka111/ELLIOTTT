package ru.delta.vpn.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/** Brand palette: near-black canvas, white type, one blue accent. */
object DeltaColors {
    val Background = Color(0xFF0B0E14)
    val Surface = Color(0xFF161B24)
    val SurfaceElevated = Color(0xFF1E2430)
    val Blue = Color(0xFF3D8DFF)
    val BlueDeep = Color(0xFF174ED8)
    val BlueSoft = Color(0xFF6FB0FF)
    val White = Color(0xFFFFFFFF)
    val TextMuted = Color(0xFF8A93A6)
    val TextFaint = Color(0xFF5A6373)
    val Danger = Color(0xFFFF5A6E)
    val Success = Color(0xFF35D07F)

    val PowerOn = Brush.linearGradient(listOf(BlueSoft, BlueDeep))
    val PowerOff = Brush.linearGradient(listOf(Color(0xFF272E3B), Color(0xFF171C26)))
}

private val DarkScheme = darkColorScheme(
    primary = DeltaColors.Blue,
    onPrimary = DeltaColors.White,
    secondary = DeltaColors.BlueSoft,
    background = DeltaColors.Background,
    onBackground = DeltaColors.White,
    surface = DeltaColors.Surface,
    onSurface = DeltaColors.White,
    surfaceVariant = DeltaColors.SurfaceElevated,
    onSurfaceVariant = DeltaColors.TextMuted,
    error = DeltaColors.Danger,
    outline = DeltaColors.TextFaint,
)

private val DeltaTypography = Typography(
    displayLarge = TextStyle(fontSize = 56.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 12.sp, letterSpacing = 0.4.sp),
)

/**
 * The app is dark-only by design: the whole layout is built around a black canvas
 * with a single glowing accent, and a light variant would read as a different product.
 */
@Composable
fun DeltaTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        val window = (LocalContext.current as? Activity)?.window
        SideEffect {
            window?.let {
                WindowCompat.getInsetsController(it, view).apply {
                    isAppearanceLightStatusBars = false
                    isAppearanceLightNavigationBars = false
                }
            }
        }
    }

    MaterialTheme(
        colorScheme = DarkScheme,
        typography = DeltaTypography,
        content = content,
    )
}

/** Standard corner radius used by cards and sheets. */
val CardCorner = 18.dp
