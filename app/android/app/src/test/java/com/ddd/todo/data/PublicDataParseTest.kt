package com.ddd.todo.data

import org.junit.Assert.assertEquals
import org.junit.Test

class PublicDataParseTest {
    @Test
    fun parsesPublicDataAndIgnoresUnknownFields() {
        val json = """
            {
              "version": 1,
              "createdAt": "2026-06-19T00:00:00.000Z",
              "updatedAt": "2026-06-19T00:00:00.000Z",
              "user": {"username": "self-hosted-user", "extra": true},
              "settings": {"theme": "system", "calendarDayLimit": 3},
              "projects": [],
              "tags": [],
              "filters": [],
              "tasks": [
                {
                  "id": "task_1",
                  "title": "Today",
                  "completed": false,
                  "closed": false,
                  "priority": "high",
                  "tags": [],
                  "subtasks": [],
                  "attachments": [],
                  "order": 1780897826724,
                  "createdAt": "",
                  "updatedAt": "",
                  "unknown": "ignored"
                }
              ],
              "futureField": "ignored"
            }
        """.trimIndent()

        val data = TodoJson.decodeFromString(PublicData.serializer(), json)

        assertEquals("self-hosted-user", data.user.username)
        assertEquals(1, data.tasks.size)
        assertEquals(Priority.HIGH, data.tasks.first().priority)
        assertEquals(1780897826724L, data.tasks.first().order)
    }

    @Test
    fun parsesBooleanSmartFilterValues() {
        val json = """
            {
              "version": 1,
              "createdAt": "",
              "updatedAt": "",
              "user": {"username": "self-hosted-user"},
              "settings": {},
              "projects": [],
              "tags": [],
              "filters": [
                {
                  "id": "filter_reminders",
                  "name": "有提醒",
                  "pinned": true,
                  "conditions": [{"field": "hasReminder", "operator": "is", "value": true}],
                  "sort": "dueDate",
                  "group": "date",
                  "order": 1780897826724,
                  "createdAt": "",
                  "updatedAt": ""
                }
              ],
              "tasks": []
            }
        """.trimIndent()

        val data = TodoJson.decodeFromString(PublicData.serializer(), json)

        assertEquals("true", data.filters.first().conditions.first().value.toString())
        assertEquals(1780897826724L, data.filters.first().order)
    }
}
