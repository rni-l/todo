package com.ddd.todo.notification

import com.ddd.todo.data.Task
import com.ddd.todo.domain.parseIsoInstant

data class ReminderPlan(
    val taskId: String,
    val title: String,
    val triggerAtMillis: Long
)

fun buildReminderPlans(tasks: List<Task>, nowMillis: Long = System.currentTimeMillis()): List<ReminderPlan> {
    return tasks
        .asSequence()
        .filter { !it.completed && !it.closed }
        .mapNotNull { task ->
            val trigger = parseIsoInstant(task.reminderAt)?.toEpochMilli() ?: return@mapNotNull null
            if (trigger <= nowMillis) return@mapNotNull null
            ReminderPlan(task.id, task.title.ifBlank { "任务提醒" }, trigger)
        }
        .sortedBy { it.triggerAtMillis }
        .toList()
}
