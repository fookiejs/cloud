package com.taskbridge.mobile.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.taskbridge.mobile.ui.theme.PrimarySoft
import com.taskbridge.mobile.ui.theme.TextPrimary

@Composable
fun ScrollToTopFab(
    visible: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (visible) {
        SmallFloatingActionButton(
            onClick = onClick,
            modifier = modifier,
            containerColor = PrimarySoft,
        ) {
            Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Scroll to top", tint = TextPrimary)
        }
    }
}
