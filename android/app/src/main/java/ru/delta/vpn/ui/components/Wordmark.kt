package ru.delta.vpn.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.delta.vpn.ui.theme.DeltaColors

/**
 * The "Dельта" lockup: a blue latin D leading into white Cyrillic, mirroring how
 * the brand is written.
 */
@Composable
fun DeltaWordmark(
    modifier: Modifier = Modifier,
    fontSize: TextUnit = 26.sp,
    showVpnSuffix: Boolean = false,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = "D",
            color = DeltaColors.Blue,
            fontSize = fontSize,
            fontWeight = FontWeight.Black,
        )
        Text(
            text = "ельта",
            color = DeltaColors.White,
            fontSize = fontSize,
            fontWeight = FontWeight.Black,
        )
        if (showVpnSuffix) {
            Spacer(Modifier.width(8.dp))
            Text(
                text = "VPN",
                color = DeltaColors.Blue,
                fontSize = fontSize * 0.78f,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
