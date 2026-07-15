package com.taskbridge.mobile.domain.models

data class EpicListItem(
    val taskId: Int,
    val title: String,
    val stageTitle: String? = null,
    val preview: String? = null,
    val updatedAt: String? = null,
)

data class EpicPageResult(
    val items: List<EpicListItem>,
    val limit: Int,
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
)

data class WorkflowStageItem(
    val id: String,
    val title: String,
    val position: Int,
)

data class TaskSubtaskSummary(
    val taskId: Int,
    val title: String,
    val stageId: String? = null,
    val stageTitle: String? = null,
    val workStatus: String? = null,
    val workStatusLabel: String? = null,
    val done: Boolean = false,
)

data class TaskParentRef(
    val taskId: Int,
    val title: String,
    val stageId: String? = null,
)

data class InboxItem(
    val taskId: Int,
    val title: String,
    val preview: String? = null,
    val status: String = "pending",
    val updatedAt: String?,
    val createdAt: String? = null,
    val projectId: String? = null,
    val projectName: String? = null,
    val stageTitle: String? = null,
    val assignee: String? = null,
) {
    val isReady: Boolean
        get() = status == "ready"
}

data class RecentTask(
    val taskId: Int,
    val title: String,
    val projectId: String? = null,
    val projectName: String? = null,
    val createdAt: String? = null,
)

data class TaskComment(
    val id: String,
    val by: String,
    val text: String,
    val at: String,
    val role: String,
    val tags: List<String> = emptyList(),
) {
    val isUser: Boolean
        get() = role == "user"
}

data class AnswerDetail(
    val taskId: Int,
    val title: String,
    val request: String,
    val description: String? = null,
    val status: String,
    val createdAt: String?,
    val updatedAt: String? = null,
    val createdBy: String,
    val projectId: String? = null,
    val projectName: String? = null,
    val stageId: String? = null,
    val stageTitle: String? = null,
    val assignee: String? = null,
    val isEpic: Boolean = false,
    val workStatusLabel: String? = null,
    val parentId: Int? = null,
    val parent: TaskParentRef? = null,
    val subtasks: List<TaskSubtaskSummary> = emptyList(),
    val comments: List<TaskComment> = emptyList(),
)

sealed class AnswerEntry {
    abstract val taskId: Int

    data class Pending(
        override val taskId: Int,
        val title: String,
    ) : AnswerEntry()

    data class Ready(
        val item: InboxItem,
    ) : AnswerEntry() {
        override val taskId: Int = item.taskId
    }
}

private fun parseEpoch(value: String?): Long? {
    if (value.isNullOrBlank()) return null
    return runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrNull()
        ?: runCatching {
            java.time.OffsetDateTime.parse(value).toInstant().toEpochMilli()
        }.getOrNull()
        ?: runCatching {
            java.time.LocalDateTime.parse(value).atZone(java.time.ZoneId.systemDefault()).toInstant()
                .toEpochMilli()
        }.getOrNull()
}

private fun AnswerEntry.sortKey(
    inboxById: Map<Int, InboxItem>,
    recentById: Map<Int, RecentTask>,
): Long {
    val item = inboxById[taskId]
    val recent = recentById[taskId]
    return parseEpoch(recent?.createdAt)
        ?: parseEpoch(item?.createdAt)
        ?: parseEpoch(item?.updatedAt)
        ?: taskId.toLong()
}

fun taskBelongsToProject(
    taskProjectId: String?,
    selectedProjectId: String,
): Boolean {
    if (selectedProjectId.isBlank()) return false
    return !taskProjectId.isNullOrBlank() && taskProjectId == selectedProjectId
}

fun buildAnswerEntries(
    recentTasks: List<RecentTask>,
    inboxItems: List<InboxItem>,
    projectId: String? = null,
): List<AnswerEntry> {
    val scopedRecent = if (projectId.isNullOrBlank()) {
        emptyList()
    } else {
        recentTasks.filter { taskBelongsToProject(it.projectId, projectId) }
    }
    val scopedInbox = if (projectId.isNullOrBlank()) {
        emptyList()
    } else {
        inboxItems.filter { taskBelongsToProject(it.projectId, projectId) }
    }
    val inboxById = scopedInbox.associateBy { it.taskId }
    val recentById = scopedRecent.associateBy { it.taskId }

    val readyEntries = scopedInbox.filter { it.isReady }.map { AnswerEntry.Ready(it) }
    val readyIds = readyEntries.map { it.taskId }.toSet()
    val pendingEntries = scopedRecent
        .filter { it.taskId !in readyIds }
        .map { AnswerEntry.Pending(it.taskId, it.title) }

    return (readyEntries + pendingEntries).sortedWith(
        compareByDescending<AnswerEntry> { it.sortKey(inboxById, recentById) }
            .thenByDescending { it.taskId },
    )
}
