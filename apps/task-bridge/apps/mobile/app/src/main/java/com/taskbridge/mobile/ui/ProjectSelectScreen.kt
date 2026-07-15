package com.taskbridge.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.taskbridge.mobile.domain.models.Project
import com.taskbridge.mobile.ui.components.AppBackground
import com.taskbridge.mobile.ui.theme.Accent
import com.taskbridge.mobile.ui.theme.Error
import com.taskbridge.mobile.ui.theme.Primary
import com.taskbridge.mobile.ui.theme.Success
import com.taskbridge.mobile.ui.theme.SurfaceBorder
import com.taskbridge.mobile.ui.theme.SurfaceElevated
import com.taskbridge.mobile.ui.theme.TextMuted
import com.taskbridge.mobile.ui.theme.TextPrimary

@Composable
fun ProjectSelectScreen(
    state: AppUiState,
    onSelect: (String) -> Unit,
    onContinue: () -> Unit,
    onRefresh: () -> Unit,
    onNavigateSettings: () -> Unit,
) {
    LaunchedEffect(Unit) {
        onRefresh()
    }

    AppBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Select project",
                        style = MaterialTheme.typography.headlineSmall,
                        color = TextPrimary,
                    )
                    Text(
                        text = "Tasks are routed to this project",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                IconButton(onClick = onNavigateSettings) {
                    Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextMuted)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            when {
                state.isLoadingProjects && state.projects.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(28.dp),
                            strokeWidth = 2.dp,
                            color = Accent,
                        )
                    }
                }
                state.projects.isEmpty() -> {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = state.projectsError ?: "No projects found",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Error,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedButton(onClick = onRefresh) {
                            Text("Retry")
                        }
                    }
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(bottom = 8.dp),
                    ) {
                        items(state.projects, key = { it.id }) { project ->
                            ProjectCard(
                                project = project,
                                selected = project.id == state.selectedProjectId,
                                onClick = { onSelect(project.id) },
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = onContinue,
                        enabled = state.selectedProjectId != null,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Primary),
                    ) {
                        Text("Continue")
                    }
                }
            }
        }
    }
}

@Composable
private fun ProjectCard(
    project: Project,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(88.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceElevated.copy(alpha = if (selected) 0.9f else 0.6f))
            .border(
                width = if (selected) 1.5.dp else 1.dp,
                color = if (selected) Success else SurfaceBorder,
                shape = RoundedCornerShape(16.dp),
            )
            .clickable(onClick = onClick)
            .padding(12.dp),
    ) {
        if (selected) {
            Icon(
                Icons.Default.CheckCircle,
                contentDescription = null,
                tint = Success,
                modifier = Modifier
                    .size(18.dp)
                    .align(Alignment.TopEnd),
            )
        }
        Column(modifier = Modifier.align(Alignment.CenterStart)) {
            Text(
                text = project.name,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
