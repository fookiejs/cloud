package com.taskbridge.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.taskbridge.mobile.ui.AnswerDetailScreen
import com.taskbridge.mobile.ui.AnswersListScreen
import com.taskbridge.mobile.ui.AppViewModel
import com.taskbridge.mobile.ui.ConnectScreen
import com.taskbridge.mobile.ui.EpicsListScreen
import com.taskbridge.mobile.ui.HomeScreen
import com.taskbridge.mobile.ui.LoginScreen
import com.taskbridge.mobile.ui.ProjectSelectScreen
import com.taskbridge.mobile.ui.SettingsScreen
import com.taskbridge.mobile.ui.theme.TaskBridgeTheme
import com.taskbridge.mobile.notifications.NotificationHelper

class MainActivity : ComponentActivity() {
    private val viewModel: AppViewModel by viewModels()
    private var pendingMicAction: (() -> Unit)? = null
    private var pendingNavAfterConnect: ((loggedIn: Boolean) -> Unit)? = null
    private val notificationTaskId = mutableIntStateOf(-1)

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    private val micPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) pendingMicAction?.invoke()
        pendingMicAction = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) launchQrScanner()
    }

    private val qrLauncher = registerForActivityResult(ScanContract()) { result ->
        val raw = result.contents
        if (raw.isNullOrBlank()) {
            viewModel.setStatusMessage("QR scan cancelled")
            return@registerForActivityResult
        }
        viewModel.connectFromQr(raw, resetProject = true) { loggedIn ->
            pendingNavAfterConnect?.invoke(loggedIn)
            pendingNavAfterConnect = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleConnectIntent(intent)
        requestNotificationPermission()
        extractTaskId(intent).takeIf { it > 0 }?.let { notificationTaskId.intValue = it }

        setContent {
            TaskBridgeTheme {
                val navController = rememberNavController()
                val state by viewModel.uiState.collectAsStateWithLifecycle()
                val pendingTaskId = notificationTaskId.intValue

                LaunchedEffect(pendingTaskId, state.isConfigured, state.isLoggedIn, state.projectConfirmed) {
                    if (pendingTaskId > 0 && state.isConfigured && state.isLoggedIn && state.projectConfirmed) {
                        navController.navigate("answer/$pendingTaskId")
                        notificationTaskId.intValue = -1
                    }
                }

                NavHost(
                    navController = navController,
                    startDestination = when {
                        !state.isConfigured -> "connect"
                        !state.isLoggedIn -> "login"
                        !state.projectConfirmed -> "projects"
                        else -> "home"
                    },
                ) {
                    composable("connect") {
                        ConnectScreen(
                            state = state,
                            onScanQr = {
                                pendingNavAfterConnect = { loggedIn ->
                                    navController.navigate(if (loggedIn) "projects" else "login") {
                                        popUpTo("connect") { inclusive = true }
                                    }
                                }
                                requestCameraAndScan()
                            },
                            onLogin = { navController.navigate("login") },
                            onSelectProject = {
                                viewModel.refreshProjects()
                                navController.navigate("projects")
                            },
                            onNavigateSettings = { navController.navigate("settings") },
                        )
                    }
                    composable("login") {
                        LoginScreen(
                            state = state,
                            onEmailChange = viewModel::updateLoginEmail,
                            onPasswordChange = viewModel::updateLoginPassword,
                            onLogin = {
                                viewModel.login {
                                    navController.navigate("projects") {
                                        popUpTo("login") { inclusive = true }
                                    }
                                }
                            },
                            onRescanQr = {
                                pendingNavAfterConnect = { loggedIn ->
                                    navController.navigate(if (loggedIn) "projects" else "login") {
                                        popUpTo("login") { inclusive = true }
                                    }
                                }
                                requestCameraAndScan()
                            },
                        )
                    }
                    composable("settings") {
                        SettingsScreen(
                            state = state,
                            onHostChange = viewModel::updateBackendHost,
                            onPortChange = { port ->
                                port.toIntOrNull()?.let { viewModel.updateBackendPort(it) }
                            },
                            onScanQr = {
                                pendingNavAfterConnect = { loggedIn ->
                                    navController.navigate(if (loggedIn) "projects" else "login") {
                                        popUpTo("settings") { inclusive = true }
                                    }
                                }
                                requestCameraAndScan()
                            },
                            onSave = {
                                viewModel.saveServerSettings {
                                    navController.navigate("login") {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            },
                            onNavigateProjects = {
                                viewModel.refreshProjects()
                                navController.navigate("projects")
                            },
                            onLogout = {
                                viewModel.logout {
                                    navController.navigate("login") {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            },
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable("projects") {
                        DisposableEffect(Unit) {
                            onDispose {
                                viewModel.revertProjectSelectionIfUnconfirmed()
                            }
                        }
                        ProjectSelectScreen(
                            state = state,
                            onSelect = viewModel::selectProject,
                            onContinue = {
                                if (viewModel.confirmProjectSelection()) {
                                    val hasHome = navController.popBackStack("home", false)
                                    if (!hasHome) {
                                        navController.navigate("home") {
                                            popUpTo("projects") { inclusive = true }
                                        }
                                    }
                                }
                            },
                            onRefresh = { viewModel.refreshProjects() },
                            onNavigateSettings = { navController.navigate("settings") },
                        )
                    }
                    composable("home") {
                        LaunchedEffect(state.isConfigured, state.isLoggedIn, state.projectConfirmed) {
                            when {
                                !state.isConfigured -> {
                                    navController.navigate("connect") {
                                        popUpTo("home") { inclusive = true }
                                    }
                                }
                                !state.isLoggedIn -> {
                                    navController.navigate("login") {
                                        popUpTo("home") { inclusive = true }
                                    }
                                }
                                !state.projectConfirmed -> {
                                    navController.navigate("projects") {
                                        popUpTo("home") { inclusive = true }
                                    }
                                }
                            }
                        }
                        HomeScreen(
                            state = state,
                            onPushToTalkStart = { requestMic { viewModel.startPushToTalk() } },
                            onPushToTalkStop = viewModel::stopPushToTalk,
                            onSubmitPending = viewModel::submitPendingTranscript,
                            onDiscardPending = viewModel::discardPendingTranscript,
                            onTextChange = viewModel::updateTextMessage,
                            onSubmitText = viewModel::submitTextMessage,
                            onNavigateAnswers = { navController.navigate("answers") },
                            onNavigateEpics = { navController.navigate("epics") },
                            onNavigateSettings = { navController.navigate("settings") },
                            onOpenRecent = { taskId ->
                                navController.navigate("answer/$taskId")
                            },
                        )
                    }
                    composable("epics") {
                        EpicsListScreen(
                            state = state,
                            onBack = { navController.popBackStack() },
                            onRefresh = { viewModel.refreshEpics() },
                            onOpenEpic = { epicId ->
                                navController.navigate("answer/$epicId")
                            },
                        )
                    }
                    composable("answers") {
                        AnswersListScreen(
                            state = state,
                            onBack = { navController.popBackStack() },
                            onPoll = { viewModel.refreshInbox(silent = true) },
                            onOpenTask = { taskId ->
                                navController.navigate("answer/$taskId")
                            },
                        )
                    }
                    composable(
                        route = "answer/{taskId}",
                        arguments = listOf(navArgument("taskId") { type = NavType.IntType }),
                    ) { entry ->
                        val taskId = entry.arguments?.getInt("taskId") ?: return@composable
                        AnswerDetailScreen(
                            taskId = taskId,
                            state = state,
                            onBack = {
                                viewModel.clearActiveDetail()
                                navController.popBackStack()
                            },
                            onLoad = viewModel::loadAnswerDetail,
                            onSendComment = viewModel::sendTaskComment,
                            onListen = viewModel::listen,
                            onOpenLinkedTask = { linkedTaskId ->
                                navController.navigate("answer/$linkedTaskId")
                            },
                            onCreateEpicTask = { epicId, parentId, stageId, title, description ->
                                viewModel.createEpicWorkflowTask(
                                    epicId = epicId,
                                    parentId = parentId,
                                    stageId = stageId,
                                    title = title,
                                    description = description,
                                ) { createdId ->
                                    navController.navigate("answer/$createdId")
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleConnectIntent(intent)
        extractTaskId(intent).takeIf { it > 0 }?.let { notificationTaskId.intValue = it }
    }

    private fun extractTaskId(intent: Intent?): Int {
        return intent?.getIntExtra(NotificationHelper.EXTRA_TASK_ID, -1) ?: -1
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun handleConnectIntent(intent: Intent?) {
        val uri: Uri = intent?.data ?: return
        if (uri.scheme == "taskbridge" && (uri.host == "connect" || uri.host == "auth")) {
            viewModel.connectFromQr(uri.toString(), resetProject = true)
        }
    }

    private fun requestCameraAndScan() {
        when {
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED -> launchQrScanner()
            else -> cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchQrScanner() {
        val options = ScanOptions()
        options.setPrompt("Scan QR from web Mobile page")
        options.setBeepEnabled(false)
        options.setDesiredBarcodeFormats(ScanOptions.QR_CODE)
        options.setOrientationLocked(false)
        qrLauncher.launch(options)
    }

    private fun requestMic(action: () -> Unit) {
        when {
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED -> action()
            else -> {
                pendingMicAction = action
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
}
