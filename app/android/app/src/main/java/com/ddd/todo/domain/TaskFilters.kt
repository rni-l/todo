package com.ddd.todo.domain

import com.ddd.todo.data.Project
import com.ddd.todo.data.PublicData
import com.ddd.todo.data.Task
import java.time.LocalDate

enum class TaskView {
    TODAY,
    INBOX,
    UPCOMING,
    PROJECT
}

fun openTasks(data: PublicData): List<Task> = data.tasks
    .filter { !it.completed && !it.closed }
    .sortedWith(compareBy<Task> { prioritySort(it) }.thenBy { it.dueDate ?: it.startDate ?: "9999-99-99" }.thenBy { it.order })

fun todayTasks(data: PublicData, today: LocalDate = LocalDate.parse(todayIso())): List<Task> =
    openTasks(data).filter { task ->
        taskCoversDate(task, today) || taskDateStatus(task, today) == DateStatus.OVERDUE
    }

fun inboxTasks(data: PublicData): List<Task> =
    openTasks(data).filter { it.projectId.isNullOrBlank() }

fun upcomingTasks(data: PublicData, today: LocalDate = LocalDate.parse(todayIso())): List<Task> =
    openTasks(data).filter { isWithinFutureWindow(it, today) && taskDateStatus(it, today) != DateStatus.OVERDUE }

fun projectTasks(data: PublicData, projectId: String): List<Task> =
    openTasks(data).filter { it.projectId == projectId }

fun activeProjects(data: PublicData): List<Project> =
    data.projects.filterNot { it.archived }.sortedBy { it.order }

fun taskCountForProject(data: PublicData, projectId: String): Int =
    openTasks(data).count { it.projectId == projectId }

private fun prioritySort(task: Task): Int = when (task.priority.name.lowercase()) {
    "high" -> 0
    "medium" -> 1
    "low" -> 2
    else -> 3
}
