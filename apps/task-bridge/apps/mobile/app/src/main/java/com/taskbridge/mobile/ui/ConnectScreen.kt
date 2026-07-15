package com.taskbridge.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.taskbridge.mobile.ui.components.AppBackground
import com.taskbridge.mobile.ui.theme.AccentSoft
import com.taskbridge.mobile.ui.theme.Primary
import com.taskbridge.mobile.ui.theme.PrimarySoft
import com.taskbridge.mobile.ui.theme.SurfaceBorder
import com.taskbridge.mobile.ui.theme.TextMuted
import com.taskbridge.mobile.ui.theme.TextPrimary
import com.taskbridge.mobile.ui.theme.TextSecondary

@Composable
fun ConnectScreen(
    state: AppUiState,
    onScanQr: () -> Unit,
    onLogin: () -> Unit,
    onSelectProject: () -> Unit,
    onNavigateSettings: () -> Unit,
) {
    val endpoint = formatBackendEndpoint(state.backendHost, state.backendPort, state.useHttps)

    AppBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                IconButton(onClick = onNavigateSettings) {
                    Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
                }
            }

            Box(
                modifier = Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(Brush.linearGradient(colors = listOf(PrimarySoft, Primary, AccentSoft)))
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(28.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "TB", style = MaterialTheme.typography.headlineLarge, color = Color.White)
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Task Bridge",
                style = MaterialTheme.typography.displayLarge,
                color = TextPrimary,
            )
            Text(
                text = when {
                    state.isConfigured && state.isLoggedIn -> "Connected — pick a project to continue"
                    state.isConfigured -> "Server set — log in to continue"
                    else -> "Scan the QR code from the web Mobile page"
                },
                style = MaterialTheme.typography.bodyLarge,
                color = TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp),
            )

            if (state.isConfigured) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = endpoint,
                    style = MaterialTheme.typography.labelMedium,
                    color = TextMuted,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            if (state.isConfigured && state.isLoggedIn) {
                Button(
                    onClick = onSelectProject,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary),
                ) {
                    Text("Select project", style = MaterialTheme.typography.titleMedium)
                }
                Spacer(modifier = Modifier.height(16.dp))
            } else if (state.isConfigured) {
                Button(
                    onClick = onLogin,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary),
                ) {
                    Text("Log in", style = MaterialTheme.typography.titleMedium)
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            Button(
                onClick = onScanQr,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimarySoft),
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = if (state.isConfigured) "Rescan QR" else "Scan QR code",
                    style = MaterialTheme.typography.titleMedium,
                )
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

fun formatBackendEndpoint(host: String, port: Int, useHttps: Boolean): String {
    val scheme = if (useHttps) "https" else "http"
    val defaultPort = if (useHttps) 443 else 80
    return if (port == defaultPort) "$scheme://$host" else "$scheme://$host:$port"
}
