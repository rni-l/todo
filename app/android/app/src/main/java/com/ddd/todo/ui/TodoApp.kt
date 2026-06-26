@file:OptIn(
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
    androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.ddd.todo.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ddd.todo.TodoContainer
import com.ddd.todo.data.Priority
import com.ddd.todo.data.Project
import com.ddd.todo.data.PublicData
import com.ddd.todo.data.Tag
import com.ddd.todo.data.Task
import com.ddd.todo.domain.DateStatus
import com.ddd.todo.domain.activeProjects
import com.ddd.todo.domain.formatTaskDate
import com.ddd.todo.domain.inboxTasks
import com.ddd.todo.domain.openTasks
import com.ddd.todo.domain.parseIsoDate
import com.ddd.todo.domain.projectTasks
import com.ddd.todo.domain.taskCountForProject
import com.ddd.todo.domain.taskDateStatus
import com.ddd.todo.domain.todayIso
import com.ddd.todo.domain.todayTasks
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private val ScreenBg = Color(0xFFF3F7F6)
private val SurfaceCard = Color(0xFFFBFDFC)
private val SurfaceSoft = Color(0xFFEEF5F3)
private val SurfaceDeeper = Color(0xFFE4EEEB)
private val Ink = Color(0xFF17211F)
private val InkSoft = Color(0xFF51605D)
private val Muted = Color(0xFF75827F)
private val Line = Color(0xFFDCE8E5)
private val LineStrong = Color(0xFFC6D6D2)
private val Accent = Color(0xFF08786F)
private val AccentDeep = Color(0xFF055F59)
private val AccentSoft = Color(0xFFDFF2EE)
private val AccentWash = Color(0xFFEEF9F6)
private val Success = Color(0xFF168256)
private val Warn = Color(0xFFAD7417)
private val Danger = Color(0xFFB23A31)
private val Blue = Color(0xFF346AA6)

@Composable
fun TodoApp(container: TodoContainer) {
    val viewModel: AppViewModel = viewModel(factory = AppViewModelFactory(container))
    val state by viewModel.state.collectAsState()

    TodoTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = ScreenBg) {
            when {
                state.loading && state.data == null -> LoadingScreen()
                state.loginMode -> LoginScreen(state = state, viewModel = viewModel)
                else -> MainScreen(state = state, viewModel = viewModel)
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBg),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = SurfaceCard),
            border = BorderStroke(1.dp, Line)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                LinearProgressIndicator(modifier = Modifier.width(180.dp), color = Accent)
                Text("正在准备 TODO", color = InkSoft, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun LoginScreen(state: UiState, viewModel: AppViewModel) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBg),
        contentPadding = PaddingValues(18.dp, 28.dp, 18.dp, 32.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            HeroCard(
                eyebrow = "SELF-HOSTED TODO",
                title = "把任务放回自己的服务里。",
                body = "Android 端保持在线优先，登录后同步现有任务、项目和本地提醒。"
            )
        }
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.92f)),
                border = BorderStroke(1.dp, LineStrong)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    TodoTextField(
                        value = state.loginDraft.serverUrl,
                        onValueChange = { value -> viewModel.updateLoginDraft { it.copy(serverUrl = value) } },
                        label = "服务端地址",
                        placeholder = "http://10.0.2.2:38887",
                        keyboardType = KeyboardType.Uri
                    )
                    if (state.loginDraft.serverUrl.trim().startsWith("http://")) {
                        StatusBanner("内网 HTTP 可用；公网建议使用 HTTPS。", tone = BannerTone.ACCENT)
                    }
                    TodoTextField(
                        value = state.loginDraft.username,
                        onValueChange = { value -> viewModel.updateLoginDraft { it.copy(username = value) } },
                        label = "用户名",
                        singleLine = true
                    )
                    TodoTextField(
                        value = state.loginDraft.password,
                        onValueChange = { value -> viewModel.updateLoginDraft { it.copy(password = value) } },
                        label = "密码",
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Button(
                        onClick = viewModel::login,
                        enabled = !state.loading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(17.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Accent)
                    ) {
                        Text(if (state.loading) "登录中" else "登录并同步", fontWeight = FontWeight.Black)
                    }
                }
            }
        }
        if (state.message.isNotBlank()) {
            item { StatusBanner(state.message, tone = BannerTone.ERROR) }
        }
    }
}

@Composable
private fun HeroCard(eyebrow: String, title: String, body: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = AccentWash),
        border = BorderStroke(1.dp, LineStrong)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Eyebrow(eyebrow)
            Text(title, color = Ink, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black, lineHeight = MaterialTheme.typography.headlineMedium.lineHeight)
            Text(body, color = InkSoft, style = MaterialTheme.typography.bodyMedium, lineHeight = MaterialTheme.typography.bodyMedium.lineHeight)
        }
    }
}

