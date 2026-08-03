package ru.delta.vpn.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import ru.delta.vpn.BuildConfig
import ru.delta.vpn.ui.HomeViewModel
import ru.delta.vpn.ui.theme.CardCorner
import ru.delta.vpn.ui.theme.DeltaColors

@Composable
fun SettingsScreen(
    viewModel: HomeViewModel,
    onBack: () -> Unit,
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    val engine by viewModel.engineName.collectAsStateWithLifecycle()

    var subscription by remember(settings.subscriptionUrl) { mutableStateOf(settings.subscriptionUrl) }
    var link by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DeltaColors.Background)
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        ScreenHeader(title = "Настройки", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SectionCard(title = "Подписка") {
                DeltaTextField(
                    value = subscription,
                    onValueChange = { subscription = it },
                    placeholder = "https://…/sub?token=…",
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { viewModel.syncSubscription(subscription) },
                    enabled = !busy && subscription.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = DeltaColors.Blue),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (busy) "Обновляем…" else "Обновить список серверов")
                }
            }

            SectionCard(title = "Добавить сервер вручную") {
                DeltaTextField(
                    value = link,
                    onValueChange = { link = it },
                    placeholder = "vless://…",
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        viewModel.importLink(link)
                        link = ""
                    },
                    enabled = !busy && link.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = DeltaColors.SurfaceElevated),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Добавить ссылку", color = DeltaColors.White)
                }
            }

            SectionCard(title = "Маршрутизация") {
                SettingSwitch(
                    title = "Российские сайты — напрямую",
                    subtitle = "Госуслуги, банки и маркетплейсы идут мимо туннеля",
                    checked = settings.bypassRussianDomains,
                    onCheckedChange = viewModel::setBypassRussianDomains,
                )
                SettingSwitch(
                    title = "Блокировать QUIC",
                    subtitle = "Браузеры переходят на TLS, трафик маршрутизируется точнее",
                    checked = settings.blockQuic,
                    onCheckedChange = viewModel::setBlockQuic,
                )
                SettingSwitch(
                    title = "Использовать geoip/geosite",
                    subtitle = "Включайте только если файлы geoip.dat и geosite.dat загружены",
                    checked = settings.useGeoFiles,
                    onCheckedChange = viewModel::setUseGeoFiles,
                )
                SettingSwitch(
                    title = "Подключаться при запуске системы",
                    subtitle = "Автоматически поднимать туннель после перезагрузки",
                    checked = settings.connectOnBoot,
                    onCheckedChange = viewModel::setConnectOnBoot,
                )
            }

            SectionCard(title = "О приложении") {
                InfoRow("Версия", BuildConfig.VERSION_NAME)
                InfoRow("Ядро", if (viewModel.demoMode) "демо (без Xray)" else engine.ifBlank { "Xray" })
                InfoRow("Пакет", BuildConfig.APPLICATION_ID)
                if (viewModel.demoMode) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Сборка без нативного ядра: интерфейс работает полностью, " +
                            "но трафик через туннель не идёт. Подключите libv2ray.aar и " +
                            "libtun2socks.so — см. docs/VPN-CORE.md.",
                        color = DeltaColors.TextMuted,
                        fontSize = 13.sp,
                    )
                }
            }

            message?.let { text ->
                Text(
                    text = text,
                    color = DeltaColors.Blue,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
                // The result of the last action fades out on its own.
                LaunchedEffect(text) {
                    delay(4_000)
                    viewModel.consumeMessage()
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(CardCorner))
            .background(DeltaColors.Surface)
            .padding(16.dp),
    ) {
        Text(
            text = title,
            color = DeltaColors.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))
        content()
    }
}

@Composable
private fun DeltaTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = DeltaColors.TextFaint, fontSize = 14.sp) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = DeltaColors.White,
            unfocusedTextColor = DeltaColors.White,
            focusedBorderColor = DeltaColors.Blue,
            unfocusedBorderColor = DeltaColors.SurfaceElevated,
            cursorColor = DeltaColors.Blue,
        ),
    )
}

@Composable
private fun SettingSwitch(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = DeltaColors.White, fontSize = 15.sp)
            Text(subtitle, color = DeltaColors.TextMuted, fontSize = 12.sp)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = DeltaColors.White,
                checkedTrackColor = DeltaColors.Blue,
                uncheckedThumbColor = DeltaColors.TextMuted,
                uncheckedTrackColor = DeltaColors.SurfaceElevated,
            ),
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
    ) {
        Text(label, color = DeltaColors.TextMuted, fontSize = 14.sp, modifier = Modifier.weight(1f))
        Text(value, color = DeltaColors.White, fontSize = 14.sp)
    }
}
