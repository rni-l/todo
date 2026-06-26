package com.ddd.todo.domain

import com.ddd.todo.data.Task
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId

enum class DateStatus {
    OVERDUE,
    TODAY,
    FUTURE,
    NONE
}

fun todayIso(): String = LocalDate.now(ZoneId.systemDefault()).toString()

fun nowIso(): String = Instant.now().toString()

fun parseIsoDate(value: String?): LocalDate? {
    val raw = value?.take(10)?.takeIf { it.isNotBlank() } ?: return null
    return runCatching { LocalDate.parse(raw) }.getOrNull()
}

fun parseIsoInstant(value: String?): Instant? {
    val raw = value?.takeIf { it.isNotBlank() } ?: return null
    return runCatching { Instant.parse(raw) }
        .recoverCatching { OffsetDateTime.parse(raw).toInstant() }
        .getOrNull()
}

fun taskDateStatus(task: Task, today: LocalDate = LocalDate.parse(todayIso())): DateStatus {
    val due = parseIsoDate(task.dueDate)
    val start = parseIsoDate(task.startDate)
    val comparable = due ?: start ?: return DateStatus.NONE
    return when {
        comparable < today -> DateStatus.OVERDUE
        comparable == today -> DateStatus.TODAY
        else -> DateStatus.FUTURE
    }
}

fun taskCoversDate(task: Task, date: LocalDate): Boolean {
    val start = parseIsoDate(task.startDate)
    val due = parseIsoDate(task.dueDate)
    return when {
        start != null && due != null -> date >= minOf(start, due) && date <= maxOf(start, due)
        due != null -> due == date
        start != null -> start == date
        else -> false
    }
}

fun isWithinFutureWindow(task: Task, today: LocalDate = LocalDate.parse(todayIso()), days: Int = 30): Boolean {
    val end = today.plusDays(days.toLong())
    val start = parseIsoDate(task.startDate)
    val due = parseIsoDate(task.dueDate)
    val taskStart = start ?: due ?: return false
    val taskEnd = due ?: start ?: return false
    return maxOf(taskStart, today) <= minOf(taskEnd, end)
}

fun formatTaskDate(task: Task): String {
    val start = task.startDate?.take(10).orEmpty()
    val due = task.dueDate?.take(10).orEmpty()
    return when {
        start.isNotBlank() && due.isNotBlank() && start != due -> "$start 至 $due"
        due.isNotBlank() -> due
        start.isNotBlank() -> start
        else -> "未安排日期"
    }
}