@Composable
private fun MainScreen(state: UiState, viewModel: AppViewModel) {
    val data = state.data ?: return
    val selectedTask = data.tasks.firstOrNull { it.id == state.selectedTaskId }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            containerColor = ScreenBg,
            topBar = { TopHeader(state = state, data = data, viewModel = viewModel) },
            bottomBar = { BottomNavigation(state = state, viewModel = viewModel) },
            floatingActionButton = {
                if (shouldShowFab(state)) {
                    FloatingActionButton(
                        onClick = { startContextualCreate(state, viewModel) },
                        containerColor = Accent,
                        contentColor = Color.White,
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Icon(Icons.Outlined.Add, contentDescription = "新建任务")
                    }
                }
            }
        ) { padding ->
            Box(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
            ) {
                when (state.tab) {
                    AppTab.TODAY -> TodayScreen(state = state, data = data, viewModel = viewModel)
                    AppTab.INBOX -> InboxScreen(state = state, data = data, viewModel = viewModel)
                    AppTab.CALENDAR -> CalendarScreen(state = state, data = data, viewModel = viewModel)
                    AppTab.PROJECTS -> ProjectsScreen(state = state, data = data, viewModel = viewModel)
                    AppTab.MORE -> MoreScreen(state = state, viewModel = viewModel)
                }
                if (state.message.isNotBlank()) {
                    Box(modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp)) {
                        StatusBanner(state.message, tone = if (state.message.contains("离线") || state.message.contains("失败")) BannerTone.ERROR else BannerTone.ACCENT)
                    }
                }
            }
        }

        selectedTask?.let { task ->
            TaskDetailScreen(task = task, data = data, state = state, viewModel = viewModel)
        }

        state.editingDraft?.let {
            TaskEditorSheet(state = state, data = data, viewModel = viewModel)
        }
    }
}

@Composable
private fun TopHeader(state: UiState, data: PublicData, viewModel: AppViewModel) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard.copy(alpha = 0.78f))
            .padding(18.dp, 12.dp, 18.dp, 12.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Eyebrow(headerEyebrow(state, data))
                Text(
                    screenTitle(state, data),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = Ink,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Black
                )
                Text(syncSubtitle(state), color = Muted, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            IconButton(
                onClick = { if (state.tab == AppTab.CALENDAR) viewModel.goToToday() else viewModel.refresh() },
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(15.dp))
                    .background(SurfaceCard)
            ) {
                if (state.tab == AppTab.CALENDAR) {
                    Text("今", color = AccentDeep, fontWeight = FontWeight.Black)
                } else {
                    Icon(Icons.Outlined.Refresh, contentDescription = "同步", tint = InkSoft)
                }
            }
        }
        when (state.tab) {
            AppTab.TODAY -> StatusBanner(todayBanner(data), tone = BannerTone.ACCENT)
            AppTab.INBOX -> {
                if (state.isOfflineReadOnly) StatusBanner("当前离线，任务可以查看，但不能保存修改。", tone = BannerTone.WARN)
            }
            AppTab.CALENDAR -> CalendarModeRow(data, state)
            AppTab.PROJECTS, AppTab.MORE -> Unit
        }
    }
}

@Composable
private fun BottomNavigation(state: UiState, viewModel: AppViewModel) {
    Surface(color = SurfaceCard.copy(alpha = 0.96f), tonalElevation = 8.dp, shadowElevation = 8.dp) {
        NavigationBar(containerColor = Color.Transparent, tonalElevation = 0.dp) {
            AppTab.entries.forEach { tab ->
                NavigationBarItem(
                    selected = state.tab == tab,
                    onClick = { viewModel.selectTab(tab) },
                    icon = { Icon(tab.icon(), contentDescription = tab.label) },
                    label = { Text(tab.label, maxLines = 1) }
                )
            }
        }
    }
}

@Composable
private fun TodayScreen(state: UiState, data: PublicData, viewModel: AppViewModel) {
    val tasks = todayTasks(data)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { MetricRow(metrics = todayMetrics(data)) }
        item {
            QuickAddBar(
                value = state.quickAddTitle,
                onValueChange = viewModel::updateQuickAddTitle,
                onSubmit = viewModel::submitQuickAdd,
                enabled = state.online
            )
        }
        if (tasks.isEmpty()) {
            item { EmptyState("今天没有任务", "新的想法可以从右下角或快速添加开始。") }
        } else {
            val groups = todayTaskGroups(tasks)
            groups.forEach { group ->
                item { SectionHead(title = group.title, count = group.tasks.size) }
                items(group.tasks, key = { it.id }) { task ->
                    TaskCard(task = task, data = data, state = state, onOpen = { viewModel.openTask(task.id) }, onToggle = { viewModel.toggleComplete(task) })
                }
            }
        }
    }
}

@Composable
private fun InboxScreen(state: UiState, data: PublicData, viewModel: AppViewModel) {
    val tasks = filteredInboxTasks(data, state.inboxFilter)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InboxFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = state.inboxFilter == filter,
                        onClick = { viewModel.selectInboxFilter(filter) },
                        label = { Text("${filter.label} ${inboxFilterCount(data, filter)}") }
                    )
                }
            }
        }
        if (tasks.isEmpty()) {
            item {
                EmptyState(
                    title = if (state.inboxFilter == InboxFilter.UNSORTED) "收件箱已清空" else "没有匹配任务",
                    body = "新的想法仍可以先放到这里；同步恢复后再移动项目或设置日期。"
                )
            }
        } else {
            items(tasks, key = { it.id }) { task ->
                TaskCard(task = task, data = data, state = state, onOpen = { viewModel.openTask(task.id) }, onToggle = { viewModel.toggleComplete(task) })
            }
            item {
                SectionHead(title = "空状态预览", count = 0)
                EmptyState(title = "收件箱已清空", body = "新的想法仍可以先放到这里；同步恢复后再移动项目或设置日期。")
            }
        }
    }
}

