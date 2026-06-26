package com.ddd.todo.notification

import com.ddd.todo.data.Task
import org.junit.Assert.assertEquals
import org.junit.Test

class ReminderPlanTest {
    @Test
    fun buildsPlansForOpenFutureRemindersOnly() {
        val now = 1_780_000_000_000L
        val plans = buildReminderPlans(
            listOf(
                Task(id = "future", title = "Future", reminderAt = "2026-06-19T09:00:00Z"),
                Task(id = "done", title = "Done", completed = true, reminderAt = "2026-06-19T10:00:00Z"),
                Task(id = "none", title = "None", reminderAt = null),
                Task(id = "past", title = "Past", reminderAt = "2025-06-19T09:00:00Z")
            ),
            nowMillis = now
        )

        assertEquals(listOf("future"), plans.map { it.taskId })
    }
}
