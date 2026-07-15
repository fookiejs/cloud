package com.taskbridge.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.taskbridge.mobile.ui.theme.AccentSoft
import com.taskbridge.mobile.ui.theme.BackgroundBase
import com.taskbridge.mobile.ui.theme.BackgroundDeep
import com.taskbridge.mobile.ui.theme.PrimarySoft

@Composable
fun AppBackground(content: @Composable () -> Unit) {
    Box(modifier = Modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(BackgroundDeep, BackgroundBase, BackgroundDeep),
                ),
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        PrimarySoft.copy(alpha = 0.22f),
                        Color.Transparent,
                    ),
                    center = Offset(size.width * 0.15f, size.height * 0.08f),
                    radius = size.maxDimension * 0.55f,
                ),
                radius = size.maxDimension * 0.55f,
                center = Offset(size.width * 0.15f, size.height * 0.08f),
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        AccentSoft.copy(alpha = 0.14f),
                        Color.Transparent,
                    ),
                    center = Offset(size.width * 0.88f, size.height * 0.22f),
                    radius = size.maxDimension * 0.45f,
                ),
                radius = size.maxDimension * 0.45f,
                center = Offset(size.width * 0.88f, size.height * 0.22f),
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        PrimarySoft.copy(alpha = 0.1f),
                        Color.Transparent,
                    ),
                    center = Offset(size.width * 0.5f, size.height * 0.92f),
                    radius = size.maxDimension * 0.5f,
                ),
                radius = size.maxDimension * 0.5f,
                center = Offset(size.width * 0.5f, size.height * 0.92f),
            )
        }
        content()
    }
}