@Composable
private fun CalendarScreen(state: UiState, data: PublicData, viewModel: AppViewModel) {
    val selectedDate = parseIsoDate(state.selectedCalendarDate) ?: LocalDate.parse(todayIso())
    val selectedTasks = selectedDayTasks(data, selectedDate.toString())
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { CalendarMonthCard(state = state, data = data, viewModel = viewModel) }
        item {
            CardBlock {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(formatSelectedDateTitle(selectedDate), color = Ink, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { viewModel.startCreate(dueDate = selectedDate.toString()) }) {
                        Text("在这天新建", color = AccentDeep, fontWeight = FontWeight.Bold)
                    }
                }
                if (selectedTasks.isEmpty()) {
                    Text("这一天没有任务。", color = Muted, modifier = Modifier.padding(vertical = 12.dp))
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        selectedTasks.forEach { task ->
                            MiniTaskRow(task = task, data = data, onOpen = { viewModel.openTask(task.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarModeRow(data: PublicData, state: UiState) {
    val rangeCount = openTasks(data).count { task ->
        val start = parseIsoDate(task.startDate)
        val due = parseIsoDate(task.dueDate)
        start != null && due != null && start != due
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Pill("周", active = false)
        Pill("月", active = true)
        Pill("范围任务 $rangeCount", active = false)
    }
    Text("已选 ${state.selectedCalendarDate} · 新建默认这天", color = Muted, style = MaterialTheme.typography.labelSmall)
}

@Composable
private fun CalendarMonthCard(state: UiState, data: PublicData, viewModel: AppViewModel) {
    val month = runCatching { YearMonth.parse(state.visibleCalendarMonth) }.getOrElse { YearMonth.from(LocalDate.parse(todayIso())) }
    val selected = parseIsoDate(state.selectedCalendarDate) ?: LocalDate.parse(todayIso())
    val today = LocalDate.parse(todayIso())
    val cells = calendarCells(month)
    Card(
        modifier = Modifier.pointerInput(state.visibleCalendarMonth) {
            var dragAmount = 0f
            detectVerticalDragGestures(
                onDragStart = { dragAmount = 0f },
                onVerticalDrag = { _, amount -> dragAmount += amount },
                onDragEnd = {
                    when {
                        dragAmount > 56f -> viewModel.shiftCalendarMonth(-1)
                        dragAmount < -56f -> viewModel.shiftCalendarMonth(1)
                    }
                }
            )
        },
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.82f)),
        border = BorderStroke(1.dp, Line)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp, 10.dp, 8.dp, 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = { viewModel.shiftCalendarMonth(-1) }) {
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowLeft, contentDescription = "上个月", tint = InkSoft)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(month.format(DateTimeFormatter.ofPattern("yyyy年M月", Locale.CHINA)), color = Ink, fontWeight = FontWeight.Black)
                    Text("上下滑动查看列表，左右按钮切换月份", color = Muted, style = MaterialTheme.typography.labelSmall)
                }
                IconButton(onClick = { viewModel.shiftCalendarMonth(1) }) {
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = "下个月", tint = InkSoft)
                }
            }
            HorizontalDivider(color = Line)
            Row(modifier = Modifier.fillMaxWidth().padding(8.dp, 8.dp, 8.dp, 5.dp)) {
                listOf("一", "二", "三", "四", "五", "六", "日").forEach { label ->
                    Text(label, modifier = Modifier.weight(1f), textAlign = TextAlign.Center, color = Muted, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
            cells.chunked(7).forEach { week ->
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    week.forEach { date ->
                        CalendarDayCell(
                            date = date,
                            inMonth = date.month == month.month,
                            selected = date == selected,
                            today = date == today,
                            tasks = openTasks(data).filter { task -> com.ddd.todo.domain.taskCoversDate(task, date) },
                            onClick = { viewModel.selectCalendarDate(date.toString()) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
            RangeLane(data = data, month = month)
        }
    }
}

@Composable
private fun CalendarDayCell(
    date: LocalDate,
    inMonth: Boolean,
    selected: Boolean,
    today: Boolean,
    tasks: List<Task>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bg = when {
        selected -> AccentSoft
        today -> AccentWash
        else -> Color.Transparent
    }
    val border = when {
        selected -> Accent.copy(alpha = 0.42f)
        today -> Accent.copy(alpha = 0.22f)
        else -> Color.Transparent
    }
    Surface(
        modifier = modifier
            .height(50.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        color = bg,
        border = BorderStroke(1.dp, border)
    ) {
        Column(modifier = Modifier.padding(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "${date.dayOfMonth}",
                color = if (inMonth) if (selected || today) AccentDeep else InkSoft else Muted.copy(alpha = 0.58f),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Black
            )
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                tasks.take(4).forEach { task ->
                    Box(
                        modifier = Modifier
                            .size(5.dp)
                            .clip(CircleShape)
                            .background(priorityColor(task.priority))
                    )
                }
            }
        }
    }
}

@Composable
private fun RangeLane(data: PublicData, month: YearMonth) {
    val rangeTasks = openTasks(data).filter { task ->
        val start = parseIsoDate(task.startDate)
        val due = parseIsoDate(task.dueDate)
        start != null && due != null && start != due && rangeIntersectsMonth(start, due, month)
    }.take(3)
    if (rangeTasks.isEmpty()) return
    Column(modifier = Modifier.padding(12.dp, 2.dp, 12.dp, 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        rangeTasks.forEach { task ->
            Surface(shape = CircleShape, color = if (task.priority == Priority.MEDIUM) Color(0xFFFFF7E9) else AccentWash, border = BorderStroke(1.dp, Accent.copy(alpha = 0.16f))) {
                Row(modifier = Modifier.fillMaxWidth().padding(10.dp, 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(task.title, modifier = Modifier.weight(1f), color = AccentDeep, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelMedium)
                    Text(formatTaskDate(task), color = Muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun ProjectsScreen(state: UiState, data: PublicData, viewModel: AppViewModel) {
    val selected = state.selectedProjectId
    if (selected != null) {
        val project = data.projects.firstOrNull { it.id == selected }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 104.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = { viewModel.selectProject(null) }, shape = RoundedCornerShape(15.dp)) { Text("返回项目") }
                    Text(project?.name ?: "项目", color = Ink, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
                }
            }
            val tasks = projectTasks(data, selected)
            if (tasks.isEmpty()) {
                item { EmptyState("项目里没有任务", "在当前项目中新建任务后会显示在这里。") }
            } else {
                items(tasks, key = { it.id }) { task ->
                    TaskCard(task = task, data = data, state = state, onOpen = { viewModel.openTask(task.id) }, onToggle = { viewModel.toggleComplete(task) })
                }
            }
        }
        return
    }
    val projects = activeProjects(data)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (projects.isEmpty()) {
            item { EmptyState("暂无项目", "项目继续在 Web 端管理，Android 端展示未归档项目。") }
        } else {
            items(projects, key = { it.id }) { project ->
                ProjectCard(project = project, data = data, onClick = { viewModel.selectProject(project.id) })
            }
        }
    }
}

@Composable
private fun MoreScreen(state: UiState, viewModel: AppViewModel) {
    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        viewModel.refresh()
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            SettingsPanel {
                SettingsRow(icon = Icons.Outlined.Settings, title = "服务端", body = state.serverUrl.ifBlank { "未配置" }, trailing = { Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = Muted) })
                SettingsRow(
                    icon = if (state.online) Icons.Outlined.CloudDone else Icons.Outlined.CloudOff,
                    title = "同步状态",
                    body = syncSubtitle(state),
                    trailing = { Chip(if (state.online) "正常" else "离线", tone = if (state.online) ChipTone.SUCCESS else ChipTone.WARN) }
                )
                SettingsRow(
                    icon = Icons.Outlined.Notifications,
                    title = "本地提醒",
                    body = if (state.notificationAllowed) "权限已开启，同步后重建" else "通知权限未开启",
                    trailing = {
                        if (!state.notificationAllowed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            TextButton(onClick = { notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }) { Text("开启") }
                        } else {
                            Switch(checked = state.notificationAllowed, onCheckedChange = null)
                        }
                    }
                )
            }
        }
        item {
            StatusBanner("v1 Android 端保留日常任务管理，并把日历作为一级入口。附件、导入导出、统计、四象限和智能过滤器继续在 Web 端管理。", tone = BannerTone.WARN)
        }
        item {
            OutlinedButton(onClick = viewModel::logout, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp)) {
                Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("退出登录")
            }
        }
    }
}

@Composable
private fun QuickAddBar(value: String, onValueChange: (String) -> Unit, onSubmit: () -> Unit, enabled: Boolean) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.9f)),
        border = BorderStroke(1.dp, LineStrong)
    ) {
        Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("快速添加任务") },
                singleLine = true,
                enabled = enabled
            )
            Button(onClick = onSubmit, enabled = enabled, shape = RoundedCornerShape(13.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent)) {
                Text("加", fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun MetricRow(metrics: List<Pair<String, String>>) {
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        metrics.forEach { (value, label) ->
            Card(
                modifier = Modifier.weight(1f).height(72.dp),
                shape = RoundedCornerShape(19.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.76f)),
                border = BorderStroke(1.dp, Line)
            ) {
                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(value, color = Ink, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                    Text(label, color = Muted, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun SectionHead(title: String, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(title, color = Ink, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleSmall)
        Text("${count} 项", color = Muted, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun TaskCard(task: Task, data: PublicData, state: UiState, onOpen: () -> Unit, onToggle: () -> Unit) {
    val dateStatus = taskDateStatus(task)
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = if (task.completed) SurfaceSoft.copy(alpha = 0.72f) else SurfaceCard.copy(alpha = 0.82f)),
        border = BorderStroke(1.dp, Line)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            Surface(
                modifier = Modifier.width(4.dp).height(54.dp),
                shape = CircleShape,
                color = priorityColor(task.priority)
            ) {}
            IconButton(
                onClick = onToggle,
                enabled = state.online,
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (task.completed) Accent else Color.White.copy(alpha = 0.68f))
            ) {
                Icon(Icons.Outlined.Check, contentDescription = "完成", tint = if (task.completed) Color.White else Color.Transparent)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    task.title,
                    color = if (task.completed) Muted else Ink,
                    fontWeight = FontWeight.Black,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    DateChip(dateStatus, formatTaskDate(task))
                    projectName(data, task.projectId)?.let { Chip(it) }
                    if (task.subtasks.isNotEmpty()) Chip("${task.subtasks.count { it.completed }}/${task.subtasks.size} 子任务")
                    if (task.attachments.isNotEmpty()) Chip("${task.attachments.size} 附件")
                    task.tags.take(2).forEach { tagId -> tagName(data, tagId)?.let { Chip(it) } }
                }
            }
            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = Muted, modifier = Modifier.padding(top = 9.dp))
        }
    }
}

@Composable
private fun MiniTaskRow(task: Task, data: PublicData, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Box(
            modifier = Modifier
                .width(7.dp)
                .height(28.dp)
                .clip(CircleShape)
                .background(priorityColor(task.priority))
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(task.title, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Black)
            Text(listOfNotNull(priorityLabel(task.priority).takeIf { it != "无" }, projectName(data, task.projectId), formatTaskDate(task)).joinToString(" · "), color = Muted, style = MaterialTheme.typography.labelSmall)
        }
        DateChip(taskDateStatus(task), if (taskDateStatus(task) == DateStatus.TODAY) "今天" else priorityLabel(task.priority))
    }
}

@Composable
private fun ProjectCard(project: Project, data: PublicData, onClick: () -> Unit) {
    val count = taskCountForProject(data, project.id)
    val progress = projectProgress(data, project.id)
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(23.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.82f)),
        border = BorderStroke(1.dp, Line)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(shape = CircleShape, color = projectColor(project.color), modifier = Modifier.padding(top = 4.dp).size(14.dp), content = {})
                Column(modifier = Modifier.weight(1f)) {
                    Text(project.name, color = Ink, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
                    Text(project.description.ifBlank { "无描述" }, color = Muted, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall)
                }
                Chip("$count")
            }
            Surface(modifier = Modifier.fillMaxWidth().height(7.dp), shape = CircleShape, color = SurfaceDeeper) {
                Row {
                    Box(modifier = Modifier.fillMaxHeight().fillMaxWidth(progress).clip(CircleShape).background(projectColor(project.color)))
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun TaskDetailScreen(task: Task, data: PublicData, state: UiState, viewModel: AppViewModel) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = ScreenBg
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceCard.copy(alpha = 0.78f))
                    .padding(18.dp, 12.dp, 18.dp, 10.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    IconButton(onClick = viewModel::closeTaskDetail) {
                        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowLeft, contentDescription = "返回", tint = InkSoft)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        IconButton(onClick = { viewModel.startEdit(task) }, enabled = state.online) { Icon(Icons.Outlined.Edit, contentDescription = "编辑", tint = InkSoft) }
                        IconButton(onClick = { viewModel.deleteTask(task) }, enabled = state.online) { Icon(Icons.Outlined.Delete, contentDescription = "删除", tint = Danger) }
                    }
                }
                Text(task.title, color = Ink, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black, lineHeight = MaterialTheme.typography.headlineSmall.lineHeight)
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(18.dp, 16.dp, 18.dp, 24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                item {
                    PropertyPanel {
                        PropertyRow("日期") { DateChip(taskDateStatus(task), formatTaskDate(task)) }
                        PropertyRow("优先级") { Chip(priorityLabel(task.priority), tone = priorityTone(task.priority)) }
                        PropertyRow("项目") { Text(projectName(data, task.projectId) ?: "无项目", color = Ink, fontWeight = FontWeight.Bold) }
                        PropertyRow("提醒") { Text(task.reminderAt?.ifBlank { null } ?: "无", color = Ink, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        if (task.tags.isNotEmpty()) {
                            PropertyRow("标签") {
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    task.tags.forEach { tagId -> tagName(data, tagId)?.let { Chip(it) } }
                                }
                            }
                        }
                    }
                }
                if (task.description.isNotBlank()) {
                    item {
                        CardBlock {
                            PanelTitle("描述", "Markdown")
                            Text(task.description, color = InkSoft, lineHeight = MaterialTheme.typography.bodyMedium.lineHeight)
                        }
                    }
                }
                if (task.subtasks.isNotEmpty()) {
                    item {
                        CardBlock {
                            PanelTitle("子任务", "${task.subtasks.count { it.completed }}/${task.subtasks.size}")
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                task.subtasks.sortedBy { it.order }.forEach { subtask ->
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                                        Surface(shape = RoundedCornerShape(8.dp), color = if (subtask.completed) Accent else Color.Transparent, border = BorderStroke(1.dp, if (subtask.completed) Accent else LineStrong), modifier = Modifier.size(22.dp)) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(Icons.Outlined.Check, contentDescription = null, tint = if (subtask.completed) Color.White else Color.Transparent, modifier = Modifier.size(14.dp))
                                            }
                                        }
                                        Text(
                                            subtask.title,
                                            modifier = Modifier.weight(1f),
                                            color = if (subtask.completed) Muted else InkSoft,
                                            textDecoration = if (subtask.completed) TextDecoration.LineThrough else TextDecoration.None
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                if (task.attachments.isNotEmpty()) {
                    item { StatusBanner("这个任务有 ${task.attachments.size} 个附件；Android v1 仅展示数量，文件请在 Web 端管理。", tone = BannerTone.ACCENT) }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        Button(onClick = { viewModel.toggleComplete(task) }, enabled = state.online, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent)) {
                            Text(if (task.completed) "恢复" else "完成", fontWeight = FontWeight.Black)
                        }
                        OutlinedButton(onClick = { viewModel.closeTask(task) }, enabled = state.online, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(16.dp)) {
                            Text("关闭")
                        }
                        IconButton(onClick = { viewModel.deleteTask(task) }, enabled = state.online, modifier = Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xFFFFE8E4))) {
                            Icon(Icons.Outlined.Delete, contentDescription = "删除", tint = Danger)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskEditorSheet(state: UiState, data: PublicData, viewModel: AppViewModel) {
    val draft = state.editingDraft ?: return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = viewModel::cancelEditing,
        sheetState = sheetState,
        containerColor = SurfaceCard,
        shape = RoundedCornerShape(32.dp, 32.dp, 0.dp, 0.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(18.dp, 0.dp, 18.dp, 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = viewModel::cancelEditing) { Icon(Icons.Outlined.Close, contentDescription = "取消", tint = InkSoft) }
                Text(if (draft.id == null) "新建任务" else "编辑任务", color = Ink, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
                IconButton(onClick = viewModel::saveDraft, enabled = state.online) { Icon(Icons.Outlined.Check, contentDescription = "保存", tint = if (state.online) Accent else Muted) }
            }
            HorizontalDivider(color = Line)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(620.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(18.dp, 16.dp, 18.dp, 24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                TodoTextField(
                    value = draft.title,
                    onValueChange = { value -> viewModel.updateDraft { it.copy(title = value) } },
                    label = "标题",
                    keyboardCapitalization = KeyboardCapitalization.Sentences
                )
                TodoTextField(
                    value = draft.description,
                    onValueChange = { value -> viewModel.updateDraft { it.copy(description = value) } },
                    label = "描述",
                    minLines = 4
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TodoTextField(
                        value = draft.startDate,
                        onValueChange = { value -> viewModel.updateDraft { it.copy(startDate = value) } },
                        label = "开始日期",
                        placeholder = "2026-06-19",
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    TodoTextField(
                        value = draft.dueDate,
                        onValueChange = { value -> viewModel.updateDraft { it.copy(dueDate = value) } },
                        label = "截止日期",
                        placeholder = "2026-06-20",
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }
                Text("优先级", color = InkSoft, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Row(
                    modifier = Modifier.clip(RoundedCornerShape(17.dp)).background(SurfaceSoft).padding(5.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    Priority.entries.forEach { priority ->
                        FilterChip(
                            selected = draft.priority == priority,
                            onClick = { viewModel.updateDraft { it.copy(priority = priority) } },
                            label = { Text(priorityLabel(priority)) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                TodoTextField(
                    value = draft.reminderAt,
                    onValueChange = { value -> viewModel.updateDraft { it.copy(reminderAt = value) } },
                    label = "提醒时间",
                    placeholder = "2026-06-19T09:00:00.000Z",
                    singleLine = true
                )
                ProjectSelector(data.projects.filterNot { it.archived }, draft.projectId) { projectId ->
                    viewModel.updateDraft { it.copy(projectId = projectId) }
                }
                TagSelector(data.tags, draft.tags) { tags -> viewModel.updateDraft { it.copy(tags = tags) } }
                TodoTextField(
                    value = draft.subtasksText,
                    onValueChange = { value -> viewModel.updateDraft { it.copy(subtasksText = value) } },
                    label = "子任务，每行一个",
                    minLines = 4
                )
                if (!state.online) {
                    StatusBanner("当前离线，只能查看缓存，不能保存修改。", tone = BannerTone.ERROR)
                }
                Button(
                    onClick = viewModel::saveDraft,
                    enabled = state.online,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(17.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent)
                ) {
                    Icon(Icons.Outlined.Save, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("保存", fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun ProjectSelector(projects: List<Project>, selectedId: String?, onSelect: (String?) -> Unit) {
    Text("项目", color = InkSoft, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(selected = selectedId == null, onClick = { onSelect(null) }, label = { Text("无项目") })
        projects.forEach { project ->
            FilterChip(selected = selectedId == project.id, onClick = { onSelect(project.id) }, label = { Text(project.name) })
        }
    }
}

@Composable
private fun TagSelector(tags: List<Tag>, selected: Set<String>, onChange: (Set<String>) -> Unit) {
    Text("标签", color = InkSoft, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
    if (tags.isEmpty()) {
        Chip("暂无标签")
        return
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tags.forEach { tag ->
            FilterChip(
                selected = selected.contains(tag.id),
                onClick = { onChange(if (selected.contains(tag.id)) selected - tag.id else selected + tag.id) },
                label = { Text(tag.name) }
            )
        }
    }
}

@Composable
private fun EmptyState(title: String, body: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceSoft.copy(alpha = 0.78f)),
        border = BorderStroke(1.dp, LineStrong)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(28.dp, 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Surface(shape = RoundedCornerShape(23.dp), color = SurfaceDeeper, modifier = Modifier.size(68.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.Check, contentDescription = null, tint = Accent, modifier = Modifier.size(30.dp))
                }
            }
            Text(title, color = Ink, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
            Text(body, color = Muted, textAlign = TextAlign.Center, lineHeight = MaterialTheme.typography.bodyMedium.lineHeight)
        }
    }
}

@Composable
private fun SettingsPanel(content: @Composable ColumnScope.() -> Unit) {
    Card(
        shape = RoundedCornerShape(23.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.82f)),
        border = BorderStroke(1.dp, Line)
    ) {
        Column(content = content)
    }
}

@Composable
private fun SettingsRow(icon: ImageVector, title: String, body: String, trailing: @Composable () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(14.dp, 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp)
    ) {
        Surface(shape = RoundedCornerShape(15.dp), color = AccentSoft, modifier = Modifier.size(42.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = AccentDeep)
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Ink, fontWeight = FontWeight.Black)
            Text(body, color = Muted, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing()
    }
}

@Composable
private fun CardBlock(content: @Composable ColumnScope.() -> Unit) {
    Card(
        shape = RoundedCornerShape(23.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.82f)),
        border = BorderStroke(1.dp, Line)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
private fun PropertyPanel(content: @Composable ColumnScope.() -> Unit) {
    Card(
        shape = RoundedCornerShape(23.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard.copy(alpha = 0.82f)),
        border = BorderStroke(1.dp, Line)
    ) {
        Column(content = content)
    }
}

@Composable
private fun PropertyRow(label: String, value: @Composable RowScope.() -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(14.dp, 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(label, modifier = Modifier.width(76.dp), color = Muted, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
        Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically, content = value)
    }
}

@Composable
private fun PanelTitle(title: String, meta: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Ink, fontWeight = FontWeight.Black)
        Chip(meta, tone = ChipTone.ACCENT)
    }
}

private enum class BannerTone { ACCENT, WARN, ERROR }

@Composable
private fun StatusBanner(message: String, tone: BannerTone) {
    val (bg, fg) = when (tone) {
        BannerTone.ACCENT -> AccentSoft to AccentDeep
        BannerTone.WARN -> Color(0xFFFFF2D9) to Color(0xFF6F4B12)
        BannerTone.ERROR -> Color(0xFFFFE8E4) to Color(0xFF8D2D27)
    }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = bg,
        contentColor = fg,
        shape = RoundedCornerShape(14.dp)
    ) {
        Text(message, modifier = Modifier.padding(11.dp, 9.dp), color = fg, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
    }
}

private enum class ChipTone { DEFAULT, ACCENT, WARN, DANGER, SUCCESS }

@Composable
private fun Chip(label: String, tone: ChipTone = ChipTone.DEFAULT) {
    val (bg, fg) = when (tone) {
        ChipTone.ACCENT -> AccentSoft to AccentDeep
        ChipTone.WARN -> Color(0xFFFFF2D9) to Color(0xFF6F4B12)
        ChipTone.DANGER -> Color(0xFFFFE8E4) to Color(0xFF8D2D27)
        ChipTone.SUCCESS -> Color(0xFFE2F5EC) to Color(0xFF126340)
        ChipTone.DEFAULT -> SurfaceSoft to InkSoft
    }
    Surface(shape = CircleShape, color = bg, border = BorderStroke(1.dp, Line.copy(alpha = 0.7f))) {
        Text(label, modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp), color = fg, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun DateChip(status: DateStatus, label: String) {
    val text = when (status) {
        DateStatus.OVERDUE -> "已过期"
        DateStatus.TODAY -> "今天"
        DateStatus.FUTURE -> label
        DateStatus.NONE -> "无日期"
    }
    val tone = when (status) {
        DateStatus.OVERDUE -> ChipTone.DANGER
        DateStatus.TODAY -> ChipTone.ACCENT
        DateStatus.FUTURE -> ChipTone.DEFAULT
        DateStatus.NONE -> ChipTone.DEFAULT
    }
    Chip(text, tone = tone)
}

@Composable
private fun Pill(label: String, active: Boolean) {
    Surface(
        shape = CircleShape,
        color = if (active) Ink else SurfaceCard.copy(alpha = 0.68f),
        contentColor = if (active) Color.White else InkSoft
    ) {
        Text(label, modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun Eyebrow(text: String) {
    Text(text, color = AccentDeep, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Black)
}

@Composable
private fun TodoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    placeholder: String = "",
    singleLine: Boolean = false,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text,
    keyboardCapitalization: KeyboardCapitalization = KeyboardCapitalization.None,
    visualTransformation: androidx.compose.ui.text.input.VisualTransformation = androidx.compose.ui.text.input.VisualTransformation.None
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label) },
        placeholder = if (placeholder.isNotBlank()) ({ Text(placeholder) }) else null,
        singleLine = singleLine,
        minLines = minLines,
        shape = RoundedCornerShape(16.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, capitalization = keyboardCapitalization),
        visualTransformation = visualTransformation
    )
}

private data class TaskGroup(val title: String, val tasks: List<Task>)

private fun todayTaskGroups(tasks: List<Task>): List<TaskGroup> {
    val overdue = tasks.filter { taskDateStatus(it) == DateStatus.OVERDUE }
    val morning = tasks.filter {
        val hour = reminderHour(it)
        taskDateStatus(it) != DateStatus.OVERDUE && hour != null && hour in 0..11
    }
    val afternoon = tasks.filter {
        val hour = reminderHour(it)
        taskDateStatus(it) != DateStatus.OVERDUE && hour != null && hour >= 12
    }
    val other = tasks.filter { taskDateStatus(it) != DateStatus.OVERDUE && reminderHour(it) == null }
    return listOf(
        TaskGroup("需要先处理", overdue),
        TaskGroup("上午", morning),
        TaskGroup("下午", afternoon),
        TaskGroup("其他", other)
    ).filter { it.tasks.isNotEmpty() }
}

private fun reminderHour(task: Task): Int? {
    val raw = task.reminderAt?.takeIf { it.length >= 13 } ?: return null
    return raw.substring(11, 13).toIntOrNull()
}

private fun todayMetrics(data: PublicData): List<Pair<String, String>> {
    val open = openTasks(data)
    val today = todayTasks(data)
    val overdue = today.count { taskDateStatus(it) == DateStatus.OVERDUE }
    val reminders = open.count { !it.reminderAt.isNullOrBlank() }
    return listOf(today.size.toString() to "今日待办", overdue.toString() to "已过期", reminders.toString() to "本地提醒")
}

private fun todayBanner(data: PublicData): String {
    val tasks = todayTasks(data)
    val high = tasks.count { it.priority == Priority.HIGH }
    val reminder = tasks.firstOrNull { !it.reminderAt.isNullOrBlank() }
    return buildString {
        append("今天 $high 项高优先级")
        if (reminder != null) append("，有提醒任务待处理。") else append("。")
    }
}

private fun inboxFilterCount(data: PublicData, filter: InboxFilter): Int = filteredInboxTasks(data, filter).size

private fun calendarCells(month: YearMonth): List<LocalDate> {
    val first = month.atDay(1)
    val start = first.minusDays((first.dayOfWeek.value - 1).toLong())
    val last = month.atEndOfMonth()
    val end = last.plusDays((7 - last.dayOfWeek.value).toLong())
    return generateSequence(start) { it.plusDays(1) }.takeWhile { it <= end }.toList()
}

private fun rangeIntersectsMonth(start: LocalDate, due: LocalDate, month: YearMonth): Boolean {
    val monthStart = month.atDay(1)
    val monthEnd = month.atEndOfMonth()
    return maxOf(start, due).let { rangeEnd ->
        minOf(start, due).let { rangeStart ->
            maxOf(rangeStart, monthStart) <= minOf(rangeEnd, monthEnd)
        }
    }
}

private fun projectProgress(data: PublicData, projectId: String): Float {
    val tasks = data.tasks.filter { it.projectId == projectId }
    if (tasks.isEmpty()) return 0f
    return tasks.count { it.completed || it.closed }.toFloat() / tasks.size.toFloat()
}

private fun formatSelectedDateTitle(date: LocalDate): String {
    val weekday = listOf("周一", "周二", "周三", "周四", "周五", "周六", "周日")[date.dayOfWeek.value - 1]
    return "${date.monthValue}月${date.dayOfMonth}日 · $weekday"
}

private fun startContextualCreate(state: UiState, viewModel: AppViewModel) {
    when (state.tab) {
        AppTab.TODAY -> viewModel.startCreate(dueDate = todayIso())
        AppTab.CALENDAR -> viewModel.startCreate(dueDate = state.selectedCalendarDate)
        AppTab.PROJECTS -> viewModel.startCreate(projectId = state.selectedProjectId)
        else -> viewModel.startCreate()
    }
}

private fun shouldShowFab(state: UiState): Boolean = state.tab != AppTab.MORE && (state.tab != AppTab.PROJECTS || state.selectedProjectId != null)

private fun headerEyebrow(state: UiState, data: PublicData): String = when (state.tab) {
    AppTab.TODAY -> "TODAY · ${todayTasks(data).size} TASKS"
    AppTab.INBOX -> "INBOX · CAPTURE"
    AppTab.CALENDAR -> "CALENDAR · MONTH"
    AppTab.PROJECTS -> "PROJECTS · ACTIVE"
    AppTab.MORE -> "MORE · SETTINGS"
}

private fun syncSubtitle(state: UiState): String =
    if (state.online) "在线 · ${state.lastSyncAt.ifBlank { "尚未同步" }}" else "离线 · 只读缓存"

private fun screenTitle(state: UiState, data: PublicData): String = when (state.tab) {
    AppTab.TODAY -> "今日"
    AppTab.INBOX -> "收件箱"
    AppTab.CALENDAR -> "日历"
    AppTab.PROJECTS -> state.selectedProjectId?.let { id -> data.projects.firstOrNull { it.id == id }?.name } ?: "项目"
    AppTab.MORE -> "更多"
}

private fun AppTab.icon(): ImageVector = when (this) {
    AppTab.TODAY -> Icons.Outlined.Home
    AppTab.INBOX -> Icons.Outlined.Inbox
    AppTab.CALENDAR -> Icons.Outlined.CalendarMonth
    AppTab.PROJECTS -> Icons.Outlined.Folder
    AppTab.MORE -> Icons.Outlined.MoreHoriz
}

private fun priorityLabel(priority: Priority): String = when (priority) {
    Priority.HIGH -> "高"
    Priority.MEDIUM -> "中"
    Priority.LOW -> "低"
    Priority.NONE -> "无"
}

private fun priorityTone(priority: Priority): ChipTone = when (priority) {
    Priority.HIGH -> ChipTone.DANGER
    Priority.MEDIUM -> ChipTone.WARN
    Priority.LOW -> ChipTone.SUCCESS
    Priority.NONE -> ChipTone.DEFAULT
}

private fun priorityColor(priority: Priority): Color = when (priority) {
    Priority.HIGH -> Danger
    Priority.MEDIUM -> Warn
    Priority.LOW -> Success
    Priority.NONE -> LineStrong
}

private fun projectColor(color: String): Color = when (color) {
    "green" -> Success
    "amber" -> Warn
    "red" -> Danger
    "violet" -> Color(0xFF7560A8)
    "blue" -> Blue
    else -> Accent
}

private fun projectName(data: PublicData, projectId: String?): String? =
    projectId?.let { id -> data.projects.firstOrNull { it.id == id }?.name }

private fun tagName(data: PublicData, tagId: String): String? =
    data.tags.firstOrNull { it.id == tagId }?.name
