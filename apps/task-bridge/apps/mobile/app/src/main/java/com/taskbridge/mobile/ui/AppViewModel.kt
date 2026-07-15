package com.taskbridge.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.taskbridge.mobile.data.SessionStore
import com.taskbridge.mobile.data.TaskRepository
import com.taskbridge.mobile.domain.models.AnswerDetail
import com.taskbridge.mobile.domain.models.AnswerEntry
import com.taskbridge.mobile.domain.models.ConnectConfigParser
import com.taskbridge.mobile.domain.models.EpicListItem
import com.taskbridge.mobile.domain.models.InboxItem
import com.taskbridge.mobile.domain.models.Project
import com.taskbridge.mobile.domain.models.RecentTask
import com.taskbridge.mobile.domain.models.WorkflowStageItem
import com.taskbridge.mobile.domain.models.buildAnswerEntries
import com.taskbridge.mobile.domain.models.taskBelongsToProject
import com.taskbridge.mobile.speech.SpeechRecognizerHelper
import com.taskbridge.mobile.speech.TextToSpeechHelper
import com.taskbridge.mobile.speech.plainSpeechText
import com.taskbridge.mobile.notifications.InboxPollWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AppUiState(
    val backendHost: String = SessionStore.DEFAULT_HOST,
    val backendPort: Int = SessionStore.DEFAULT_PORT,
    val useHttps: Boolean = false,
    val isConfigured: Boolean = false,
    val isLoggedIn: Boolean = false,
    val userName: String = "",
    val loginEmail: String = "",
    val loginPassword: String = "",
    val loginError: String? = null,
    val isLoggingIn: Boolean = false,
    val projects: List<Project> = emptyList(),
    val selectedProjectId: String? = null,
    val projectConfirmed: Boolean = false,
    val projectsError: String? = null,
    val isLoadingProjects: Boolean = false,
    val isListening: Boolean = false,
    val isSending: Boolean = false,
    val isSendingComment: Boolean = false,
    val isLoadingInbox: Boolean = false,
    val isLoadingEpics: Boolean = false,
    val isLoadingDetail: Boolean = false,
    val isLoadingWorkflowStages: Boolean = false,
    val isCreatingEpicTask: Boolean = false,
    val workflowStages: List<WorkflowStageItem> = emptyList(),
    val workflowStagesError: String? = null,
    val isSpeaking: Boolean = false,
    val speakingKey: String? = null,
    val recentTasks: List<RecentTask> = emptyList(),
    val inboxItems: List<InboxItem> = emptyList(),
    val epics: List<EpicListItem> = emptyList(),
    val answerEntries: List<AnswerEntry> = emptyList(),
    val inboxError: String? = null,
    val epicsError: String? = null,
    val readTaskIds: Set<Int> = emptySet(),
    val activeDetail: AnswerDetail? = null,
    val detailError: String? = null,
    val lastTranscript: String? = null,
    val pendingTranscript: String? = null,
    val liveTranscript: String? = null,
    val statusMessage: String? = null,
    val showManualSetup: Boolean = false,
    val textMessage: String? = null,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application)
    private val taskRepository = TaskRepository(sessionStore)
    private val speechHelper = SpeechRecognizerHelper(application)
    private val ttsHelper = TextToSpeechHelper(application)
    private var accumulatedTranscript: String? = null
    private var lastInboxRefreshAt = 0L
    private var projectsRequestId = 0

    private val _uiState = MutableStateFlow(
        run {
            val savedProjectId = sessionStore.selectedProjectId
            var confirmed = sessionStore.projectConfirmed
            if (confirmed && savedProjectId.isNullOrBlank()) {
                sessionStore.projectConfirmed = false
                confirmed = false
            }
            val scopedProjectId = savedProjectId?.takeIf { confirmed }
            val recent = if (scopedProjectId.isNullOrBlank()) {
                sessionStore.recentTasks()
            } else {
                sessionStore.recentTasks().filter { taskBelongsToProject(it.projectId, scopedProjectId) }
            }
            AppUiState(
                backendHost = sessionStore.backendHost,
                backendPort = sessionStore.backendPort,
                useHttps = sessionStore.useHttps,
                isConfigured = sessionStore.isConfigured,
                isLoggedIn = sessionStore.isLoggedIn(),
                userName = sessionStore.userName,
                selectedProjectId = savedProjectId,
                projectConfirmed = confirmed,
                readTaskIds = sessionStore.readTaskIds(),
                recentTasks = recent,
                answerEntries = buildAnswerEntries(recent, emptyList(), scopedProjectId),
            )
        },
    )
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            speechHelper.segments.collect { segment ->
                appendSegment(segment)
            }
        }
        viewModelScope.launch {
            speechHelper.partials.collect { partial ->
                updateLiveTranscript(partial)
            }
        }
        viewModelScope.launch {
            speechHelper.sessionEnded.collect {
                finalizeRecording()
            }
        }
        viewModelScope.launch {
            speechHelper.errors.collect { error ->
                _uiState.update { it.copy(isListening = false, statusMessage = error) }
            }
        }
        viewModelScope.launch {
            ttsHelper.isSpeaking.collect { speaking ->
                _uiState.update {
                    it.copy(
                        isSpeaking = speaking,
                        speakingKey = if (speaking) it.speakingKey else null,
                    )
                }
            }
        }
        if (sessionStore.isConfigured && sessionStore.isLoggedIn()) {
            refreshProjects(silent = true, autoConfirm = false)
            if (sessionStore.projectConfirmed) {
                InboxPollWorker.start(getApplication())
                refreshInbox(silent = true)
            }
        }
    }

    fun refreshProjects(silent: Boolean = false, autoConfirm: Boolean = false) {
        val requestId = ++projectsRequestId
        viewModelScope.launch {
            try {
                _uiState.update {
                    it.copy(
                        isLoadingProjects = true,
                        projectsError = if (silent) it.projectsError else null,
                    )
                }
                val projects = taskRepository.fetchProjects()
                if (requestId != projectsRequestId) return@launch
                val savedId = sessionStore.selectedProjectId
                val selectedId = when {
                    savedId != null && projects.any { it.id == savedId } -> savedId
                    autoConfirm && projects.isNotEmpty() -> projects.first().id
                    else -> savedId?.takeIf { id -> projects.any { it.id == id } }
                }
                if (selectedId != null) {
                    sessionStore.selectedProjectId = selectedId
                }
                var confirmed = if (autoConfirm && selectedId != null && !sessionStore.projectConfirmed) {
                    sessionStore.projectConfirmed = true
                    true
                } else {
                    sessionStore.projectConfirmed
                }
                if (confirmed && selectedId == null) {
                    sessionStore.projectConfirmed = false
                    confirmed = false
                }
                if (confirmed && selectedId != null) {
                    InboxPollWorker.start(getApplication())
                }
                _uiState.update {
                    it.copy(
                        projects = projects,
                        selectedProjectId = selectedId,
                        projectConfirmed = confirmed,
                        isLoadingProjects = false,
                        answerEntries = answerEntriesFor(
                            it.recentTasks,
                            it.inboxItems,
                            selectedId,
                            confirmed,
                        ),
                        projectsError = if (projects.isEmpty()) {
                            "No projects returned — check backend connection"
                        } else {
                            null
                        },
                    )
                }
                if (confirmed) {
                    refreshInbox(silent = true)
                }
            } catch (e: Exception) {
                if (requestId != projectsRequestId) return@launch
                _uiState.update {
                    it.copy(
                        isLoadingProjects = false,
                        projectsError = e.message ?: "Projects failed",
                    )
                }
            }
        }
    }

    fun updateTextMessage(text: String) {
        _uiState.update { it.copy(textMessage = text.takeIf { it.isNotEmpty() }) }
    }

    fun submitTextMessage() {
        val text = _uiState.value.textMessage?.trim()?.takeIf { it.isNotEmpty() } ?: return
        submitTask(text)
        _uiState.update { it.copy(textMessage = null) }
    }

    fun selectProject(projectId: String) {
        val savedProjectId = sessionStore.selectedProjectId
        val inboxForEntries = if (projectId == savedProjectId && _uiState.value.projectConfirmed) {
            scopedInboxItems(_uiState.value.inboxItems, projectId)
        } else {
            emptyList()
        }
        _uiState.update { state ->
            state.copy(
                selectedProjectId = projectId,
                pendingTranscript = null,
                textMessage = null,
                inboxItems = inboxForEntries,
                answerEntries = answerEntriesFor(
                    state.recentTasks,
                    inboxForEntries,
                    projectId,
                    state.projectConfirmed,
                ),
            )
        }
    }

    fun confirmProjectSelection(): Boolean {
        val projectId = _uiState.value.selectedProjectId ?: return false
        sessionStore.selectedProjectId = projectId
        sessionStore.projectConfirmed = true
        sessionStore.retainRecentTasksForProject(projectId)
        val recent = scopedRecentTasks(sessionStore.recentTasks(), projectId)
        _uiState.update {
            it.copy(
                projectConfirmed = true,
                selectedProjectId = projectId,
                pendingTranscript = null,
                textMessage = null,
                recentTasks = recent,
                inboxItems = emptyList(),
                answerEntries = answerEntriesFor(recent, emptyList(), projectId, true),
            )
        }
        InboxPollWorker.start(getApplication())
        refreshInbox(silent = true, force = true)
        return true
    }

    fun resetProjectSelection() {
        sessionStore.projectConfirmed = false
        _uiState.update { it.copy(projectConfirmed = false) }
    }

    fun revertProjectSelectionIfUnconfirmed() {
        val savedProjectId = sessionStore.selectedProjectId
        if (_uiState.value.selectedProjectId == savedProjectId) return
        _uiState.update { state ->
            state.copy(
                selectedProjectId = savedProjectId,
                answerEntries = answerEntriesFor(
                    state.recentTasks,
                    scopedInboxItems(state.inboxItems, savedProjectId),
                    savedProjectId,
                    state.projectConfirmed,
                ),
            )
        }
        if (sessionStore.projectConfirmed && !savedProjectId.isNullOrBlank()) {
            refreshInbox(silent = true, force = true)
        }
    }

    private fun appendSegment(segment: String) {
        if (!_uiState.value.isListening || segment.isBlank()) return
        accumulatedTranscript = accumulatedTranscript?.let { "$it $segment" } ?: segment
        _uiState.update {
            it.copy(
                liveTranscript = accumulatedTranscript,
                statusMessage = "Listening...",
            )
        }
    }

    private fun updateLiveTranscript(partial: String) {
        if (!_uiState.value.isListening || partial.isBlank()) return
        val preview = accumulatedTranscript?.let { "$it $partial" } ?: partial
        _uiState.update { it.copy(liveTranscript = preview) }
    }

    private fun finalizeRecording() {
        val transcript = accumulatedTranscript?.trim()?.takeIf { it.isNotBlank() }
            ?: _uiState.value.liveTranscript?.trim()?.takeIf { it.isNotBlank() }
        accumulatedTranscript = null
        if (transcript == null) {
            _uiState.update {
                it.copy(isListening = false, liveTranscript = null, statusMessage = "Nothing heard")
            }
            return
        }

        _uiState.update {
            it.copy(
                pendingTranscript = transcript,
                lastTranscript = transcript,
                liveTranscript = null,
                isListening = false,
                statusMessage = "Review and send",
            )
        }
    }

    fun refreshEpics() {
        if (!sessionStore.projectConfirmed) return
        val projectId = sessionStore.selectedProjectId?.takeIf { it.isNotBlank() } ?: return
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isLoadingEpics = true, epicsError = null) }
                val result = taskRepository.fetchEpics(projectId)
                _uiState.update {
                    it.copy(
                        isLoadingEpics = false,
                        epics = result.items,
                        epicsError = null,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingEpics = false,
                        epicsError = e.message ?: "Failed to load epics",
                    )
                }
            }
        }
    }

    fun refreshInbox(silent: Boolean = false, force: Boolean = false) {
        if (!sessionStore.projectConfirmed) return
        val now = System.currentTimeMillis()
        if (silent && !force && now - lastInboxRefreshAt < 30_000) return
        lastInboxRefreshAt = now
        viewModelScope.launch {
            try {
                if (!silent) {
                    _uiState.update { it.copy(isLoadingInbox = true, inboxError = null) }
                }
                val scopedProjectId = sessionStore.selectedProjectId?.takeIf { sessionStore.projectConfirmed }
                val items = scopedInboxItems(
                    taskRepository.fetchInbox(scopedProjectId),
                    scopedProjectId,
                )
                InboxPollWorker.notifyNewAnswers(getApplication(), sessionStore, items)
                val recent = scopedRecentTasks(
                    sessionStore.recentTasks(),
                    scopedProjectId,
                )
                val entries = answerEntriesFor(
                    recent,
                    items,
                    scopedProjectId,
                    sessionStore.projectConfirmed,
                )
                _uiState.update { state ->
                    val applySessionInbox = state.selectedProjectId == scopedProjectId
                    state.copy(
                        isLoadingInbox = false,
                        recentTasks = recent,
                        inboxItems = if (applySessionInbox) items else state.inboxItems,
                        answerEntries = if (applySessionInbox) {
                            entries
                        } else {
                            answerEntriesFor(
                                scopedRecentTasks(state.recentTasks, state.selectedProjectId),
                                emptyList(),
                                state.selectedProjectId,
                                state.projectConfirmed,
                            )
                        },
                        inboxError = null,
                        statusMessage = if (!silent && state.projectConfirmed && applySessionInbox) {
                            val readyCount = entries.count { entry -> entry is AnswerEntry.Ready }
                            if (readyCount > 0) "$readyCount new" else state.statusMessage
                        } else {
                            state.statusMessage
                        },
                    )
                }
            } catch (e: Exception) {
                val message = e.message ?: "Inbox failed"
                _uiState.update {
                    it.copy(
                        isLoadingInbox = false,
                        inboxError = message,
                        statusMessage = if (it.projectConfirmed) "Inbox failed" else it.statusMessage,
                        answerEntries = answerEntriesFor(it.recentTasks, emptyList(), it.selectedProjectId, it.projectConfirmed),
                    )
                }
            }
        }
    }

    fun loadAnswerDetail(taskId: Int, silent: Boolean = false) {
        viewModelScope.launch {
            try {
                if (!silent) {
                    _uiState.update {
                        it.copy(isLoadingDetail = true, detailError = null, activeDetail = null)
                    }
                }
                val detail = taskRepository.fetchAnswerDetail(taskId)
                if (detail.status == "ready") {
                    sessionStore.markTaskRead(taskId)
                }
                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        activeDetail = detail,
                        detailError = null,
                        readTaskIds = sessionStore.readTaskIds(),
                        inboxItems = it.inboxItems,
                        answerEntries = answerEntriesFor(it.recentTasks, it.inboxItems, it.selectedProjectId, it.projectConfirmed),
                    )
                }
                if (detail.status == "ready") {
                    refreshInbox(silent = true)
                }
                if (detail.isEpic && !detail.projectId.isNullOrBlank()) {
                    loadWorkflowStages(detail.projectId)
                }
            } catch (e: Exception) {
                val recent = _uiState.value.recentTasks.find { it.taskId == taskId }
                if (recent != null && !silent) {
                    _uiState.update {
                        it.copy(
                            isLoadingDetail = false,
                            activeDetail = AnswerDetail(
                                taskId = taskId,
                                title = recent.title,
                                request = recent.title,
                                status = "sent",
                                createdAt = null,
                                createdBy = "You",
                                projectId = recent.projectId,
                                projectName = recent.projectName,
                            ),
                            detailError = null,
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoadingDetail = false,
                            detailError = e.message ?: "Load failed",
                        )
                    }
                }
            }
        }
    }

    fun clearActiveDetail() {
        stopSpeech()
        _uiState.update {
            it.copy(
                activeDetail = null,
                detailError = null,
                workflowStages = emptyList(),
                workflowStagesError = null,
            )
        }
    }

    fun loadWorkflowStages(projectId: String) {
        viewModelScope.launch {
            try {
                _uiState.update {
                    it.copy(isLoadingWorkflowStages = true, workflowStagesError = null)
                }
                val stages = taskRepository.fetchWorkflowStages(projectId)
                _uiState.update {
                    it.copy(
                        isLoadingWorkflowStages = false,
                        workflowStages = stages,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingWorkflowStages = false,
                        workflowStages = emptyList(),
                        workflowStagesError = e.message ?: "Workflow failed",
                    )
                }
            }
        }
    }

    fun createEpicWorkflowTask(
        epicId: Int,
        parentId: Int,
        stageId: String?,
        title: String,
        description: String,
        onCreated: (Int) -> Unit = {},
    ) {
        val trimmedTitle = title.trim()
        if (trimmedTitle.isBlank() || parentId <= 0) return
        viewModelScope.launch {
            try {
                _uiState.update {
                    it.copy(isCreatingEpicTask = true, statusMessage = "Creating task...")
                }
                val createdId = taskRepository.createEpicSubtask(
                    parentId = parentId,
                    title = trimmedTitle,
                    description = description.trim(),
                    stageId = stageId?.trim()?.takeIf { it.isNotBlank() },
                )
                loadAnswerDetail(epicId, silent = true)
                _uiState.update {
                    it.copy(isCreatingEpicTask = false, statusMessage = "Task created")
                }
                if (createdId > 0) {
                    onCreated(createdId)
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isCreatingEpicTask = false,
                        statusMessage = "Failed: ${e.message}",
                    )
                }
            }
        }
    }

    fun sendTaskComment(taskId: Int, text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isSendingComment = true, statusMessage = "Sending comment...") }
                taskRepository.postTaskComment(taskId, trimmed)
                loadAnswerDetail(taskId, silent = true)
                _uiState.update {
                    it.copy(
                        isSendingComment = false,
                        statusMessage = "Comment sent",
                    )
                }
                refreshInbox(silent = true)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSendingComment = false,
                        statusMessage = "Comment failed: ${e.message}",
                    )
                }
            }
        }
    }

    fun listen(key: String, text: String) {
        val trimmed = plainSpeechText(text)
        if (trimmed.isBlank()) return
        val state = _uiState.value
        if (state.isSpeaking && state.speakingKey == key) {
            stopSpeech()
            return
        }
        if (state.isSpeaking) {
            ttsHelper.stop()
        }
        _uiState.update { it.copy(speakingKey = key) }
        ttsHelper.speak(trimmed)
    }

    fun stopSpeech() {
        ttsHelper.stop()
        _uiState.update { it.copy(speakingKey = null) }
    }

    fun updateBackendHost(host: String) {
        sessionStore.backendHost = host
        _uiState.update { it.copy(backendHost = host) }
    }

    fun updateBackendPort(port: Int) {
        sessionStore.backendPort = port
        _uiState.update { it.copy(backendPort = port) }
    }

    fun updateLoginEmail(email: String) {
        _uiState.update { it.copy(loginEmail = email, loginError = null) }
    }

    fun updateLoginPassword(password: String) {
        _uiState.update { it.copy(loginPassword = password, loginError = null) }
    }

    fun login(onLoggedIn: () -> Unit = {}) {
        val email = _uiState.value.loginEmail.trim()
        val password = _uiState.value.loginPassword
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(loginError = "Enter email and password") }
            return
        }
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isLoggingIn = true, loginError = null) }
                val result = taskRepository.login(email, password)
                sessionStore.authToken = result.token
                sessionStore.userName = result.userName
                sessionStore.isConfigured = true
                _uiState.update {
                    it.copy(
                        isLoggingIn = false,
                        isLoggedIn = true,
                        userName = result.userName,
                        loginPassword = "",
                        loginError = null,
                        statusMessage = "Signed in",
                    )
                }
                refreshProjects(silent = true, autoConfirm = false)
                onLoggedIn()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoggingIn = false,
                        loginError = e.message ?: "Login failed",
                    )
                }
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit = {}) {
        sessionStore.logout()
        _uiState.update {
            it.copy(
                isLoggedIn = false,
                userName = "",
                loginEmail = "",
                loginPassword = "",
                loginError = null,
                projectConfirmed = false,
                selectedProjectId = null,
                projects = emptyList(),
                inboxItems = emptyList(),
                epics = emptyList(),
                answerEntries = emptyList(),
                statusMessage = "Signed out",
            )
        }
        onLoggedOut()
    }

    fun setStatusMessage(message: String) {
        _uiState.update { it.copy(statusMessage = message) }
    }

    fun connectFromQr(
        raw: String,
        resetProject: Boolean = true,
        onConnected: (loggedIn: Boolean) -> Unit = {},
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(statusMessage = "Reading QR…") }
            val config = ConnectConfigParser.resolve(raw) ?: run {
                _uiState.update { it.copy(statusMessage = "Invalid QR") }
                return@launch
            }
            sessionStore.backendHost = config.host
            sessionStore.backendPort = config.port
            sessionStore.useHttps = config.secure
            sessionStore.isConfigured = true
            val token = config.token
            val loggedIn: Boolean
            if (!token.isNullOrBlank()) {
                sessionStore.authToken = token
                loggedIn = true
            } else {
                loggedIn = sessionStore.isLoggedIn()
            }
            if (resetProject) {
                sessionStore.projectConfirmed = false
                sessionStore.selectedProjectId = null
            }
            _uiState.update {
                val projectUpdate = if (resetProject) {
                    it.copy(projectConfirmed = false, selectedProjectId = null)
                } else {
                    it
                }
                projectUpdate.copy(
                    backendHost = config.host,
                    backendPort = config.port,
                    useHttps = config.secure,
                    isConfigured = true,
                    isLoggedIn = loggedIn,
                    showManualSetup = false,
                    statusMessage = if (loggedIn) "Connected" else "Server set — please log in",
                )
            }
            if (loggedIn) {
                refreshProjects(silent = true, autoConfirm = false)
            }
            onConnected(loggedIn)
        }
    }

    fun saveServerSettings(onSaved: () -> Unit = {}) {
        sessionStore.backendHost = _uiState.value.backendHost
        sessionStore.backendPort = _uiState.value.backendPort
        sessionStore.useHttps = _uiState.value.useHttps
        sessionStore.isConfigured = true
        sessionStore.logout()
        _uiState.update {
            it.copy(
                isConfigured = true,
                isLoggedIn = false,
                userName = "",
                projectConfirmed = false,
                selectedProjectId = null,
                projects = emptyList(),
                showManualSetup = false,
                statusMessage = "Server saved — please log in",
            )
        }
        onSaved()
    }

    fun startPushToTalk() {
        accumulatedTranscript = null
        _uiState.update {
            it.copy(
                isListening = true,
                pendingTranscript = null,
                liveTranscript = null,
                statusMessage = "Listening — tap stop when done",
            )
        }
        speechHelper.startSession()
    }

    fun stopPushToTalk() {
        if (!_uiState.value.isListening) return
        _uiState.update {
            it.copy(statusMessage = "Processing...")
        }
        speechHelper.endSession()
    }

    fun discardPendingTranscript() {
        _uiState.update { it.copy(pendingTranscript = null, statusMessage = "Discarded") }
    }

    fun submitPendingTranscript() {
        val text = _uiState.value.pendingTranscript?.trim()?.takeIf { it.isNotEmpty() } ?: return
        submitTask(text)
        _uiState.update { it.copy(pendingTranscript = null) }
    }

    fun submitTask(text: String) {
        if (text.isBlank()) return
        val projectId = _uiState.value.selectedProjectId
        if (projectId.isNullOrBlank() || !_uiState.value.projectConfirmed) {
            _uiState.update { it.copy(statusMessage = "Select a project first") }
            refreshProjects(silent = true)
            return
        }
        viewModelScope.launch {
            try {
                _uiState.update { it.copy(isSending = true, statusMessage = "Sending...") }
                val result = taskRepository.createTask(text, projectId)
                val taskId = result.id.toIntOrNull()
                if (taskId != null) {
                    sessionStore.addRecentTask(
                        RecentTask(
                            taskId = taskId,
                            title = result.name,
                            projectId = result.projectId,
                            projectName = result.projectName,
                            createdAt = result.createdAt ?: java.time.Instant.now().toString(),
                        ),
                    )
                }
                val recent = scopedRecentTasks(sessionStore.recentTasks(), projectId)
                _uiState.update {
                    it.copy(
                        recentTasks = recent,
                        answerEntries = answerEntriesFor(recent, it.inboxItems, projectId, true),
                        lastTranscript = text,
                        pendingTranscript = null,
                        isSending = false,
                        statusMessage = "Task created",
                    )
                }
                refreshInbox(silent = true, force = true)
                InboxPollWorker.start(getApplication())
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSending = false, statusMessage = "Failed: ${e.message}")
                }
            }
        }
    }

    private fun answerEntriesFor(
        recentTasks: List<RecentTask>,
        inboxItems: List<InboxItem>,
        selectedProjectId: String? = _uiState.value.selectedProjectId,
        projectConfirmed: Boolean = _uiState.value.projectConfirmed,
    ): List<AnswerEntry> {
        if (!projectConfirmed) return emptyList()
        val projectId = selectedProjectId?.takeIf { it.isNotBlank() } ?: return emptyList()
        return buildAnswerEntries(recentTasks, inboxItems, projectId)
    }

    private fun scopedRecentTasks(
        recentTasks: List<RecentTask>,
        projectId: String?,
    ): List<RecentTask> {
        if (projectId.isNullOrBlank()) return emptyList()
        return recentTasks.filter { taskBelongsToProject(it.projectId, projectId) }
    }

    private fun scopedInboxItems(
        inboxItems: List<InboxItem>,
        projectId: String?,
    ): List<InboxItem> {
        if (projectId.isNullOrBlank()) return emptyList()
        return inboxItems.filter { taskBelongsToProject(it.projectId, projectId) }
    }

    override fun onCleared() {
        speechHelper.destroy()
        ttsHelper.destroy()
        super.onCleared()
    }
}
