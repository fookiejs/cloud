package com.taskbridge.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.taskbridge.mobile.ui.components.AppBackground
import com.taskbridge.mobile.ui.components.GlassField
import com.taskbridge.mobile.ui.theme.AccentSoft
import com.taskbridge.mobile.ui.theme.Error
import com.taskbridge.mobile.ui.theme.Primary
import com.taskbridge.mobile.ui.theme.PrimarySoft
import com.taskbridge.mobile.ui.theme.SurfaceBorder
import com.taskbridge.mobile.ui.theme.TextMuted
import com.taskbridge.mobile.ui.theme.TextPrimary
import com.taskbridge.mobile.ui.theme.TextSecondary

@Composable
fun LoginScreen(
    state: AppUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLogin: () -> Unit,
    onRescanQr: () -> Unit,
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
            Spacer(modifier = Modifier.height(24.dp))

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
                text = "Sign in",
                style = MaterialTheme.typography.displayLarge,
                color = TextPrimary,
            )
            Text(
                text = endpoint,
                style = MaterialTheme.typography.labelMedium,
                color = TextMuted,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 8.dp),
            )

            Spacer(modifier = Modifier.height(32.dp))

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                GlassField(
                    value = state.loginEmail,
                    onValueChange = onEmailChange,
                    label = "Email",
                    leadingIcon = Icons.Outlined.Mail,
                    keyboardType = KeyboardType.Email,
                )
                GlassField(
                    value = state.loginPassword,
                    onValueChange = onPasswordChange,
                    label = "Password",
                    leadingIcon = Icons.Outlined.Lock,
                    keyboardType = KeyboardType.Password,
                    visualTransformation = PasswordVisualTransformation(),
                )
            }

            if (state.loginError != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = state.loginError,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Error,
                    textAlign = TextAlign.Center,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onLogin,
                enabled = !state.isLoggingIn,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary),
            ) {
                if (state.isLoggingIn) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        color = Color.White,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Log in", style = MaterialTheme.typography.titleMedium)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            TextButton(onClick = onRescanQr) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = TextSecondary)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Scan QR instead", color = TextSecondary)
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
