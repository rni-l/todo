package com.ddd.todo.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.ddd.todo.TodoContainer
import com.ddd.todo.data.CreateTaskRequest
import com.ddd.todo.data.MissingServerException
import com.ddd.todo.data.OfflineWriteException
import com.ddd.todo.data.Priority
import com.ddd.todo.data.Project
import com.ddd.todo.data.PublicData
import com.ddd.todo.data.Subtask
import com.ddd.todo.data.Task
import com.ddd.todo.data.TaskPatch
import com.ddd.todo.domain.activeProjects
import com.ddd.todo.domain.inboxTasks
import com.ddd.todo.domain.openTasks
import com.ddd.todo.domain.parseIsoDate
import com.ddd.todo.domain.projectTasks
import com.ddd.todo.domain.taskCoversDate
import com.ddd.todo.domain.todayTasks
import com.ddd.todo.domain.todayIso
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import java.time.LocalDate

enum class AppTab(val label: String) {
    TODAY("今日"),
    INBOX("收件箱"),
    CALENDAR("日历"),
    PROJECTS("项目"),
    MORE("更多")
}

enum class InboxFilter(val label: String) {
    UNSORTED("未整理"),
    UNDATED("无日期"),
    ATTACHMENTS("含附件")
}

data class TaskDraft(
    val id: String? = null,
    val title: String = "",
    val description: String = "",
    val projectId: String? = null,
    val startDate: String = "",
    val dueDate: String = "",
    val reminderAt: String = "",
    val reminderEndAt: String = "",
    val priority: Priority = Priority.NONE,
    val urgent: Boolean = false,
    val tags: Set<String> = emptySet(),
    val subtasksText: String = ""
)

data class LoginDraft(
    val serverUrl: String = "http://10.0.2.2:38887",
    val username: String = "self-hosted-user",
    val password: String = "todo123456"
)

data class UiState(
    val loading: Boolean = true,
    val online: Boolean = true,
    val serverUrl: String = "",
    val data: PublicData? = null,
    val lastSyncAt: String = "",
    val tab: AppTab = AppTab.TODAY,
    val inboxFilter: InboxFilter = InboxFilter.UNSORTED,
    val selectedCalendarDate: String = todayIso(),
    val visibleCalendarMonth: String = todayIso().take(7),
    val selectedProjectId: String? = null,
    val selectedTaskId: String? = null,
    val editingDraft: TaskDraft? = null,
    val quickAddTitle: String = "",
    val loginDraft: LoginDraft = LoginDraft(),
    val loginMode: Boolean = true,
    val message: String = "",
    val notificationAllowed: Boolean = true
) {
    val isReady: Boolean get() = data != null && !loginMode
    val isOfflineReadOnly: Boolean get() = !online && data != null
}

