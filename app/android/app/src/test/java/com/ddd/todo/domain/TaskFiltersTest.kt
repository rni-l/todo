package com.ddd.todo.domain

import com.ddd.todo.data.Priority
import com.ddd.todo.data.Project
import com.ddd.todo.data.PublicData
import com.ddd.todo.data.Task
import com.ddd.todo.data.Attachment
import com.ddd.todo.ui.InboxFilter
import com.ddd.todo.ui.filteredInboxTasks
import com.ddd.todo.ui.selectedDayTasks
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class TaskFiltersTest {
    private val today = LocalDate.parse("2026-06-19")

    @Test
    fun todayIncludesOverdueAndCurrentTasksOnly() {
        val data = data(
            task("overdue", dueDate = "2026-06-18"),
            task("today", dueDate = "2026-06-19"),
            task("future", dueDate = "2026-06-24"),
            task("done", dueDate = "2026-06-19", completed = true)
        )

        assertEquals(listOf("overdue", "today"), todayTasks(data, today).map { it.id })
    }

    @Test
    fun inboxContainsOpenTasksWithoutProject() {
        val data = data(
            task("inbox", projectId = null),
            task("project", projectId = "proj_1"),
            task("closed", projectId = null, closed = true)
        )

        assertEquals(listOf("inbox"), inboxTasks(data).map { it.id })
    }

    @Test
    fun projectTasksOnlyReturnMatchingOpenTasks() {
        val data = data(
            task("a", projectId = "proj_1"),
            task("b", projectId = "proj_2"),
            task("c", projectId = "proj_1", completed = true)
        )

        assertEquals(listOf("a"), projectTasks(data, "proj_1").map { it.id })
    }

    @Test
    fun androidInboxFiltersMirrorDesignTabs() {
        val data = data(
            task("plain", projectId = null),
            task("dated", projectId = null, dueDate = "2026-06-19"),
            task("withAttachment", projectId = null, attachments = listOf(Attachment(id = "file_1"))),
            task("project", projectId = "proj_1")
        )

        assertEquals(listOf("dated", "plain", "withAttachment"), filteredInboxTasks(data, InboxFilter.UNSORTED).map { it.id })
        assertEquals(listOf("plain", "withAttachment"), filteredInboxTasks(data, InboxFilter.UNDATED).map { it.id })
        assertEquals(listOf("withAttachment"), filteredInboxTasks(data, InboxFilter.ATTACHMENTS).map { it.id })
    }

    @Test
    fun androidCalendarSelectedDayIncludesRangeTasks() {
        val data = data(
            task("single", dueDate = "2026-06-19"),
            task("range", startDate = "2026-06-18", dueDate = "2026-06-20"),
            task("other", dueDate = "2026-06-21")
        )

        assertEquals(listOf("single", "range"), selectedDayTasks(data, "2026-06-19").map { it.id })
    }

    private fun data(vararg tasks: Task) = PublicData(
        projects = listOf(Project(id = "proj_1", name = "One"), Project(id = "proj_2", name = "Two")),
        tasks = tasks.toList()
    )

    private fun task(
        id: String,
        startDate: String? = null,
        dueDate: String? = null,
        projectId: String? = null,
        completed: Boolean = false,
        closed: Boolean = false,
        attachments: List<Attachment> = emptyList()
    ) = Task(
        id = id,
        title = id,
        startDate = startDate,
        dueDate = dueDate,
        projectId = projectId,
        completed = completed,
        closed = closed,
        priority = Priority.NONE,
        attachments = attachments,
        order = 1
    )
}