class AppViewModel(private val container: TodoContainer) : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        combine(
            container.repository.snapshotFlow,
            container.networkMonitor.online
        ) { snapshot, online ->
            val current = _state.value
            current.copy(
                loading = false,
                online = online,
                serverUrl = snapshot.serverUrl,
                data = snapshot.data,
                lastSyncAt = snapshot.lastSyncAt,
                loginMode = snapshot.data == null,
                loginDraft = current.loginDraft.copy(serverUrl = current.loginDraft.serverUrl.ifBlank { snapshot.serverUrl }),
                notificationAllowed = container.reminderScheduler.notificationsAllowed()
            )
        }.onEach { next ->
            _state.value = next
            next.data?.let { container.reminderScheduler.reschedule(it.tasks) }
        }.launchIn(viewModelScope)
    }

    fun updateLoginDraft(transform: (LoginDraft) -> LoginDraft) {
        _state.value = _state.value.copy(loginDraft = transform(_state.value.loginDraft), message = "")
    }

    fun login() = viewModelScope.launch {
        val draft = _state.value.loginDraft
        if (draft.serverUrl.isBlank() || draft.username.isBlank() || draft.password.isBlank()) {
            _state.value = _state.value.copy(message = "请填写服务端地址、用户名和密码")
            return@launch
        }
        runLoading {
            val data = container.repository.login(draft.serverUrl, draft.username, draft.password)
            container.reminderScheduler.reschedule(data.tasks)
            _state.value = _state.value.copy(loginMode = false, data = data, message = "登录成功")
        }
    }

    fun refresh() = viewModelScope.launch {
        if (!_state.value.online) {
            _state.value = _state.value.copy(message = "当前离线，只能查看缓存")
            return@launch
        }
        runLoading {
            val data = container.repository.refresh()
            container.reminderScheduler.reschedule(data.tasks)
            _state.value = _state.value.copy(data = data, loginMode = false, message = "已同步")
        }
    }

    fun logout() = viewModelScope.launch {
        container.repository.logout()
        _state.value = UiState(loading = false, online = _state.value.online, loginDraft = LoginDraft(serverUrl = _state.value.serverUrl))
    }

    fun selectTab(tab: AppTab) {
        _state.value = _state.value.copy(tab = tab, selectedProjectId = null, selectedTaskId = null, editingDraft = null, message = "")
    }

    fun selectInboxFilter(filter: InboxFilter) {
        _state.value = _state.value.copy(inboxFilter = filter)
    }

    fun selectProject(projectId: String?) {
        _state.value = _state.value.copy(selectedProjectId = projectId, selectedTaskId = null, editingDraft = null)
    }

    fun selectCalendarDate(date: String) {
        val normalized = parseIsoDate(date)?.toString() ?: return
        _state.value = _state.value.copy(
            selectedCalendarDate = normalized,
            visibleCalendarMonth = normalized.take(7)
        )
    }

    fun shiftCalendarMonth(delta: Long) {
        val currentMonth = runCatching { LocalDate.parse("${_state.value.visibleCalendarMonth}-01") }
            .getOrElse { LocalDate.parse(todayIso()).withDayOfMonth(1) }
        val nextMonth = currentMonth.plusMonths(delta)
        val selected = runCatching { LocalDate.parse(_state.value.selectedCalendarDate) }.getOrElse { LocalDate.parse(todayIso()) }
        val nextSelected = if (selected.year == nextMonth.year && selected.month == nextMonth.month) {
            selected
        } else {
            nextMonth
        }
        _state.value = _state.value.copy(
            visibleCalendarMonth = nextMonth.toString().take(7),
            selectedCalendarDate = nextSelected.toString()
        )
    }

    fun goToToday() {
        val today = todayIso()
        _state.value = _state.value.copy(
            selectedCalendarDate = today,
            visibleCalendarMonth = today.take(7)
        )
    }

    fun openTask(taskId: String) {
        _state.value = _state.value.copy(selectedTaskId = taskId, editingDraft = null)
    }

    fun closeTaskDetail() {
        _state.value = _state.value.copy(selectedTaskId = null, editingDraft = null)
    }

    fun cancelEditing() {
        _state.value = _state.value.copy(editingDraft = null, message = "")
    }

    fun updateQuickAddTitle(title: String) {
        _state.value = _state.value.copy(quickAddTitle = title, message = "")
    }

    fun submitQuickAdd() = viewModelScope.launch {
        val current = _state.value
        val title = current.quickAddTitle.trim()
        if (title.isBlank()) {
            _state.value = current.copy(message = "请输入任务标题")
            return@launch
        }
        val dueDate = when (current.tab) {
            AppTab.TODAY -> todayIso()
            AppTab.CALENDAR -> current.selectedCalendarDate
            else -> null
        }
        val projectId = if (current.tab == AppTab.PROJECTS) current.selectedProjectId else null
        runWrite {
            val data = container.repository.createTask(
                CreateTaskRequest(
                    title = title,
                    projectId = projectId,
                    dueDate = dueDate
                ),
                online = current.online
            )
            container.reminderScheduler.reschedule(data.tasks)
            _state.value = _state.value.copy(data = data, quickAddTitle = "", message = "任务已添加")
        }
    }

    fun startCreate(projectId: String? = null, dueDate: String? = null) {
        _state.value = _state.value.copy(
            editingDraft = TaskDraft(
                projectId = projectId ?: _state.value.selectedProjectId,
                dueDate = dueDate.orEmpty()
            ),
            selectedTaskId = null,
            message = ""
        )
    }

    fun startEdit(task: Task) {
        _state.value = _state.value.copy(
            selectedTaskId = task.id,
            editingDraft = TaskDraft(
                id = task.id,
                title = task.title,
                description = task.description,
                projectId = task.projectId,
                startDate = task.startDate.orEmpty().take(10),
                dueDate = task.dueDate.orEmpty().take(10),
                reminderAt = task.reminderAt.orEmpty(),
                reminderEndAt = task.reminderEndAt.orEmpty(),
                priority = task.priority,
                urgent = task.urgent,
                tags = task.tags.toSet(),
                subtasksText = task.subtasks.sortedBy { it.order }.joinToString("\n") { it.title }
            )
        )
    }

    fun updateDraft(transform: (TaskDraft) -> TaskDraft) {
        _state.value.editingDraft?.let { draft ->
            _state.value = _state.value.copy(editingDraft = transform(draft), message = "")
        }
    }

    fun saveDraft() = viewModelScope.launch {
        val draft = _state.value.editingDraft ?: return@launch
        if (draft.title.trim().isBlank()) {
            _state.value = _state.value.copy(message = "任务标题不能为空")
            return@launch
        }
        runWrite {
            val subtasks = draft.subtasksText.lines()
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .mapIndexed { index, title -> Subtask(title = title, completed = false, order = (index + 1).toLong()) }
            val data = if (draft.id == null) {
                container.repository.createTask(
                    CreateTaskRequest(
                        title = draft.title.trim(),
                        projectId = draft.projectId?.ifBlank { null },
                        startDate = draft.startDate.ifBlank { null },
                        dueDate = draft.dueDate.ifBlank { null },
                        reminderAt = draft.reminderAt.ifBlank { null },
                        reminderEndAt = draft.reminderEndAt.ifBlank { null },
                        priority = draft.priority,
                        urgent = draft.urgent,
                        tags = draft.tags.toList(),
                        description = draft.description,
                        subtasks = subtasks
                    ),
                    online = _state.value.online
                )
            } else {
                container.repository.updateTask(
                    draft.id,
                    TaskPatch(
                        title = draft.title.trim(),
                        projectId = draft.projectId?.ifBlank { null },
                        startDate = draft.startDate.ifBlank { null },
                        dueDate = draft.dueDate.ifBlank { null },
                        reminderAt = draft.reminderAt.ifBlank { null },
                        reminderEndAt = draft.reminderEndAt.ifBlank { null },
                        priority = draft.priority,
                        urgent = draft.urgent,
                        tags = draft.tags.toList(),
                        description = draft.description,
                        subtasks = subtasks
                    ),
                    online = _state.value.online
                )
            }
            container.reminderScheduler.reschedule(data.tasks)
            _state.value = _state.value.copy(data = data, editingDraft = null, message = "任务已保存")
        }
    }

    fun toggleComplete(task: Task) = viewModelScope.launch {
        runWrite {
            val data = container.repository.updateTask(task.id, TaskPatch(completed = !task.completed, closed = false), _state.value.online)
            _state.value = _state.value.copy(data = data, message = if (task.completed) "已恢复任务" else "已完成任务")
        }
    }

    fun closeTask(task: Task) = viewModelScope.launch {
        runWrite {
            val data = container.repository.updateTask(task.id, TaskPatch(closed = true, completed = false), _state.value.online)
            _state.value = _state.value.copy(data = data, selectedTaskId = null, message = "任务已关闭")
        }
    }

    fun deleteTask(task: Task) = viewModelScope.launch {
        runWrite {
            val data = container.repository.deleteTask(task.id, _state.value.online)
            _state.value = _state.value.copy(data = data, selectedTaskId = null, editingDraft = null, message = "任务已删除")
        }
    }

    fun visibleTasks(): List<Task> {
        val data = _state.value.data ?: return emptyList()
        return when (_state.value.tab) {
            AppTab.TODAY -> todayTasks(data)
            AppTab.INBOX -> filteredInboxTasks(data, _state.value.inboxFilter)
            AppTab.CALENDAR -> selectedDayTasks(data, _state.value.selectedCalendarDate)
            AppTab.PROJECTS -> _state.value.selectedProjectId?.let { projectTasks(data, it) } ?: emptyList()
            AppTab.MORE -> emptyList()
        }
    }

    fun activeProjects(): List<Project> = _state.value.data?.let(::activeProjects).orEmpty()

    private suspend fun runLoading(block: suspend () -> Unit) {
        _state.value = _state.value.copy(loading = true, message = "")
        runCatching { block() }
            .onFailure { error -> _state.value = _state.value.copy(message = error.readableMessage()) }
        _state.value = _state.value.copy(loading = false)
    }

    private suspend fun runWrite(block: suspend () -> Unit) {
        runCatching { block() }
            .onFailure { error -> _state.value = _state.value.copy(message = error.readableMessage()) }
    }

    private fun Throwable.readableMessage(): String = when (this) {
        is OfflineWriteException -> "当前离线，只能查看缓存，不能保存修改"
        is MissingServerException -> "请先配置服务端地址并登录"
        else -> message?.takeIf { it.isNotBlank() } ?: "操作失败"
    }
}

fun filteredInboxTasks(data: PublicData, filter: InboxFilter): List<Task> {
    val inbox = inboxTasks(data)
    return when (filter) {
        InboxFilter.UNSORTED -> inbox
        InboxFilter.UNDATED -> inbox.filter { it.startDate.isNullOrBlank() && it.dueDate.isNullOrBlank() }
        InboxFilter.ATTACHMENTS -> inbox.filter { it.attachments.isNotEmpty() }
    }
}

fun selectedDayTasks(data: PublicData, date: String): List<Task> {
    val selected = parseIsoDate(date) ?: return emptyList()
    return openTasks(data).filter { taskCoversDate(it, selected) }
}

class AppViewModelFactory(private val container: TodoContainer) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return AppViewModel(container) as T
    }
}
